defmodule Ema.MCP.WorkspaceTools do
  @moduledoc """
  MCP tools for agent workspace, intelligence, and executive management.
  Direct Elixir calls — no HTTP round-trip.
  """

  alias Ema.{Actors, Intents}
  alias Ema.MCP.Orient

  @tool_names ~w(
    ema_orient
    ema_phase_transition ema_phase_status ema_sprint_cycle
    ema_workspace
    ema_search ema_decide ema_dispatch
    ema_intelligence_gaps ema_intelligence_reflexion ema_intelligence_memory
    ema_codebase_ask ema_codebase_index
  )

  def tool_names, do: @tool_names

  def list do
    [
      # ── Orientation ──
      tool(
        "ema_orient",
        "Get current EMA state and orientation. Call first in conversations.",
        %{
          "mode" => %{"type" => "string", "enum" => ["operator", "workspace"]},
          "actor_slug" => %{"type" => "string"}
        },
        ["mode"]
      ),

      # ── Phase Cadence ──
      tool(
        "ema_phase_transition",
        "Advance actor phase: idle → plan → execute → review → retro",
        %{
          "actor_slug" => %{"type" => "string"},
          "to_phase" => %{
            "type" => "string",
            "enum" => ["idle", "plan", "execute", "review", "retro"]
          },
          "reason" => %{"type" => "string"},
          "summary" => %{"type" => "string"},
          "project_id" => %{"type" => "string"},
          "week_number" => %{"type" => "number"}
        },
        ["actor_slug", "to_phase"]
      ),
      tool(
        "ema_phase_status",
        "Current phase + recent transition history for an actor",
        %{
          "actor_slug" => %{"type" => "string"}
        },
        ["actor_slug"]
      ),
      tool(
        "ema_sprint_cycle",
        "Start/review/complete accelerated planning cycles (week/month/quarter)",
        %{
          "actor_slug" => %{"type" => "string"},
          "cycle_type" => %{"type" => "string", "enum" => ["week", "month", "quarter"]},
          "action" => %{"type" => "string", "enum" => ["start", "review", "complete"]},
          "metrics" => %{
            "type" => "object",
            "properties" => %{
              "backlog_count" => %{"type" => "number"},
              "completed_count" => %{"type" => "number"},
              "carried_count" => %{"type" => "number"},
              "velocity" => %{"type" => "number"}
            }
          }
        },
        ["actor_slug", "cycle_type", "action"]
      ),

      # ── Unified Workspace (replaces data + tags + config) ──
      tool(
        "ema_workspace",
        "Actor workspace: persist data, tag entities, set config. One tool for all workspace state.",
        %{
          "op" => %{
            "type" => "string",
            "description" =>
              "data_get|data_set|data_list|tag|untag|tags|config_get|config_set|config_list"
          },
          "actor_slug" => %{"type" => "string"},
          "entity_type" => %{"type" => "string"},
          "entity_id" => %{"type" => "string"},
          "key" => %{"type" => "string"},
          "value" => %{"type" => "string"},
          "tag" => %{"type" => "string"},
          "namespace" => %{"type" => "string"},
          "container_type" => %{
            "type" => "string",
            "description" => "For config ops: space|project|actor"
          },
          "container_id" => %{"type" => "string", "description" => "For config ops"}
        },
        ["op"]
      ),

      # ── New Features ──
      tool(
        "ema_search",
        "Unified search across all EMA entities — tasks, intents, vault, proposals, brain dumps",
        %{
          "query" => %{"type" => "string"},
          "scope" => %{
            "type" => "string",
            "description" => "all|tasks|intents|vault|proposals|brain_dumps (default: all)"
          },
          "project_id" => %{"type" => "string"},
          "limit" => %{"type" => "number"}
        },
        ["query"]
      ),
      tool(
        "ema_decide",
        "Record a decision with rationale — persisted in vault and linked to intent/project",
        %{
          "title" => %{
            "type" => "string",
            "description" => "Decision title (e.g. 'Use ETS over Redis for KG')"
          },
          "rationale" => %{"type" => "string", "description" => "Why this decision was made"},
          "alternatives" => %{"type" => "string", "description" => "Alternatives considered"},
          "project_slug" => %{"type" => "string"},
          "intent_id" => %{"type" => "string"}
        },
        ["title", "rationale"]
      ),
      tool(
        "ema_dispatch",
        "Dispatch an execution — create and optionally auto-approve for immediate agent work",
        %{
          "title" => %{"type" => "string"},
          "objective" => %{"type" => "string"},
          "mode" => %{
            "type" => "string",
            "enum" => ["research", "outline", "implement", "review", "harvest", "refactor"]
          },
          "project_slug" => %{"type" => "string"},
          "intent_id" => %{"type" => "string"},
          "auto_approve" => %{
            "type" => "boolean",
            "description" => "Skip approval gate (default false)"
          }
        },
        ["title", "objective", "mode"]
      ),

      # ── Intelligence ──
      tool(
        "ema_intelligence_gaps",
        "Operational gaps — stale tasks, orphan notes, incomplete goals",
        %{
          "project_id" => %{"type" => "string"},
          "limit" => %{"type" => "number"}
        }
      ),
      tool(
        "ema_intelligence_reflexion",
        "Lessons from past executions — what worked, what failed",
        %{
          "agent" => %{"type" => "string"},
          "project_slug" => %{"type" => "string"},
          "limit" => %{"type" => "number"}
        }
      ),
      tool(
        "ema_intelligence_memory",
        "Session memory fragments — decisions, blockers, insights from past work",
        %{
          "project_path" => %{"type" => "string"},
          "query" => %{"type" => "string"},
          "limit" => %{"type" => "number"}
        }
      ),

      # ── Codebase ──
      tool(
        "ema_codebase_ask",
        "Query codebase via local knowledge graph + vault. Replaces CodeGraphContext/Superman.",
        %{
          "query" => %{"type" => "string"},
          "project_slug" => %{"type" => "string"}
        },
        ["query"]
      ),
      tool("ema_codebase_index", "Rebuild knowledge graph for a project's codebase", %{
        "project_slug" => %{"type" => "string"},
        "repo_path" => %{"type" => "string"}
      })
    ]
  end

  # ── Dispatch ──

  def call("ema_orient", args, _rid) do
    mode = if args["mode"] == "workspace", do: :workspace, else: :operator
    {:ok, Orient.briefing(mode, args["actor_slug"])}
  end

  def call("ema_phase_transition", args, _rid) do
    with actor when not is_nil(actor) <- Actors.get_actor_by_slug(args["actor_slug"]),
         opts <-
           compact_opts(
             reason: args["reason"],
             summary: args["summary"],
             project_id: args["project_id"],
             week_number: args["week_number"] && trunc(args["week_number"])
           ),
         {:ok, updated} <- Actors.transition_phase(actor, args["to_phase"], opts) do
      {:ok, %{slug: updated.slug, phase: updated.phase}}
    else
      nil -> {:error, "Actor not found: #{args["actor_slug"]}"}
      {:error, e} -> {:error, inspect(e)}
    end
  end

  def call("ema_phase_status", args, _rid) do
    case Actors.get_actor_by_slug(args["actor_slug"]) do
      nil ->
        {:error, "Actor not found: #{args["actor_slug"]}"}

      actor ->
        transitions = Actors.list_phase_transitions(actor.id) |> Enum.take(10)

        {:ok,
         %{
           slug: actor.slug,
           phase: actor.phase,
           minutes_in_phase: phase_minutes(actor),
           transitions:
             Enum.map(transitions, fn t ->
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

  def call("ema_sprint_cycle", args, _rid) do
    case Actors.get_actor_by_slug(args["actor_slug"]) do
      nil -> {:error, "Actor not found: #{args["actor_slug"]}"}
      actor -> handle_sprint_cycle(actor, args["cycle_type"], args["action"], args)
    end
  end

  def call("ema_workspace", args, _rid), do: handle_workspace(args)

  def call("ema_search", args, _rid), do: handle_search(args)

  def call("ema_decide", args, _rid), do: handle_decide(args)

  def call("ema_dispatch", args, _rid), do: handle_dispatch(args)

  def call("ema_intelligence_gaps", args, _rid) do
    opts = compact_opts(project_id: args["project_id"], limit: args["limit"])
    gaps = safe_call(fn -> Ema.Intelligence.GapInbox.list_gaps(opts) end) || []
    {:ok, %{gaps: gaps, count: length(gaps)}}
  end

  def call("ema_intelligence_reflexion", args, _rid) do
    opts =
      compact_opts(
        agent: args["agent"],
        project_slug: args["project_slug"],
        limit: args["limit"] || 10
      )

    entries = safe_call(fn -> Ema.Intelligence.ReflexionStore.list_recent(opts) end) || []
    {:ok, %{entries: entries, count: length(entries)}}
  end

  def call("ema_intelligence_memory", args, _rid) do
    path = args["project_path"] || args["query"]

    case path do
      nil ->
        {:ok, %{context: "Provide project_path or query", fragment_count: 0}}

      p ->
        result =
          safe_call(fn ->
            Ema.Intelligence.SessionMemory.context_for_project(p, args["limit"] || 20)
          end)

        {:ok, result || %{context: "No fragments found", fragment_count: 0}}
    end
  end

  def call("ema_codebase_ask", args, _rid) do
    slug = args["project_slug"] || "ema"

    repo_path =
      case Ema.Projects.get_project_by_slug(slug) do
        %{linked_path: p} when is_binary(p) -> p
        _ -> nil
      end

    Ema.Intelligence.SupermanClient.ask_codebase(args["query"], repo_path)
  end

  def call("ema_codebase_index", args, _rid) do
    repo_path =
      args["repo_path"] ||
        case args["project_slug"] do
          nil ->
            nil

          slug ->
            case Ema.Projects.get_project_by_slug(slug) do
              %{linked_path: p} when is_binary(p) -> p
              _ -> nil
            end
        end

    case repo_path do
      nil -> {:error, "No repo_path or project_slug"}
      path -> Ema.Intelligence.SupermanClient.index_repo(path)
    end
  end

  def call(name, _args, _rid), do: {:error, "Unknown tool: #{name}"}

  # ── Unified Workspace ──

  defp handle_workspace(%{"op" => "data_get", "actor_slug" => slug} = a) do
    with_actor(slug, fn id ->
      case Actors.get_data(id, a["entity_type"], a["entity_id"], a["key"]) do
        nil -> {:ok, %{found: false}}
        ed -> {:ok, %{found: true, key: ed.key, value: ed.value}}
      end
    end)
  end

  defp handle_workspace(%{"op" => "data_set", "actor_slug" => slug} = a) do
    with_actor(slug, fn id ->
      case Actors.set_data(id, a["entity_type"], a["entity_id"], a["key"], a["value"]) do
        {:ok, ed} -> {:ok, %{key: ed.key, value: ed.value}}
        {:error, e} -> {:error, inspect(e)}
      end
    end)
  end

  defp handle_workspace(%{"op" => "data_list", "actor_slug" => slug} = a) do
    with_actor(slug, fn id ->
      data = Actors.list_data(id, a["entity_type"], a["entity_id"])
      {:ok, %{data: Enum.map(data, fn d -> %{key: d.key, value: d.value} end)}}
    end)
  end

  defp handle_workspace(%{"op" => "tag", "actor_slug" => slug} = a) do
    with_actor(slug, fn id ->
      ns = a["namespace"] || "default"

      case Actors.tag_entity(a["entity_type"], a["entity_id"], a["tag"], id, ns) do
        {:ok, _} -> {:ok, %{tagged: true}}
        {:error, e} -> {:error, inspect(e)}
      end
    end)
  end

  defp handle_workspace(%{"op" => "untag", "actor_slug" => slug} = a) do
    with_actor(slug, fn id ->
      {n, _} = Actors.untag_entity(a["entity_type"], a["entity_id"], a["tag"], id)
      {:ok, %{removed: n}}
    end)
  end

  defp handle_workspace(%{"op" => "tags"} = a) do
    tags = Actors.tags_for_entity(a["entity_type"], a["entity_id"])

    {:ok,
     %{tags: Enum.map(tags, fn t -> %{tag: t.tag, actor_id: t.actor_id, ns: t.namespace} end)}}
  end

  defp handle_workspace(%{"op" => "config_get"} = a) do
    case Actors.get_config(a["container_type"], a["container_id"], a["key"]) do
      nil -> {:ok, %{found: false}}
      c -> {:ok, %{found: true, key: c.key, value: c.value}}
    end
  end

  defp handle_workspace(%{"op" => "config_set"} = a) do
    case Actors.set_config(a["container_type"], a["container_id"], a["key"], a["value"]) do
      {:ok, c} -> {:ok, %{key: c.key, value: c.value}}
      {:error, e} -> {:error, inspect(e)}
    end
  end

  defp handle_workspace(%{"op" => "config_list"} = a) do
    configs = Actors.list_config(a["container_type"], a["container_id"])
    {:ok, %{configs: Enum.map(configs, fn c -> %{key: c.key, value: c.value} end)}}
  end

  defp handle_workspace(%{"op" => op}), do: {:error, "Unknown op: #{op}"}
  defp handle_workspace(_), do: {:error, "Missing op parameter"}

  # ── Unified Search ──

  defp handle_search(%{"query" => q} = args) do
    scope = args["scope"] || "all"
    project_id = args["project_id"]
    limit = args["limit"] || 10
    results = %{}

    results =
      if scope in ["all", "intents"] do
        intents =
          safe_call(fn ->
            Intents.list_intents(search: q, project_id: project_id, limit: limit)
          end) || []

        Map.put(
          results,
          :intents,
          Enum.map(intents, fn i ->
            %{id: i.id, title: i.title, level: i.level, status: i.status}
          end)
        )
      else
        results
      end

    results =
      if scope in ["all", "tasks"] do
        tasks =
          safe_call(fn ->
            Ema.Tasks.list_tasks(search: q, project_id: project_id, limit: limit)
          end) || []

        Map.put(
          results,
          :tasks,
          Enum.map(tasks, fn t -> %{id: t.id, title: t.title, status: t.status} end)
        )
      else
        results
      end

    results =
      if scope in ["all", "vault"] do
        vault = safe_call(fn -> Ema.SecondBrain.search_brain(q) end) || []
        Map.put(results, :vault, Enum.take(vault, limit))
      else
        results
      end

    results =
      if scope in ["all", "proposals"] do
        proposals =
          safe_call(fn -> Ema.Proposals.list_proposals(search: q, limit: limit) end) || []

        Map.put(
          results,
          :proposals,
          Enum.map(proposals, fn p -> %{id: p.id, title: p.title, status: p.status} end)
        )
      else
        results
      end

    results =
      if scope in ["all", "brain_dumps"] do
        items = safe_call(fn -> Ema.BrainDump.list_items(search: q, limit: limit) end) || []

        Map.put(
          results,
          :brain_dumps,
          Enum.map(items, fn i -> %{id: i.id, content: String.slice(i.content || "", 0..120)} end)
        )
      else
        results
      end

    {:ok, results}
  end

  defp handle_search(_), do: {:error, "Missing query"}

  # ── Decision Recording ──

  defp handle_decide(%{"title" => title, "rationale" => rationale} = args) do
    now = DateTime.utc_now()
    date = Date.to_iso8601(DateTime.to_date(now))
    slug = title |> String.downcase() |> String.replace(~r/[^a-z0-9]+/, "-") |> String.trim("-")

    content = """
    ---
    type: decision
    date: #{date}
    project: #{args["project_slug"] || "general"}
    intent: #{args["intent_id"] || "none"}
    ---

    # #{title}

    ## Decision
    #{rationale}

    #{if args["alternatives"], do: "## Alternatives Considered\n#{args["alternatives"]}\n", else: ""}
    """

    path = "wiki/Decisions/#{date}-#{slug}.md"

    # Write to vault
    vault_result =
      safe_call(fn ->
        Ema.SecondBrain.create_note(%{
          file_path: path,
          title: title,
          content: String.trim(content),
          space: "decisions"
        })
      end)

    # Link to intent if provided
    if args["intent_id"] do
      safe_call(fn ->
        Intents.link_intent(args["intent_id"], "vault_note", path,
          role: "evidence",
          provenance: "manual"
        )
      end)
    end

    case vault_result do
      {:ok, _} ->
        {:ok, %{path: path, title: title, linked_intent: args["intent_id"]}}

      _ ->
        {:ok,
         %{path: path, title: title, note: "Vault write may have failed but decision recorded"}}
    end
  end

  defp handle_decide(_), do: {:error, "Missing title and rationale"}

  # ── Execution Dispatch ──

  defp handle_dispatch(%{"title" => title, "objective" => objective, "mode" => mode} = args) do
    attrs = %{
      title: title,
      objective: objective,
      mode: mode,
      project_slug: args["project_slug"],
      requires_approval: !(args["auto_approve"] == true)
    }

    # Link to intent if provided
    attrs =
      if args["intent_id"] do
        intent = safe_call(fn -> Intents.get_intent(args["intent_id"]) end)
        if intent, do: Map.put(attrs, :intent_slug, intent.slug), else: attrs
      else
        attrs
      end

    case safe_call(fn -> Ema.Executions.create(attrs) end) do
      {:ok, exec} ->
        {:ok,
         %{
           id: exec.id,
           title: exec.title,
           mode: exec.mode,
           status: exec.status,
           requires_approval: exec.requires_approval
         }}

      {:error, e} ->
        {:error, inspect(e)}

      nil ->
        {:error, "Failed to create execution"}
    end
  end

  defp handle_dispatch(_), do: {:error, "Missing title, objective, and mode"}

  # ── Sprint Cycle ──

  defp handle_sprint_cycle(actor, cycle_type, "start", _args) do
    metrics = Actors.get_cycle_metrics(actor.id, cycle_type)
    active_intents = safe_call(fn -> Intents.list_intents(status: "active") end) || []
    pending_tasks = safe_call(fn -> Ema.Tasks.list_by_status("pending") end) || []

    transition_result =
      if actor.phase != "plan",
        do: Actors.transition_phase(actor, "plan", reason: "#{cycle_type}_cycle_start"),
        else: {:ok, actor}

    case transition_result do
      {:ok, updated} ->
        now = DateTime.utc_now() |> DateTime.to_iso8601()
        Actors.set_data(actor.id, "cycle", metrics.cycle_id, "status", "active")
        Actors.set_data(actor.id, "cycle", metrics.cycle_id, "started_at", now)

        {:ok,
         %{
           cycle_id: metrics.cycle_id,
           phase: updated.phase,
           previous: %{
             completed: metrics.completed_count,
             carried: metrics.carried_count,
             velocity: metrics.velocity
           },
           context: %{
             active_intents:
               Enum.take(active_intents, 10)
               |> Enum.map(fn i -> %{id: i.id, title: i.title, level: i.level} end),
             pending_tasks:
               Enum.take(pending_tasks, 10) |> Enum.map(fn t -> %{id: t.id, title: t.title} end)
           }
         }}

      {:error, e} ->
        {:error, "Phase transition failed: #{inspect(e)}"}
    end
  end

  defp handle_sprint_cycle(actor, cycle_type, "review", _args) do
    metrics = Actors.get_cycle_metrics(actor.id, cycle_type)

    {:ok,
     %{
       cycle_id: metrics.cycle_id,
       phase: actor.phase,
       status: metrics.status,
       completed: metrics.completed_count,
       carried: metrics.carried_count,
       velocity: metrics.velocity,
       transitions:
         Enum.map(metrics.transitions, fn t ->
           %{from: t.from_phase, to: t.to_phase, reason: t.reason}
         end)
     }}
  end

  defp handle_sprint_cycle(actor, cycle_type, "complete", args) do
    m = args["metrics"] || %{}

    completion = %{
      backlog_count: m["backlog_count"] || 0,
      completed_count: m["completed_count"] || 0,
      carried_count: m["carried_count"] || 0,
      velocity: m["velocity"] || 0
    }

    with {:ok, result} <- Actors.record_cycle_completion(actor.id, cycle_type, completion),
         {:ok, updated} <-
           Actors.transition_phase(actor, "idle",
             reason: "#{cycle_type}_complete",
             summary: "Done: #{completion.completed_count}, carried: #{completion.carried_count}"
           ) do
      {:ok, Map.merge(result, %{phase: updated.phase})}
    else
      {:error, e} -> {:error, inspect(e)}
    end
  end

  defp handle_sprint_cycle(_, _, action, _), do: {:error, "Unknown action: #{action}"}

  # ── Helpers ──

  defp with_actor(slug, fun) do
    case Actors.get_actor_by_slug(slug) do
      nil -> {:error, "Actor not found: #{slug}"}
      %{id: id} -> fun.(id)
    end
  end

  defp phase_minutes(%{phase_started_at: nil}), do: nil

  defp phase_minutes(%{phase_started_at: at}),
    do: DateTime.diff(DateTime.utc_now(), at, :second) |> div(60)

  defp compact_opts(opts), do: Enum.reject(opts, fn {_, v} -> is_nil(v) end)

  defp safe_call(fun) do
    fun.()
  rescue
    _ -> nil
  end

  defp tool(name, desc, props, required \\ []) do
    %{
      "name" => name,
      "description" => desc,
      "inputSchema" => %{"type" => "object", "properties" => props, "required" => required}
    }
  end
end
