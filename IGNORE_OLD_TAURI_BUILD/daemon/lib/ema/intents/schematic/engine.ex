defmodule Ema.Intents.Schematic.Engine do
  @moduledoc """
  Orchestrator for the Intentions Schematic Engine.

  Flow for an NL update against a dotted scope path:

      1. Resolve target via `Target.parse/1` + `Target.resolve/1`
      2. Check `ModificationToggle.allowed?/1`
      3. Gather context (existing intents, open contradictions, recent updates)
      4. Call `UpdateParser.parse/2` to get a structured plan from Claude
      5. Apply the plan inside a `Repo.transaction`
      6. Persist an `UpdateLog` row recording everything

  Failure at any step writes a log row with `applied: false` and an
  `error` string before returning `{:error, ...}`.
  """

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Intents
  alias Ema.Intents.Intent
  alias Ema.Intents.Schematic.{
    Aspiration,
    Contradiction,
    FeedItem,
    ModificationToggle,
    Target,
    UpdateLog,
    UpdateParser
  }

  @doc """
  Apply a freeform NL update to the schematic at `scope_path`.

  Options:

    * `:actor_id` — actor performing the update (defaults to nil)

  Returns `{:ok, result_map}` on success or `{:error, reason}`.
  """
  @spec update(String.t(), String.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def update(scope_path, text, opts \\ []) when is_binary(scope_path) and is_binary(text) do
    actor_id = Keyword.get(opts, :actor_id)

    with {:ok, target} <- resolve_target(scope_path),
         :ok <- check_toggle(scope_path, text, actor_id),
         context <- gather_context(scope_path, target),
         {:ok, plan} <- parse_plan(text, context, scope_path, actor_id) do
      apply_and_log(plan, target, scope_path, text, actor_id)
    end
  end

  @doc """
  Build the context map UpdateParser expects: existing intents in scope,
  open contradictions for the scope, and the last 5 update log entries.
  """
  @spec gather_context(String.t(), map()) :: map()
  def gather_context(scope_path, target) do
    %{
      scope_path: scope_path,
      existing_intents: Target.intents_in_scope(target),
      open_contradictions: list_open_contradictions(scope_path),
      recent_updates: list_recent_updates(scope_path, 5)
    }
  end

  # ── Step helpers ─────────────────────────────────────────────────

  defp resolve_target(scope_path) do
    _ = Target.parse(scope_path)

    case Target.resolve(scope_path) do
      {:ok, target} -> {:ok, target}
      {:error, reason} -> {:error, {:invalid_target, reason}}
    end
  end

  defp check_toggle(scope_path, text, actor_id) do
    case ModificationToggle.allowed?(scope_path) do
      :ok ->
        :ok

      {:error, :disabled, reason} ->
        insert_log(%{
          scope_path: scope_path,
          input_text: text,
          parsed_mutations: %{},
          applied: false,
          actor_id: actor_id,
          error: "disabled: #{reason}"
        })

        {:error, {:disabled, reason}}
    end
  end

  defp parse_plan(text, context, scope_path, actor_id) do
    case UpdateParser.parse(text, context) do
      {:ok, plan} ->
        {:ok, plan}

      {:error, reason} ->
        insert_log(%{
          scope_path: scope_path,
          input_text: text,
          parsed_mutations: %{},
          applied: false,
          actor_id: actor_id,
          error: "parse_failed: #{inspect(reason)}"
        })

        {:error, reason}
    end
  end

  defp apply_and_log(plan, target, scope_path, text, actor_id) do
    case Repo.transaction(fn -> apply_plan(plan, target, scope_path) end) do
      {:ok, %{affected: affected, contradictions: cids, clarifications: clids, aspirations: aids}} ->
        {:ok, log} =
          insert_log(%{
            scope_path: scope_path,
            input_text: text,
            parsed_mutations: plan,
            applied: true,
            affected_intent_ids: affected,
            contradictions_raised: cids,
            clarifications_raised: clids,
            actor_id: actor_id
          })

        broadcast_schematic_event(:update)

        {:ok,
         %{
           plan: plan,
           affected: affected,
           contradictions: cids,
           clarifications: clids,
           aspirations: aids,
           log_id: log.id
         }}

      {:error, reason} ->
        insert_log(%{
          scope_path: scope_path,
          input_text: text,
          parsed_mutations: plan,
          applied: false,
          actor_id: actor_id,
          error: "apply_failed: #{inspect(reason)}"
        })

        {:error, {:apply_failed, reason}}
    end
  end

  # ── Plan application (runs inside Repo.transaction) ──────────────

  defp apply_plan(plan, target, scope_path) do
    affected = apply_mutations(plan["mutations"] || [], target)
    contradiction_ids = apply_contradictions(plan["contradictions"] || [], scope_path)
    clarification_ids = apply_clarifications(plan["clarifications_needed"] || [], scope_path, target)
    aspiration_ids = apply_aspirations(plan["aspirations"] || [], scope_path)

    %{
      affected: affected,
      contradictions: contradiction_ids,
      clarifications: clarification_ids,
      aspirations: aspiration_ids
    }
  end

  defp apply_mutations(mutations, target) when is_list(mutations) do
    mutations
    |> Enum.map(&apply_mutation(&1, target))
    |> Enum.reject(&is_nil/1)
  end

  defp apply_mutation(%{"action" => "create", "intent" => intent_attrs}, target) do
    attrs = build_intent_attrs(intent_attrs, target)

    case Intents.create_intent(attrs) do
      {:ok, intent} -> intent.id
      {:error, changeset} -> Repo.rollback({:create_failed, changeset})
    end
  end

  defp apply_mutation(%{"action" => "update", "intent" => intent_attrs}, target) do
    slug = intent_attrs["slug"]

    case slug && Intents.get_intent_by_slug(slug) do
      %Intent{} = existing ->
        attrs = build_intent_attrs(intent_attrs, target) |> Map.drop([:source_type])

        case Intents.update_intent(existing, attrs) do
          {:ok, updated} -> updated.id
          {:error, changeset} -> Repo.rollback({:update_failed, changeset})
        end

      _ ->
        # No matching intent → fall through to create.
        apply_mutation(%{"action" => "create", "intent" => intent_attrs}, target)
    end
  end

  defp apply_mutation(%{"action" => "reparent", "intent" => intent_attrs}, _target) do
    slug = intent_attrs["slug"]
    parent_slug = intent_attrs["parent_slug"]

    with %Intent{} = intent <- slug && Intents.get_intent_by_slug(slug),
         %Intent{} = parent <- parent_slug && Intents.get_intent_by_slug(parent_slug) do
      case Intents.set_parent(intent.id, parent.id) do
        {:ok, _} -> intent.id
        {:error, reason} -> Repo.rollback({:reparent_failed, reason})
      end
    else
      _ -> nil
    end
  end

  defp apply_mutation(%{"action" => "delete", "intent" => %{"slug" => slug}}, _target)
       when is_binary(slug) do
    case Intents.get_intent_by_slug(slug) do
      %Intent{} = intent ->
        case Intents.delete_intent(intent) do
          {:ok, deleted} -> deleted.id
          {:error, reason} -> Repo.rollback({:delete_failed, reason})
        end

      _ ->
        nil
    end
  end

  defp apply_mutation(_other, _target), do: nil

  defp build_intent_attrs(attrs, target) do
    parent_id =
      case attrs["parent_slug"] do
        slug when is_binary(slug) and slug != "" ->
          case Intents.get_intent_by_slug(slug) do
            %Intent{id: id} -> id
            _ -> nil
          end

        _ ->
          nil
      end

    project_id =
      cond do
        match?(%{subproject: %{id: _}}, target) -> target.subproject.id
        match?(%{project: %{id: _}}, target) -> target.project.id
        true -> nil
      end

    description =
      [attrs["summary"], attrs["rationale"]]
      |> Enum.reject(&(&1 in [nil, ""]))
      |> Enum.join("\n\n")

    %{
      title: attrs["title"],
      slug: attrs["slug"],
      kind: normalize_kind(attrs["kind"]),
      level: attrs["level"] || 4,
      description: description,
      parent_id: parent_id,
      project_id: project_id,
      source_type: "manual"
    }
    |> reject_nil_values()
  end

  defp normalize_kind("vision"), do: "goal"
  defp normalize_kind("project"), do: "feature"
  defp normalize_kind(kind) when kind in ~w(goal question task feature exploration fix audit system),
    do: kind
  defp normalize_kind(_), do: "task"

  defp reject_nil_values(map) do
    Enum.reject(map, fn {_k, v} -> is_nil(v) end) |> Map.new()
  end

  defp apply_contradictions(list, scope_path) when is_list(list) do
    list
    |> Enum.map(&insert_contradiction(&1, scope_path))
    |> Enum.reject(&is_nil/1)
  end

  defp insert_contradiction(%{"intent_slugs" => slugs} = entry, scope_path) when is_list(slugs) do
    intents =
      slugs
      |> Enum.map(&Intents.get_intent_by_slug/1)
      |> Enum.reject(&is_nil/1)

    case intents do
      [a | rest] ->
        b = List.first(rest)

        attrs = %{
          scope_path: scope_path,
          intent_a_id: a.id,
          intent_b_id: b && b.id,
          description: entry["description"] || "(no description)",
          severity: entry["severity"] || "medium",
          detected_by: "schematic_engine"
        }

        case %Contradiction{} |> Contradiction.changeset(attrs) |> Repo.insert() do
          {:ok, c} -> c.id
          {:error, reason} -> Repo.rollback({:contradiction_failed, reason})
        end

      [] ->
        nil
    end
  end

  defp insert_contradiction(_, _), do: nil

  defp apply_clarifications(list, scope_path, target) when is_list(list) do
    target_intent_id =
      case target do
        %{intent: %{id: id}} -> id
        _ -> nil
      end

    list
    |> Enum.map(&insert_clarification(&1, scope_path, target_intent_id))
    |> Enum.reject(&is_nil/1)
  end

  defp insert_clarification(entry, scope_path, target_intent_id) when is_map(entry) do
    attrs = %{
      feed_type: "clarification",
      scope_path: scope_path,
      target_intent_id: target_intent_id,
      title: entry["title"] || "(untitled)",
      context: entry["context"],
      options: entry["options"] || %{},
      status: "open"
    }

    case %FeedItem{} |> FeedItem.changeset(attrs) |> Repo.insert() do
      {:ok, item} -> item.id
      {:error, reason} -> Repo.rollback({:clarification_failed, reason})
    end
  end

  defp insert_clarification(_, _, _), do: nil

  defp apply_aspirations(list, scope_path) when is_list(list) do
    list
    |> Enum.map(&insert_aspiration(&1, scope_path))
    |> Enum.reject(&is_nil/1)
  end

  defp insert_aspiration(entry, scope_path) when is_map(entry) do
    attrs = %{
      scope_path: scope_path,
      title: entry["title"] || "(untitled)",
      description: entry["description"],
      horizon: normalize_horizon(entry["horizon"]),
      status: "stacked"
    }

    case %Aspiration{} |> Aspiration.changeset(attrs) |> Repo.insert() do
      {:ok, asp} -> asp.id
      {:error, reason} -> Repo.rollback({:aspiration_failed, reason})
    end
  end

  defp insert_aspiration(_, _), do: nil

  # Aspiration schema accepts: short, medium, long, lifetime.
  # The plan contract uses "ideal" — map it to "lifetime".
  defp normalize_horizon("ideal"), do: "lifetime"
  defp normalize_horizon(h) when h in ~w(short medium long lifetime), do: h
  defp normalize_horizon(_), do: "long"

  # ── Context helpers ──────────────────────────────────────────────

  defp list_open_contradictions(scope_path) do
    Repo.all(
      from c in Contradiction,
        where: c.scope_path == ^scope_path and c.status == "open",
        order_by: [desc: c.inserted_at],
        limit: 20
    )
  end

  defp list_recent_updates(scope_path, limit) do
    Repo.all(
      from l in UpdateLog,
        where: l.scope_path == ^scope_path,
        order_by: [desc: l.inserted_at],
        limit: ^limit
    )
  end

  # ── Logging ──────────────────────────────────────────────────────

  defp insert_log(attrs) do
    %UpdateLog{}
    |> UpdateLog.changeset(attrs)
    |> Repo.insert()
  end

  # ── Event broadcast ──────────────────────────────────────────────

  # Best-effort broadcast — never crash the engine if PubSub isn't running
  # (e.g. in CLI / escript mode).
  defp broadcast_schematic_event(kind) do
    if Process.whereis(Ema.PubSub) do
      try do
        Phoenix.PubSub.broadcast(Ema.PubSub, "schematic:state", {:schematic_event, kind})
      rescue
        _ -> :ok
      catch
        _, _ -> :ok
      end
    end

    :ok
  end
end
