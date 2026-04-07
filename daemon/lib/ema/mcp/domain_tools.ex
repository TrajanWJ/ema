defmodule Ema.MCP.DomainTools do
  @moduledoc "MCP tools providing CLI feature parity across all EMA domains."

  @base_url "http://localhost:4488"
  @timeout 30_000

  @tool_names ~w(
    ema_get_proposals ema_show_proposal ema_approve_proposal ema_kill_proposal
    ema_redirect_proposal ema_proposal_lineage
    ema_show_task ema_delete_task ema_transition_task
    ema_vault_tree ema_vault_read ema_vault_write ema_vault_graph
    ema_create_goal ema_show_goal ema_update_goal ema_delete_goal
    ema_list_brain_dumps ema_process_brain_dump ema_delete_brain_dump
    ema_get_habits ema_create_habit ema_toggle_habit ema_habits_today
    ema_journal_read ema_journal_write ema_journal_search
    ema_focus_start ema_focus_stop ema_focus_pause ema_focus_resume ema_focus_today
    ema_engine_status ema_engine_pause ema_engine_resume
    ema_get_seeds ema_create_seed ema_show_seed ema_toggle_seed ema_run_seed
    ema_get_agents ema_show_agent ema_chat_agent
    ema_get_responsibilities ema_check_in_responsibility ema_at_risk_responsibilities
    ema_show_execution ema_approve_execution ema_cancel_execution ema_execution_events
    ema_create_project ema_show_project
    ema_get_pipes ema_create_pipe ema_toggle_pipe ema_pipe_catalog ema_pipe_history
    ema_babysitter_state ema_babysitter_nudge
    ema_dashboard_today
    ema_list_actors ema_get_actor ema_create_actor ema_advance_phase
    ema_list_phases ema_actor_velocity
    ema_tag_entity ema_list_tags ema_untag_entity
    ema_set_entity_data ema_get_entity_data ema_delete_entity_data
    ema_set_container_config ema_get_container_config
    ema_list_spaces ema_create_space
    ema_em_status
  )

  def tool_names, do: @tool_names

  # ── Tool Definitions ───────────────────────────────────────────────────────

  def list do
    [
      # ── Proposals ──
      tool("ema_get_proposals", "List proposals with optional filters", %{
        "status" => %{"type" => "string", "description" => "queued|approved|killed|redirected"},
        "project_id" => %{"type" => "string"},
        "limit" => %{"type" => "number"}
      }),
      tool("ema_show_proposal", "Get proposal details by ID", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_approve_proposal", "Approve a proposal — creates an execution", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_kill_proposal", "Kill a proposal — records pattern in KillMemory", %{
        "id" => %{"type" => "string"},
        "reason" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_redirect_proposal", "Redirect a proposal — creates 3 new seed angles", %{
        "id" => %{"type" => "string"},
        "note" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_proposal_lineage", "Show proposal lineage tree (seeds, parents, children)", %{
        "id" => %{"type" => "string"}
      }, ["id"]),

      # ── Tasks (extended) ──
      tool("ema_show_task", "Get task details by ID", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_delete_task", "Delete a task", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_transition_task", "Transition task to a new status", %{
        "id" => %{"type" => "string"},
        "status" => %{"type" => "string", "description" => "pending|active|done|blocked"},
        "notes" => %{"type" => "string"}
      }, ["id", "status"]),

      # ── Vault ──
      tool("ema_vault_tree", "Show vault directory tree", %{}),
      tool("ema_vault_read", "Read a vault note by path", %{
        "path" => %{"type" => "string", "description" => "Path relative to vault root"}
      }, ["path"]),
      tool("ema_vault_write", "Create or update a vault note", %{
        "path" => %{"type" => "string", "description" => "Path relative to vault root"},
        "content" => %{"type" => "string", "description" => "Markdown content"},
        "title" => %{"type" => "string"}
      }, ["path", "content"]),
      tool("ema_vault_graph", "Show vault link graph statistics", %{}),

      # ── Goals ──
      tool("ema_create_goal", "Create a new goal", %{
        "title" => %{"type" => "string"},
        "description" => %{"type" => "string"},
        "status" => %{"type" => "string"},
        "timeframe" => %{"type" => "string"},
        "parent_id" => %{"type" => "string"},
        "project_id" => %{"type" => "string"}
      }, ["title"]),
      tool("ema_show_goal", "Get goal details with children", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_update_goal", "Update a goal's title, status, or description", %{
        "id" => %{"type" => "string"},
        "title" => %{"type" => "string"},
        "status" => %{"type" => "string"},
        "description" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_delete_goal", "Delete a goal", %{
        "id" => %{"type" => "string"}
      }, ["id"]),

      # ── Brain Dump ──
      tool("ema_list_brain_dumps", "List brain dump inbox items", %{
        "status" => %{"type" => "string", "description" => "unprocessed|processed"}
      }),
      tool("ema_process_brain_dump", "Process a brain dump item into task, journal, archive, or note", %{
        "id" => %{"type" => "string"},
        "action" => %{"type" => "string", "description" => "task|journal|archive|note"}
      }, ["id"]),
      tool("ema_delete_brain_dump", "Delete a brain dump item", %{
        "id" => %{"type" => "string"}
      }, ["id"]),

      # ── Habits ──
      tool("ema_get_habits", "List active habits", %{}),
      tool("ema_create_habit", "Create a new habit", %{
        "name" => %{"type" => "string"},
        "cadence" => %{"type" => "string", "description" => "daily|weekly|monthly"}
      }, ["name"]),
      tool("ema_toggle_habit", "Toggle habit completion for a date", %{
        "id" => %{"type" => "string"},
        "date" => %{"type" => "string", "description" => "YYYY-MM-DD (default: today)"}
      }, ["id"]),
      tool("ema_habits_today", "Get today's habit checklist with completion status", %{}),

      # ── Journal ──
      tool("ema_journal_read", "Read journal entry for a date", %{
        "date" => %{"type" => "string", "description" => "YYYY-MM-DD (default: today)"}
      }),
      tool("ema_journal_write", "Write or update a journal entry", %{
        "date" => %{"type" => "string", "description" => "YYYY-MM-DD (default: today)"},
        "content" => %{"type" => "string"},
        "mood" => %{"type" => "string"},
        "energy" => %{"type" => "string"},
        "one_thing" => %{"type" => "string"}
      }, ["content"]),
      tool("ema_journal_search", "Search journal entries by keyword", %{
        "query" => %{"type" => "string"}
      }, ["query"]),

      # ── Focus ──
      tool("ema_focus_start", "Start a focus session", %{
        "duration" => %{"type" => "number", "description" => "Minutes (default: 45)"},
        "task_id" => %{"type" => "string"}
      }),
      tool("ema_focus_stop", "Stop current focus session", %{}),
      tool("ema_focus_pause", "Pause current focus session", %{}),
      tool("ema_focus_resume", "Resume paused focus session", %{}),
      tool("ema_focus_today", "Get today's focus statistics", %{}),

      # ── Engine ──
      tool("ema_engine_status", "Get proposal engine pipeline status", %{}),
      tool("ema_engine_pause", "Pause the proposal engine", %{}),
      tool("ema_engine_resume", "Resume the proposal engine", %{}),

      # ── Seeds ──
      tool("ema_get_seeds", "List proposal seeds with optional filters", %{
        "project_id" => %{"type" => "string"},
        "active" => %{"type" => "boolean"}
      }),
      tool("ema_create_seed", "Create a proposal seed", %{
        "title" => %{"type" => "string"},
        "prompt" => %{"type" => "string"},
        "type" => %{"type" => "string"},
        "project_id" => %{"type" => "string"}
      }, ["title"]),
      tool("ema_show_seed", "Get seed details by ID", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_toggle_seed", "Toggle seed active/paused", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_run_seed", "Trigger seed immediately", %{
        "id" => %{"type" => "string"}
      }, ["id"]),

      # ── Agents ──
      tool("ema_get_agents", "List all agents", %{}),
      tool("ema_show_agent", "Get agent details by ID or slug", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_chat_agent", "Chat with an agent", %{
        "slug" => %{"type" => "string", "description" => "Agent slug"},
        "message" => %{"type" => "string"}
      }, ["slug", "message"]),

      # ── Responsibilities ──
      tool("ema_get_responsibilities", "List responsibilities", %{
        "project_id" => %{"type" => "string"}
      }),
      tool("ema_check_in_responsibility", "Check in on a responsibility", %{
        "id" => %{"type" => "string"},
        "notes" => %{"type" => "string"},
        "status" => %{"type" => "string", "description" => "ok|at_risk|failing"}
      }, ["id"]),
      tool("ema_at_risk_responsibilities", "List at-risk responsibilities", %{}),

      # ── Executions (extended) ──
      tool("ema_show_execution", "Get execution details by ID", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_approve_execution", "Approve a pending execution", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_cancel_execution", "Cancel a running execution", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_execution_events", "List execution lifecycle events", %{
        "id" => %{"type" => "string"}
      }, ["id"]),

      # ── Projects (extended) ──
      tool("ema_create_project", "Create a new project", %{
        "name" => %{"type" => "string"},
        "slug" => %{"type" => "string"},
        "path" => %{"type" => "string", "description" => "Linked filesystem path"},
        "description" => %{"type" => "string"}
      }, ["name"]),
      tool("ema_show_project", "Get project details by ID or slug", %{
        "id" => %{"type" => "string", "description" => "Project ID or slug"}
      }, ["id"]),

      # ── Pipes ──
      tool("ema_get_pipes", "List automation pipes", %{
        "project_id" => %{"type" => "string"}
      }),
      tool("ema_create_pipe", "Create an automation pipe", %{
        "name" => %{"type" => "string"},
        "trigger" => %{"type" => "string", "description" => "Trigger pattern (e.g. brain_dump:created)"},
        "description" => %{"type" => "string"}
      }, ["name"]),
      tool("ema_toggle_pipe", "Toggle pipe active/paused", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_pipe_catalog", "List available pipe triggers and actions", %{}),
      tool("ema_pipe_history", "Show pipe execution history", %{
        "limit" => %{"type" => "number"}
      }),

      # ── Babysitter ──
      tool("ema_babysitter_state", "Get babysitter observability state", %{}),
      tool("ema_babysitter_nudge", "Send nudge message to babysitter", %{
        "message" => %{"type" => "string"}
      }, ["message"]),

      # ── Dashboard ──
      tool("ema_dashboard_today", "Get today's dashboard overview", %{}),

      # ── Actors ──
      tool("ema_list_actors", "List actors with optional type filter", %{
        "type" => %{"type" => "string", "description" => "human|agent"}
      }),
      tool("ema_get_actor", "Get actor details by ID", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_create_actor", "Create a new actor", %{
        "name" => %{"type" => "string"},
        "slug" => %{"type" => "string"},
        "actor_type" => %{"type" => "string", "description" => "human|agent"}
      }, ["name", "slug", "actor_type"]),
      tool("ema_advance_phase", "Transition an actor to a new phase", %{
        "id" => %{"type" => "string"},
        "to_phase" => %{"type" => "string"},
        "reason" => %{"type" => "string"},
        "week_number" => %{"type" => "number"}
      }, ["id", "to_phase"]),
      tool("ema_list_phases", "List phase transitions for an actor", %{
        "id" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_actor_velocity", "Compute actor velocity — weeks completed and avg transitions", %{
        "id" => %{"type" => "string"}
      }, ["id"]),

      # ── Tags ──
      tool("ema_tag_entity", "Tag an entity (task, project, etc.)", %{
        "entity_type" => %{"type" => "string"},
        "entity_id" => %{"type" => "string"},
        "tag" => %{"type" => "string"},
        "actor_id" => %{"type" => "string"},
        "namespace" => %{"type" => "string"}
      }, ["entity_type", "entity_id", "tag"]),
      tool("ema_list_tags", "List tags for an entity", %{
        "entity_type" => %{"type" => "string"},
        "entity_id" => %{"type" => "string"}
      }, ["entity_type", "entity_id"]),
      tool("ema_untag_entity", "Remove a tag from an entity", %{
        "entity_type" => %{"type" => "string"},
        "entity_id" => %{"type" => "string"},
        "tag" => %{"type" => "string"},
        "actor_id" => %{"type" => "string"}
      }, ["entity_type", "entity_id", "tag"]),

      # ── Entity Data ──
      tool("ema_set_entity_data", "Set per-actor metadata on an entity", %{
        "entity_type" => %{"type" => "string"},
        "entity_id" => %{"type" => "string"},
        "actor_id" => %{"type" => "string"},
        "key" => %{"type" => "string"},
        "value" => %{"type" => "string"}
      }, ["entity_type", "entity_id", "key", "value"]),
      tool("ema_get_entity_data", "Get per-actor metadata for an entity", %{
        "entity_type" => %{"type" => "string"},
        "entity_id" => %{"type" => "string"},
        "actor_id" => %{"type" => "string"}
      }, ["entity_type", "entity_id"]),
      tool("ema_delete_entity_data", "Delete per-actor metadata from an entity", %{
        "entity_type" => %{"type" => "string"},
        "entity_id" => %{"type" => "string"},
        "actor_id" => %{"type" => "string"},
        "key" => %{"type" => "string"}
      }, ["entity_type", "entity_id", "key"]),

      # ── Container Config ──
      tool("ema_set_container_config", "Set config on a container (space/project/task)", %{
        "container_type" => %{"type" => "string"},
        "container_id" => %{"type" => "string"},
        "key" => %{"type" => "string"},
        "value" => %{"type" => "string"}
      }, ["container_type", "container_id", "key", "value"]),
      tool("ema_get_container_config", "Get config for a container", %{
        "container_type" => %{"type" => "string"},
        "container_id" => %{"type" => "string"}
      }, ["container_type", "container_id"]),

      # ── Spaces ──
      tool("ema_list_spaces", "List all spaces", %{}),
      tool("ema_create_space", "Create a new space", %{
        "name" => %{"type" => "string"},
        "space_type" => %{"type" => "string"}
      }, ["name"]),

      # ── Executive Management ──
      tool("ema_em_status", "Executive overview — all actors with phase info", %{})
    ]
  end

  # ── Call Dispatch ──────────────────────────────────────────────────────────

  # Proposals
  def call("ema_get_proposals", args, _), do: get("/proposals", pick(args, ~w(status project_id limit)))
  def call("ema_show_proposal", %{"id" => id}, _), do: get("/proposals/#{id}")
  def call("ema_approve_proposal", %{"id" => id}, _), do: post("/proposals/#{id}/approve")
  def call("ema_kill_proposal", %{"id" => id} = a, _), do: post("/proposals/#{id}/kill", pick(a, ~w(reason)))
  def call("ema_redirect_proposal", %{"id" => id} = a, _), do: post("/proposals/#{id}/redirect", pick(a, ~w(note)))
  def call("ema_proposal_lineage", %{"id" => id}, _), do: get("/proposals/#{id}/lineage")

  # Tasks
  def call("ema_show_task", %{"id" => id}, _), do: get("/tasks/#{id}")
  def call("ema_delete_task", %{"id" => id}, _), do: delete("/tasks/#{id}")
  def call("ema_transition_task", %{"id" => id, "status" => s} = a, _),
    do: post("/tasks/#{id}/transition", %{"status" => s, "notes" => a["notes"]})

  # Vault
  def call("ema_vault_tree", _, _), do: get("/vault/tree")
  def call("ema_vault_read", %{"path" => p}, _), do: get("/vault/note", %{"path" => p})
  def call("ema_vault_write", %{"path" => p, "content" => c} = a, _),
    do: put("/vault/note", %{"path" => p, "content" => c, "title" => a["title"]})
  def call("ema_vault_graph", _, _), do: get("/vault/graph")

  # Goals
  def call("ema_create_goal", args, _), do: post("/goals", pick(args, ~w(title description status timeframe parent_id project_id)))
  def call("ema_show_goal", %{"id" => id}, _), do: get("/goals/#{id}")
  def call("ema_update_goal", %{"id" => id} = a, _), do: put("/goals/#{id}", pick(a, ~w(title status description timeframe)))
  def call("ema_delete_goal", %{"id" => id}, _), do: delete("/goals/#{id}")

  # Brain Dump
  def call("ema_list_brain_dumps", args, _), do: get("/brain-dump/items", pick(args, ~w(status)))
  def call("ema_process_brain_dump", %{"id" => id} = a, _), do: patch("/brain-dump/items/#{id}/process", pick(a, ~w(action)))
  def call("ema_delete_brain_dump", %{"id" => id}, _), do: delete("/brain-dump/items/#{id}")

  # Habits
  def call("ema_get_habits", _, _), do: get("/habits")
  def call("ema_create_habit", args, _), do: post("/habits", pick(args, ~w(name cadence)))
  def call("ema_toggle_habit", %{"id" => id} = a, _), do: post("/habits/#{id}/toggle", pick(a, ~w(date)))
  def call("ema_habits_today", _, _), do: get("/habits/today")

  # Journal
  def call("ema_journal_read", args, _), do: get("/journal/#{args["date"] || today()}")
  def call("ema_journal_write", %{"content" => _} = a, _),
    do: put("/journal/#{a["date"] || today()}", pick(a, ~w(content mood energy one_thing)))
  def call("ema_journal_search", %{"query" => q}, _), do: get("/journal/search", %{"q" => q})

  # Focus
  def call("ema_focus_start", args, _), do: post("/focus/start", pick(args, ~w(duration task_id)))
  def call("ema_focus_stop", _, _), do: post("/focus/stop")
  def call("ema_focus_pause", _, _), do: post("/focus/pause")
  def call("ema_focus_resume", _, _), do: post("/focus/resume")
  def call("ema_focus_today", _, _), do: get("/focus/today")

  # Engine
  def call("ema_engine_status", _, _), do: get("/engine/status")
  def call("ema_engine_pause", _, _), do: post("/engine/pause")
  def call("ema_engine_resume", _, _), do: post("/engine/resume")

  # Seeds
  def call("ema_get_seeds", args, _), do: get("/seeds", pick(args, ~w(project_id active)))
  def call("ema_create_seed", args, _), do: post("/seeds", pick(args, ~w(title prompt type project_id)))
  def call("ema_show_seed", %{"id" => id}, _), do: get("/seeds/#{id}")
  def call("ema_toggle_seed", %{"id" => id}, _), do: post("/seeds/#{id}/toggle")
  def call("ema_run_seed", %{"id" => id}, _), do: post("/seeds/#{id}/run-now")

  # Agents
  def call("ema_get_agents", _, _), do: get("/agents")
  def call("ema_show_agent", %{"id" => id}, _), do: get("/agents/#{id}")
  def call("ema_chat_agent", %{"slug" => slug, "message" => msg}, _),
    do: post("/agents/#{slug}/chat", %{"message" => msg})

  # Responsibilities
  def call("ema_get_responsibilities", args, _), do: get("/responsibilities", pick(args, ~w(project_id)))
  def call("ema_check_in_responsibility", %{"id" => id} = a, _),
    do: post("/responsibilities/#{id}/check-in", pick(a, ~w(notes status)))
  def call("ema_at_risk_responsibilities", _, _), do: get("/responsibilities/at-risk")

  # Executions
  def call("ema_show_execution", %{"id" => id}, _), do: get("/executions/#{id}")
  def call("ema_approve_execution", %{"id" => id}, _), do: post("/executions/#{id}/approve")
  def call("ema_cancel_execution", %{"id" => id}, _), do: post("/executions/#{id}/cancel")
  def call("ema_execution_events", %{"id" => id}, _), do: get("/executions/#{id}/events")

  # Projects
  def call("ema_create_project", args, _), do: post("/projects", pick(args, ~w(name slug path description)))
  def call("ema_show_project", %{"id" => id}, _), do: get("/projects/#{id}")

  # Pipes
  def call("ema_get_pipes", args, _), do: get("/pipes", pick(args, ~w(project_id)))
  def call("ema_create_pipe", args, _), do: post("/pipes", pick(args, ~w(name trigger description)))
  def call("ema_toggle_pipe", %{"id" => id}, _), do: post("/pipes/#{id}/toggle")
  def call("ema_pipe_catalog", _, _), do: get("/pipes/catalog")
  def call("ema_pipe_history", args, _), do: get("/pipes/history", pick(args, ~w(limit)))

  # Babysitter
  def call("ema_babysitter_state", _, _), do: get("/babysitter/state")
  def call("ema_babysitter_nudge", %{"message" => msg}, _), do: post("/babysitter/nudge", %{"message" => msg})

  # Dashboard
  def call("ema_dashboard_today", _, _), do: get("/dashboard/today")

  # Actors
  def call("ema_list_actors", args, _), do: get("/actors", pick(args, ~w(type)))
  def call("ema_get_actor", %{"id" => id}, _), do: get("/actors/#{id}")
  def call("ema_create_actor", args, _), do: post("/actors", pick(args, ~w(name slug actor_type)))
  def call("ema_advance_phase", %{"id" => id} = a, _),
    do: post("/actors/#{id}/transition", pick(a, ~w(to_phase reason week_number)))
  def call("ema_list_phases", %{"id" => id}, _), do: get("/actors/#{id}/phases")

  def call("ema_actor_velocity", %{"id" => id}, _) do
    case get("/actors/#{id}/phases") do
      {:ok, phases} when is_list(phases) ->
        count = length(phases)
        weeks = phases
          |> Enum.map(& &1["week_number"])
          |> Enum.reject(&is_nil/1)
          |> Enum.uniq()
          |> length()
        avg = if count > 0, do: Float.round(weeks / count, 2), else: 0.0
        {:ok, %{"actor_id" => id, "total_transitions" => count, "weeks_completed" => weeks, "avg_transitions_per_week" => avg}}
      other -> other
    end
  end

  # Tags
  def call("ema_tag_entity", args, _),
    do: post("/tags", pick(args, ~w(entity_type entity_id tag actor_id namespace)))
  def call("ema_list_tags", args, _),
    do: get("/tags", pick(args, ~w(entity_type entity_id)))
  def call("ema_untag_entity", args, _),
    do: delete("/tags", pick(args, ~w(entity_type entity_id tag actor_id)))

  # Entity Data
  def call("ema_set_entity_data", args, _),
    do: post("/entity-data", pick(args, ~w(entity_type entity_id actor_id key value)))
  def call("ema_get_entity_data", args, _),
    do: get("/entity-data", pick(args, ~w(entity_type entity_id actor_id)))
  def call("ema_delete_entity_data", args, _),
    do: delete("/entity-data", pick(args, ~w(entity_type entity_id actor_id key)))

  # Container Config
  def call("ema_set_container_config", args, _),
    do: post("/container-config", pick(args, ~w(container_type container_id key value)))
  def call("ema_get_container_config", args, _),
    do: get("/container-config", pick(args, ~w(container_type container_id)))

  # Spaces
  def call("ema_list_spaces", _, _), do: get("/spaces")
  def call("ema_create_space", args, _), do: post("/spaces", pick(args, ~w(name space_type)))

  # Executive Management
  def call("ema_em_status", _, _), do: get("/actors")

  # Catch-alls
  def call(name, _, _) when name in @tool_names, do: {:error, "Missing required parameters for #{name}"}
  def call(name, _, _), do: {:error, "Unknown domain tool: #{name}"}

  # ── HTTP Helpers ───────────────────────────────────────────────────────────

  defp get(path, params \\ %{}) do
    params = params |> Enum.reject(fn {_k, v} -> is_nil(v) or v == "" end) |> Map.new()
    qs = if map_size(params) > 0, do: "?" <> URI.encode_query(params), else: ""
    http(:get, "#{path}#{qs}")
  end

  defp post(path, body \\ %{}), do: http(:post, path, body)
  defp put(path, body), do: http(:put, path, body)
  defp patch(path, body), do: http(:patch, path, body)
  defp delete(path), do: http(:delete, path)
  defp delete(path, params) do
    params = params |> Enum.reject(fn {_k, v} -> is_nil(v) or v == "" end) |> Map.new()
    qs = if map_size(params) > 0, do: "?" <> URI.encode_query(params), else: ""
    http(:delete, "#{path}#{qs}")
  end

  defp http(method, path, body \\ nil) do
    url = @base_url <> "/api" <> path
    opts = [receive_timeout: @timeout, headers: [{"x-mcp-internal", "true"}]]
    opts = if method in [:post, :put, :patch], do: Keyword.put(opts, :json, body || %{}), else: opts

    case apply(Req, method, [url, opts]) do
      {:ok, %{status: s, body: resp}} when s in 200..299 -> {:ok, resp}
      {:ok, %{status: s, body: resp}} -> {:error, "HTTP #{s}: #{inspect(resp)}"}
      {:error, reason} -> {:error, "Connection failed: #{inspect(reason)}"}
    end
  end

  # ── Helpers ────────────────────────────────────────────────────────────────

  defp tool(name, desc, props, required \\ []) do
    %{
      "name" => name,
      "description" => desc,
      "inputSchema" => %{
        "type" => "object",
        "properties" => props,
        "required" => required
      }
    }
  end

  defp pick(args, keys), do: args |> Map.take(keys) |> Enum.reject(fn {_k, v} -> is_nil(v) end) |> Map.new()

  defp today, do: Date.utc_today() |> Date.to_iso8601()
end
