defmodule Ema.MCP.WorkspaceTools do
  @moduledoc """
  MCP tools for agent workspace management — orientation, phase cadence,
  workspace state, intelligence surface, and codebase queries.

  Uses direct Elixir calls (not HTTP pass-through) since these run in the same BEAM.
  """

  alias Ema.{Actors, Intents}
  alias Ema.MCP.Orient

  @tool_names ~w(
    ema_orient
    ema_phase_transition ema_phase_status ema_sprint_cycle
    ema_workspace_data ema_workspace_tags ema_workspace_config
    ema_intelligence_gaps ema_intelligence_reflexion ema_intelligence_memory
    ema_codebase_ask ema_codebase_index
  )

  def tool_names, do: @tool_names

  # ── Tool Definitions ──

  def list do
    [
      # ── Orientation ──
      tool("ema_orient", "Orient yourself within EMA. Call this FIRST in every conversation. Returns briefing, capabilities, and behavioral directive based on mode.", %{
        "mode" => %{"type" => "string", "description" => "operator (helping user) or workspace (autonomous agent work)", "enum" => ["operator", "workspace"]},
        "actor_slug" => %{"type" => "string", "description" => "Actor slug (defaults to 'trajan' for operator, required for workspace)"}
      }, ["mode"]),

      # ── Phase Cadence ──
      tool("ema_phase_transition", "Advance an actor's phase in the executive cadence (plan → execute → review → retro → idle)", %{
        "actor_slug" => %{"type" => "string", "description" => "Actor slug"},
        "to_phase" => %{"type" => "string", "description" => "Target phase", "enum" => ["idle", "plan", "execute", "review", "retro"]},
        "reason" => %{"type" => "string", "description" => "Why this transition is happening"},
        "summary" => %{"type" => "string", "description" => "Summary of what was accomplished in the current phase"},
        "project_id" => %{"type" => "string", "description" => "Project context for this phase"},
        "week_number" => %{"type" => "number", "description" => "Sprint week number"}
      }, ["actor_slug", "to_phase"]),

      tool("ema_phase_status", "Get an actor's current phase, duration, and recent transition history", %{
        "actor_slug" => %{"type" => "string", "description" => "Actor slug"}
      }, ["actor_slug"]),

      tool("ema_sprint_cycle", "Manage accelerated planning cycles. Agents can compress week/month/quarter cadences into single conversations.", %{
        "actor_slug" => %{"type" => "string", "description" => "Actor slug"},
        "cycle_type" => %{"type" => "string", "description" => "Planning period", "enum" => ["week", "month", "quarter"]},
        "action" => %{"type" => "string", "description" => "start (get planning brief + transition to plan), review (check metrics), or complete (record + transition to idle)", "enum" => ["start", "review", "complete"]},
        "metrics" => %{"type" => "object", "description" => "Cycle completion metrics (for action=complete)", "properties" => %{
          "backlog_count" => %{"type" => "number"},
          "completed_count" => %{"type" => "number"},
          "carried_count" => %{"type" => "number"},
          "velocity" => %{"type" => "number"}
        }}
      }, ["actor_slug", "cycle_type", "action"]),

      # ── Workspace State ──
      tool("ema_workspace_data", "Get/set actor-scoped entity data — your persistent scratchpad across conversations", %{
        "actor_slug" => %{"type" => "string", "description" => "Actor slug"},
        "action" => %{"type" => "string", "description" => "get, set, or list", "enum" => ["get", "set", "list"]},
        "entity_type" => %{"type" => "string", "description" => "Entity type (e.g., sprint, task, project, cycle)"},
        "entity_id" => %{"type" => "string", "description" => "Entity ID"},
        "key" => %{"type" => "string", "description" => "Data key (required for get/set)"},
        "value" => %{"type" => "string", "description" => "Data value (required for set)"}
      }, ["actor_slug", "action", "entity_type", "entity_id"]),

      tool("ema_workspace_tags", "Tag entities from your actor's perspective — for priority, categorization, status", %{
        "actor_slug" => %{"type" => "string", "description" => "Actor slug"},
        "action" => %{"type" => "string", "description" => "tag, untag, or list", "enum" => ["tag", "untag", "list"]},
        "entity_type" => %{"type" => "string", "description" => "Entity type (task, project, execution, proposal, goal, brain_dump)"},
        "entity_id" => %{"type" => "string", "description" => "Entity ID"},
        "tag" => %{"type" => "string", "description" => "Tag name (required for tag/untag)"},
        "namespace" => %{"type" => "string", "description" => "Tag namespace (default, priority, domain, phase, status, custom)"}
      }, ["actor_slug", "action", "entity_type", "entity_id"]),

      tool("ema_workspace_config", "Get/set container-scoped configuration (space, project, or actor settings)", %{
        "container_type" => %{"type" => "string", "description" => "space, project, or actor"},
        "container_id" => %{"type" => "string", "description" => "Container ID"},
        "action" => %{"type" => "string", "description" => "get, set, or list", "enum" => ["get", "set", "list"]},
        "key" => %{"type" => "string", "description" => "Config key (required for get/set)"},
        "value" => %{"type" => "string", "description" => "Config value (required for set)"}
      }, ["container_type", "container_id", "action"]),

      # ── Intelligence Surface ──
      tool("ema_intelligence_gaps", "Surface operational gaps — stale tasks, orphan notes, incomplete goals", %{
        "project_id" => %{"type" => "string", "description" => "Filter by project"},
        "severity" => %{"type" => "string", "description" => "Filter by severity"},
        "limit" => %{"type" => "number", "description" => "Max results (default 20)"}
      }),

      tool("ema_intelligence_reflexion", "Query lessons learned from past executions", %{
        "agent" => %{"type" => "string", "description" => "Filter by agent slug"},
        "domain" => %{"type" => "string", "description" => "Filter by domain"},
        "project_slug" => %{"type" => "string", "description" => "Filter by project"},
        "limit" => %{"type" => "number", "description" => "Max results (default 10)"}
      }),

      tool("ema_intelligence_memory", "Query session memory fragments — decisions, insights, blockers from past sessions", %{
        "project_path" => %{"type" => "string", "description" => "Project path to search"},
        "query" => %{"type" => "string", "description" => "Search query"},
        "limit" => %{"type" => "number", "description" => "Max results (default 20)"}
      }),

      # ── Codebase Intelligence ──
      tool("ema_codebase_ask", "Ask about the codebase using local knowledge graph + vault search. Replaces CodeGraphContext/Superman.", %{
        "query" => %{"type" => "string", "description" => "Question about the codebase"},
        "project_slug" => %{"type" => "string", "description" => "Project to query (default: ema)"}
      }, ["query"]),

      tool("ema_codebase_index", "Trigger codebase indexing for a project — rebuilds knowledge graph", %{
        "project_slug" => %{"type" => "string", "description" => "Project slug to index"},
        "repo_path" => %{"type" => "string", "description" => "Repo path (alternative to project_slug)"}
      })
    ]
  end

  # ── Tool Dispatch ──

  def call("ema_orient", args, _request_id) do
    mode = case args["mode"] do
      "workspace" -> :workspace
      _ -> :operator
    end

    {:ok, Orient.briefing(mode, args["actor_slug"])}
  end

  def call("ema_phase_transition", args, _request_id) do
    with actor when not is_nil(actor) <- Actors.get_actor_by_slug(args["actor_slug"]),
         opts <- [
           reason: args["reason"],
           summary: args["summary"],
           project_id: args["project_id"],
           week_number: args["week_number"] && trunc(args["week_number"])
         ] |> Enum.reject(fn {_, v} -> is_nil(v) end),
         {:ok, updated} <- Actors.transition_phase(actor, args["to_phase"], opts) do
      {:ok, %{
        actor_slug: updated.slug,
        phase: updated.phase,
        phase_started_at: updated.phase_started_at && DateTime.to_iso8601(updated.phase_started_at),
        message: "Transitioned to #{updated.phase}"
      }}
    else
      nil -> {:error, "Actor '#{args["actor_slug"]}' not found"}
      {:error, changeset} -> {:error, inspect(changeset)}
    end
  end

  def call("ema_phase_status", args, _request_id) do
    case Actors.get_actor_by_slug(args["actor_slug"]) do
      nil ->
        {:error, "Actor '#{args["actor_slug"]}' not found"}

      actor ->
        transitions = Actors.list_phase_transitions(actor.id) |> Enum.take(10)

        {:ok, %{
          actor_slug: actor.slug,
          name: actor.name,
          current_phase: actor.phase,
          phase_started_at: actor.phase_started_at && DateTime.to_iso8601(actor.phase_started_at),
          phase_duration_minutes: phase_duration(actor),
          recent_transitions: Enum.map(transitions, fn t ->
            %{
              from: t.from_phase,
              to: t.to_phase,
              reason: t.reason,
              summary: t.summary,
              week: t.week_number,
              at: t.transitioned_at && DateTime.to_iso8601(t.transitioned_at)
            }
          end)
        }}
    end
  end

  def call("ema_sprint_cycle", args, _request_id) do
    case Actors.get_actor_by_slug(args["actor_slug"]) do
      nil ->
        {:error, "Actor '#{args["actor_slug"]}' not found"}

      actor ->
        handle_sprint_cycle(actor, args["cycle_type"], args["action"], args)
    end
  end

  def call("ema_workspace_data", args, _request_id) do
    case resolve_actor_id(args["actor_slug"]) do
      nil -> {:error, "Actor '#{args["actor_slug"]}' not found"}
      actor_id -> handle_workspace_data(actor_id, args)
    end
  end

  def call("ema_workspace_tags", args, _request_id) do
    case resolve_actor_id(args["actor_slug"]) do
      nil -> {:error, "Actor '#{args["actor_slug"]}' not found"}
      actor_id -> handle_workspace_tags(actor_id, args)
    end
  end

  def call("ema_workspace_config", args, _request_id) do
    handle_workspace_config(args)
  end

  def call("ema_intelligence_gaps", args, _request_id) do
    opts =
      [
        project_id: args["project_id"],
        severity: args["severity"],
        limit: args["limit"]
      ]
      |> Enum.reject(fn {_, v} -> is_nil(v) end)

    gaps = safe_call(fn -> Ema.Intelligence.GapInbox.list_gaps(opts) end) || []
    {:ok, %{gaps: gaps, count: length(gaps)}}
  end

  def call("ema_intelligence_reflexion", args, _request_id) do
    opts =
      [
        agent: args["agent"],
        domain: args["domain"],
        project_slug: args["project_slug"],
        limit: args["limit"] || 10
      ]
      |> Enum.reject(fn {_, v} -> is_nil(v) end)

    entries = safe_call(fn -> Ema.Intelligence.ReflexionStore.list_recent(opts) end) || []
    {:ok, %{entries: entries, count: length(entries)}}
  end

  def call("ema_intelligence_memory", args, _request_id) do
    result =
      cond do
        args["project_path"] ->
          safe_call(fn ->
            Ema.Intelligence.SessionMemory.context_for_project(
              args["project_path"],
              args["limit"] || 20
            )
          end)

        args["query"] ->
          safe_call(fn ->
            Ema.Intelligence.SessionMemory.context_for_project(
              args["query"],
              args["limit"] || 20
            )
          end)

        true ->
          %{context: "No project_path or query provided", fragment_count: 0}
      end

    {:ok, result || %{context: "No memory fragments found", fragment_count: 0}}
  end

  def call("ema_codebase_ask", args, _request_id) do
    project_slug = args["project_slug"] || "ema"

    repo_path =
      case Ema.Projects.get_project_by_slug(project_slug) do
        %{linked_path: path} when is_binary(path) -> path
        _ -> nil
      end

    Ema.Intelligence.SupermanClient.ask_codebase(args["query"], repo_path)
  end

  def call("ema_codebase_index", args, _request_id) do
    repo_path =
      cond do
        args["repo_path"] ->
          args["repo_path"]

        args["project_slug"] ->
          case Ema.Projects.get_project_by_slug(args["project_slug"]) do
            %{linked_path: path} when is_binary(path) -> path
            _ -> nil
          end

        true ->
          nil
      end

    case repo_path do
      nil -> {:error, "No repo_path or valid project_slug provided"}
      path -> Ema.Intelligence.SupermanClient.index_repo(path)
    end
  end

  def call(name, _args, _request_id) do
    {:error, "Unknown workspace tool: #{name}"}
  end

  # ── Sprint Cycle Handlers ──

  defp handle_sprint_cycle(actor, cycle_type, "start", _args) do
    metrics = Actors.get_cycle_metrics(actor.id, cycle_type)

    # Fetch context for planning brief
    active_intents = safe_call(fn -> Intents.list_intents(status: "active") end) || []
    pending_tasks = safe_call(fn -> Ema.Tasks.list_by_status("pending") end) || []
    blocked_tasks = safe_call(fn -> Ema.Tasks.list_by_status("blocked") end) || []

    # Auto-transition to plan phase
    transition_result =
      if actor.phase != "plan" do
        Actors.transition_phase(actor, "plan",
          reason: "#{cycle_type}_cycle_start",
          summary: "Starting #{cycle_type} planning cycle"
        )
      else
        {:ok, actor}
      end

    case transition_result do
      {:ok, updated} ->
        now = DateTime.utc_now() |> DateTime.to_iso8601()
        Actors.set_data(actor.id, "cycle", metrics.cycle_id, "status", "active")
        Actors.set_data(actor.id, "cycle", metrics.cycle_id, "started_at", now)

        {:ok, %{
          cycle_id: metrics.cycle_id,
          cycle_type: cycle_type,
          status: "started",
          phase: updated.phase,
          previous_cycle: %{
            completed_count: metrics.completed_count,
            carried_count: metrics.carried_count,
            velocity: metrics.velocity
          },
          planning_context: %{
            active_intents: length(active_intents),
            pending_tasks: length(pending_tasks),
            blocked_tasks: length(blocked_tasks),
            intent_summary: Enum.take(active_intents, 10) |> Enum.map(fn i ->
              %{id: i.id, title: i.title, level: i.level, status: i.status}
            end),
            pending_task_summary: Enum.take(pending_tasks, 10) |> Enum.map(fn t ->
              %{id: t.id, title: t.title, priority: t.priority}
            end)
          },
          message: "#{cycle_type} cycle started. You are now in plan phase. Review the planning context, set priorities, then transition to execute."
        }}

      {:error, reason} ->
        {:error, "Failed to transition to plan phase: #{inspect(reason)}"}
    end
  end

  defp handle_sprint_cycle(actor, cycle_type, "review", _args) do
    metrics = Actors.get_cycle_metrics(actor.id, cycle_type)

    {:ok, %{
      cycle_id: metrics.cycle_id,
      cycle_type: cycle_type,
      status: metrics.status,
      current_phase: actor.phase,
      metrics: %{
        backlog_count: metrics.backlog_count,
        completed_count: metrics.completed_count,
        carried_count: metrics.carried_count,
        velocity: metrics.velocity
      },
      transitions: Enum.map(metrics.transitions, fn t ->
        %{from: t.from_phase, to: t.to_phase, reason: t.reason, summary: t.summary}
      end)
    }}
  end

  defp handle_sprint_cycle(actor, cycle_type, "complete", args) do
    metrics_input = args["metrics"] || %{}

    completion_metrics = %{
      backlog_count: metrics_input["backlog_count"] || 0,
      completed_count: metrics_input["completed_count"] || 0,
      carried_count: metrics_input["carried_count"] || 0,
      velocity: metrics_input["velocity"] || 0
    }

    with {:ok, result} <- Actors.record_cycle_completion(actor.id, cycle_type, completion_metrics),
         {:ok, updated} <- Actors.transition_phase(actor, "idle",
           reason: "#{cycle_type}_cycle_complete",
           summary: "Completed #{cycle_type} cycle: #{completion_metrics.completed_count} items done, #{completion_metrics.carried_count} carried"
         ) do
      {:ok, Map.merge(result, %{
        phase: updated.phase,
        message: "#{cycle_type} cycle completed. Transitioned to idle. Call start to begin next cycle."
      })}
    else
      {:error, reason} -> {:error, "Failed to complete cycle: #{inspect(reason)}"}
    end
  end

  defp handle_sprint_cycle(_actor, _cycle_type, action, _args) do
    {:error, "Unknown sprint_cycle action: #{action}. Use start, review, or complete."}
  end

  # ── Workspace Data Handlers ──

  defp handle_workspace_data(actor_id, %{"action" => "get"} = args) do
    case Actors.get_data(actor_id, args["entity_type"], args["entity_id"], args["key"]) do
      nil -> {:ok, %{found: false, key: args["key"]}}
      ed -> {:ok, %{found: true, key: ed.key, value: ed.value}}
    end
  end

  defp handle_workspace_data(actor_id, %{"action" => "set"} = args) do
    case Actors.set_data(actor_id, args["entity_type"], args["entity_id"], args["key"], args["value"]) do
      {:ok, ed} -> {:ok, %{key: ed.key, value: ed.value, message: "Data set"}}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  defp handle_workspace_data(actor_id, %{"action" => "list"} = args) do
    data = Actors.list_data(actor_id, args["entity_type"], args["entity_id"])
    {:ok, %{data: Enum.map(data, fn ed -> %{key: ed.key, value: ed.value} end), count: length(data)}}
  end

  defp handle_workspace_data(_actor_id, %{"action" => action}) do
    {:error, "Unknown action: #{action}. Use get, set, or list."}
  end

  # ── Workspace Tags Handlers ──

  defp handle_workspace_tags(actor_id, %{"action" => "tag"} = args) do
    namespace = args["namespace"] || "default"

    case Actors.tag_entity(args["entity_type"], args["entity_id"], args["tag"], actor_id, namespace) do
      {:ok, tag} -> {:ok, %{tag: tag.tag, entity_type: args["entity_type"], entity_id: args["entity_id"], message: "Tagged"}}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  defp handle_workspace_tags(actor_id, %{"action" => "untag"} = args) do
    {count, _} = Actors.untag_entity(args["entity_type"], args["entity_id"], args["tag"], actor_id)
    {:ok, %{removed: count, message: "Untagged"}}
  end

  defp handle_workspace_tags(_actor_id, %{"action" => "list"} = args) do
    tags = Actors.tags_for_entity(args["entity_type"], args["entity_id"])
    {:ok, %{tags: Enum.map(tags, fn t -> %{tag: t.tag, actor_id: t.actor_id, namespace: t.namespace} end), count: length(tags)}}
  end

  defp handle_workspace_tags(_actor_id, %{"action" => action}) do
    {:error, "Unknown action: #{action}. Use tag, untag, or list."}
  end

  # ── Workspace Config Handlers ──

  defp handle_workspace_config(%{"action" => "get"} = args) do
    case Actors.get_config(args["container_type"], args["container_id"], args["key"]) do
      nil -> {:ok, %{found: false, key: args["key"]}}
      config -> {:ok, %{found: true, key: config.key, value: config.value}}
    end
  end

  defp handle_workspace_config(%{"action" => "set"} = args) do
    case Actors.set_config(args["container_type"], args["container_id"], args["key"], args["value"]) do
      {:ok, config} -> {:ok, %{key: config.key, value: config.value, message: "Config set"}}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  defp handle_workspace_config(%{"action" => "list"} = args) do
    configs = Actors.list_config(args["container_type"], args["container_id"])
    {:ok, %{configs: Enum.map(configs, fn c -> %{key: c.key, value: c.value} end), count: length(configs)}}
  end

  defp handle_workspace_config(%{"action" => action}) do
    {:error, "Unknown action: #{action}. Use get, set, or list."}
  end

  # ── Helpers ──

  defp resolve_actor_id(slug) do
    case Actors.get_actor_by_slug(slug) do
      %{id: id} -> id
      nil -> nil
    end
  end

  defp phase_duration(%{phase_started_at: nil}), do: nil
  defp phase_duration(%{phase_started_at: started_at}) do
    DateTime.diff(DateTime.utc_now(), started_at, :second) |> div(60)
  end

  defp safe_call(fun) do
    fun.()
  rescue
    _ -> nil
  end

  defp tool(name, description, properties, required \\ []) do
    %{
      "name" => name,
      "description" => description,
      "inputSchema" => %{
        "type" => "object",
        "properties" => properties,
        "required" => required
      }
    }
  end
end
