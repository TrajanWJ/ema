defmodule Ema.Intents do
  @moduledoc """
  Context module for the Intent Engine.

  Canonical store for semantic truth: intents, edges, links, and lineage events.
  All mutations to intent tables go through this module.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Intents.{Intent, IntentLink, IntentEvent}

  # ── CRUD ─────────────────────────────────────────────────────────

  def list_intents(opts \\ []) do
    Intent
    |> maybe_filter(:project_id, opts[:project_id])
    |> maybe_filter(:level, opts[:level])
    |> maybe_filter(:status, opts[:status])
    |> maybe_filter(:kind, opts[:kind])
    |> maybe_filter(:parent_id, opts[:parent_id])
    |> maybe_filter(:source_type, opts[:source_type])
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
    end)
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
