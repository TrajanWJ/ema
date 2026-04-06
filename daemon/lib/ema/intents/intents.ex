defmodule Ema.Intents do
  @moduledoc """
  Context module for the Intent Engine.

  Canonical store for semantic truth: intents, edges, links, and lineage events.
  All mutations to intent tables go through this module.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Intents.{Intent, IntentLink, IntentEvent}
  alias Ema.Actors
  alias Ema.Executions
  alias Ema.Executions.AgentSession
  alias Ema.ClaudeSessions
  alias Ema.Claude.AiSession

  # ── CRUD ─────────────────────────────────────────────────────────

  def list_intents(opts \\ []) do
    Intent
    |> maybe_filter(:project_id, opts[:project_id])
    |> maybe_filter(:level, opts[:level])
    |> maybe_filter(:status, opts[:status])
    |> maybe_filter(:kind, opts[:kind])
    |> maybe_filter(:parent_id, opts[:parent_id])
    |> maybe_filter(:source_type, opts[:source_type])
    |> maybe_search(opts[:search])
    |> order_by([i], [asc: i.level, desc: i.inserted_at])
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  def get_intent(id), do: Repo.get(Intent, id)

  def get_intent!(id), do: Repo.get!(Intent, id)

  def get_intent_by_slug(slug), do: Repo.get_by(Intent, slug: slug)

  def get_intent_by_fingerprint(fp), do: Repo.get_by(Intent, source_fingerprint: fp)

  def create_intent(attrs) do
    %Intent{}
    |> Intent.changeset(attrs)
    |> Repo.insert()
    |> tap_ok(fn intent ->
      emit_event(intent.id, "created", %{
        source_type: intent.source_type,
        level: intent.level,
        kind: intent.kind
      })
      broadcast("intents:created", intent)
    end)
  end

  def update_intent(%Intent{} = intent, attrs) do
    old_status = intent.status
    old_phase = intent.phase

    intent
    |> Intent.changeset(attrs)
    |> Repo.update()
    |> tap_ok(fn updated ->
      if updated.status != old_status do
        emit_event(updated.id, "status_changed", %{
          old: old_status,
          new: updated.status
        })
        broadcast("intents:status_changed", updated)
        propagate_status(updated)
      end

      if updated.phase != old_phase do
        emit_event(updated.id, "phase_advanced", %{
          old: old_phase,
          new: updated.phase
        })
      end
    end)
  end

  def delete_intent(%Intent{} = intent) do
    Repo.delete(intent)
  end

  # ── Tree Operations ──────────────────────────────────────────────

  def tree(opts \\ []) do
    roots =
      Intent
      |> where([i], is_nil(i.parent_id))
      |> maybe_filter(:project_id, opts[:project_id])
      |> order_by([i], asc: i.level)
      |> Repo.all()

    Enum.map(roots, &build_subtree/1)
  end

  def get_intent_detail(id) do
    case get_intent(id) do
      nil ->
        nil

      intent ->
        serialize(intent)
        |> Map.put(:links, Enum.map(get_links(intent.id), &serialize_link/1))
        |> Map.put(:lineage, Enum.map(get_lineage(intent.id), &serialize_event/1))
    end
  end

  def get_runtime_bundle(id) do
    case get_intent(id) do
      nil ->
        nil

      intent ->
        links = get_links(intent.id)

        %{
          intent: serialize(intent),
          actors: links |> Enum.filter(&(&1.linkable_type == "actor")) |> Enum.map(&hydrate_link/1),
          executions: links |> Enum.filter(&(&1.linkable_type == "execution")) |> Enum.map(&hydrate_link/1),
          sessions:
            links
            |> Enum.filter(&(&1.linkable_type in ~w(session claude_session ai_session agent_session)))
            |> Enum.map(&hydrate_link/1),
          links: Enum.map(links, &serialize_link/1),
          lineage: Enum.map(get_lineage(intent.id, limit: 20), &serialize_event/1)
        }
    end
  end

  def status_summary(opts \\ []) do
    intents = list_intents(opts)

    counts =
      Enum.reduce(intents, %{}, fn intent, acc ->
        Map.update(acc, intent.status, 1, &(&1 + 1))
      end)

    %{
      total: length(intents),
      planned: Map.get(counts, "planned", 0),
      active: Map.get(counts, "active", 0) + Map.get(counts, "implementing", 0),
      blocked: Map.get(counts, "blocked", 0),
      complete: Map.get(counts, "complete", 0),
      researched: Map.get(counts, "researched", 0),
      outlined: Map.get(counts, "outlined", 0),
      archived: Map.get(counts, "archived", 0)
    }
  end

  defp build_subtree(node) do
    children =
      Intent
      |> where([i], i.parent_id == ^node.id)
      |> order_by([i], asc: i.level)
      |> Repo.all()
      |> Enum.map(&build_subtree/1)

    Map.put(node, :children, children)
  end

  def parent_chain(%Intent{parent_id: nil} = intent), do: [intent]
  def parent_chain(%Intent{parent_id: pid} = intent) do
    case get_intent(pid) do
      nil -> [intent]
      parent -> parent_chain(parent) ++ [intent]
    end
  end

  # ── Status Propagation (Superman pattern) ────────────────────────

  def propagate_status(%Intent{parent_id: nil}), do: :ok
  def propagate_status(%Intent{parent_id: pid}) do
    parent = get_intent(pid)
    if parent, do: recompute_completion(parent)
  end

  defp recompute_completion(parent) do
    children = Repo.all(from i in Intent, where: i.parent_id == ^parent.id)
    count = length(children)

    if count > 0 do
      complete_count = Enum.count(children, &(&1.status == "complete"))
      pct = round(complete_count / count * 100)

      new_status =
        cond do
          complete_count == count -> "complete"
          complete_count > 0 -> parent.status
          true -> parent.status
        end

      update_intent(parent, %{completion_pct: pct, status: new_status})
    end
  end

  defp maybe_search(query, nil), do: query
  defp maybe_search(query, ""), do: query

  defp maybe_search(query, term) do
    pattern = "%" <> term <> "%"

    where(
      query,
      [i],
      fragment("lower(?) like lower(?)", i.title, ^pattern) or
        fragment("lower(coalesce(?, '')) like lower(?)", i.description, ^pattern) or
        fragment("lower(coalesce(?, '')) like lower(?)", i.slug, ^pattern)
    )
  end

  # ── Links (semantic ↔ operational bridge) ─────────────────────────

  def link_intent(intent_id, linkable_type, linkable_id, opts \\ []) do
    attrs = %{
      intent_id: intent_id,
      linkable_type: linkable_type,
      linkable_id: linkable_id,
      role: opts[:role] || "related",
      provenance: opts[:provenance] || "manual"
    }

    %IntentLink{}
    |> IntentLink.changeset(attrs)
    |> Repo.insert(on_conflict: :nothing)
    |> tap_ok(fn link ->
      emit_event(intent_id, "linked", %{
        linkable_type: link.linkable_type,
        linkable_id: link.linkable_id,
        role: link.role
      })

      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "intents",
        {"intents:linked",
         %{
           intent_id: intent_id,
           link: serialize_link(link)
         }}
      )
    end)
  end

  def attach_actor(intent_id, actor_id, opts \\ []) do
    with %Intent{} <- get_intent(intent_id),
         actor when not is_nil(actor) <- Actors.get_actor(actor_id) || Actors.get_actor_by_slug(actor_id),
         {:ok, link} <-
           link_intent(intent_id, "actor", actor.id,
             role: opts[:role] || "assignee",
             provenance: opts[:provenance] || "manual"
           ) do
      {:ok, link}
    else
      nil -> {:error, :not_found}
      {:error, _} = error -> error
    end
  end

  def attach_execution(intent_id, execution_id, opts \\ []) do
    with %Intent{} <- get_intent(intent_id),
         %Executions.Execution{} <- Executions.get_execution(execution_id),
         {:ok, link} <-
           link_intent(intent_id, "execution", execution_id,
             role: opts[:role] || "runtime",
             provenance: opts[:provenance] || "execution"
           ) do
      {:ok, link}
    else
      nil -> {:error, :not_found}
      {:error, _} = error -> error
    end
  end

  def attach_session(intent_id, session_type, session_id, opts \\ []) do
    with %Intent{} <- get_intent(intent_id),
         {:ok, canonical_type} <- normalize_session_type(session_type),
         {:ok, _record} <- fetch_session_record(canonical_type, session_id),
         {:ok, link} <-
           link_intent(intent_id, canonical_type, session_id,
             role: opts[:role] || "runtime",
             provenance: opts[:provenance] || session_provenance(canonical_type)
           ) do
      {:ok, link}
    else
      nil -> {:error, :not_found}
      {:error, _} = error -> error
    end
  end

  def unlink_intent(intent_id, linkable_type, linkable_id) do
    from(l in IntentLink,
      where: l.intent_id == ^intent_id
        and l.linkable_type == ^linkable_type
        and l.linkable_id == ^linkable_id
    )
    |> Repo.delete_all()
    |> case do
      {n, _} when n > 0 ->
        emit_event(intent_id, "unlinked", %{
          linkable_type: linkable_type,
          linkable_id: linkable_id
        })
        {:ok, n}
      _ -> {:ok, 0}
    end
  end

  def get_links(intent_id, opts \\ []) do
    IntentLink
    |> where([l], l.intent_id == ^intent_id)
    |> maybe_filter(:linkable_type, opts[:type])
    |> maybe_filter(:role, opts[:role])
    |> order_by([l], desc: l.inserted_at)
    |> Repo.all()
  end

  # ── Lineage Events ───────────────────────────────────────────────

  def emit_event(intent_id, event_type, payload \\ %{}, actor \\ "system") do
    %IntentEvent{}
    |> IntentEvent.changeset(%{
      intent_id: intent_id,
      event_type: event_type,
      payload: Jason.encode!(payload),
      actor: actor
    })
    |> Repo.insert()
  end

  def get_lineage(intent_id, opts \\ []) do
    IntentEvent
    |> where([e], e.intent_id == ^intent_id)
    |> order_by([e], asc: e.inserted_at)
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  # ── Serialization ────────────────────────────────────────────────

  def serialize(%Intent{} = intent) do
    %{
      id: intent.id,
      title: intent.title,
      slug: intent.slug,
      description: intent.description,
      level: intent.level,
      level_name: Intent.level_name(intent.level),
      kind: intent.kind,
      parent_id: intent.parent_id,
      project_id: intent.project_id,
      source_type: intent.source_type,
      status: intent.status,
      phase: intent.phase,
      completion_pct: intent.completion_pct,
      clarity: intent.clarity,
      energy: intent.energy,
      priority: intent.priority,
      confidence: intent.confidence,
      provenance_class: intent.provenance_class,
      confirmed_at: intent.confirmed_at,
      tags: Intent.decode_tags(intent),
      metadata: Intent.decode_metadata(intent),
      inserted_at: intent.inserted_at,
      updated_at: intent.updated_at
    }
  end

  def serialize_tree(%Intent{} = intent) do
    serialize(intent)
    |> Map.put(:children, Enum.map(Map.get(intent, :children, []), &serialize_tree/1))
  end

  def serialize_link(%IntentLink{} = link) do
    %{
      id: link.id,
      intent_id: link.intent_id,
      linkable_type: link.linkable_type,
      linkable_id: link.linkable_id,
      role: link.role,
      provenance: link.provenance,
      inserted_at: link.inserted_at
    }
  end

  def serialize_event(%IntentEvent{} = event) do
    %{
      id: event.id,
      intent_id: event.intent_id,
      event_type: event.event_type,
      payload: IntentEvent.decode_payload(event),
      actor: event.actor,
      inserted_at: event.inserted_at
    }
  end

  def export_markdown(opts \\ []) do
    tree(opts)
    |> Enum.map_join("\n", &render_md_node(&1, 0))
  end

  defp render_md_node(node, depth) do
    indent = String.duplicate("  ", depth)
    icon = status_icon(node.status)
    children = Map.get(node, :children, [])
    line = "#{indent}#{icon} **#{node.title}** (#{Intent.level_name(node.level)}, #{node.status})"

    if children == [] do
      line
    else
      child_lines = Enum.map_join(children, "\n", &render_md_node(&1, depth + 1))
      "#{line}\n#{child_lines}"
    end
  end

  defp status_icon("complete"), do: "+"
  defp status_icon("active"), do: "~"
  defp status_icon("implementing"), do: "~"
  defp status_icon("blocked"), do: "!"
  defp status_icon(_), do: "o"

  defp hydrate_link(%IntentLink{} = link) do
    serialize_link(link)
    |> Map.put(:record, linked_record_summary(link))
  end

  defp linked_record_summary(%IntentLink{linkable_type: "actor", linkable_id: id}) do
    case Actors.get_actor(id) do
      nil -> nil
      actor -> %{id: actor.id, slug: actor.slug, name: actor.name, type: actor.actor_type, phase: actor.phase, status: actor.status}
    end
  end

  defp linked_record_summary(%IntentLink{linkable_type: "execution", linkable_id: id}) do
    case Executions.get_execution(id) do
      nil -> nil
      execution ->
        %{
          id: execution.id,
          title: execution.title,
          status: execution.status,
          mode: execution.mode,
          actor_id: execution.actor_id,
          session_id: execution.session_id,
          task_id: execution.task_id,
          proposal_id: execution.proposal_id
        }
    end
  end

  defp linked_record_summary(%IntentLink{linkable_type: "claude_session", linkable_id: id}) do
    case ClaudeSessions.get_session(id) do
      nil -> nil
      session -> %{id: session.id, session_id: session.session_id, status: session.status, project_id: session.project_id, last_active: session.last_active}
    end
  end

  defp linked_record_summary(%IntentLink{linkable_type: "ai_session", linkable_id: id}) do
    case Repo.get(AiSession, id) do
      nil -> nil
      session -> %{id: session.id, model: session.model, status: session.status, agent_id: session.agent_id, project_path: session.project_path}
    end
  end

  defp linked_record_summary(%IntentLink{linkable_type: "agent_session", linkable_id: id}) do
    case Repo.get(AgentSession, id) do
      nil -> nil
      session -> %{id: session.id, execution_id: session.execution_id, agent_role: session.agent_role, status: session.status, started_at: session.started_at}
    end
  end

  defp linked_record_summary(_link), do: nil

  defp normalize_session_type(type) when type in ~w(session claude_session ai_session agent_session),
    do: {:ok, if(type == "session", do: "claude_session", else: type)}

  defp normalize_session_type(_), do: {:error, "session_type must be one of: claude_session, ai_session, agent_session"}

  defp fetch_session_record("claude_session", id) do
    case ClaudeSessions.get_session(id) do
      nil -> {:error, :not_found}
      record -> {:ok, record}
    end
  end

  defp fetch_session_record("ai_session", id) do
    case Repo.get(AiSession, id) do
      nil -> {:error, :not_found}
      record -> {:ok, record}
    end
  end

  defp fetch_session_record("agent_session", id) do
    case Repo.get(AgentSession, id) do
      nil -> {:error, :not_found}
      record -> {:ok, record}
    end
  end

  defp session_provenance("claude_session"), do: "session"
  defp session_provenance("ai_session"), do: "session"
  defp session_provenance("agent_session"), do: "execution"

  # ── Helpers ──────────────────────────────────────────────────────

  defp maybe_filter(query, _field, nil), do: query
  defp maybe_filter(query, field, value) do
    where(query, [i], field(i, ^field) == ^value)
  end

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, limit), do: limit(query, ^limit)

  defp tap_ok({:ok, record} = result, fun) do
    fun.(record)
    result
  end
  defp tap_ok(error, _fun), do: error

  defp broadcast(topic, intent) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "intents", {topic, serialize(intent)})
  end
end
