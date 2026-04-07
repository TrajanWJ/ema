defmodule Ema.CLI.Commands.McpServe do
  @moduledoc """
  Standalone MCP server over stdio — runs as an escript process.
  Reads JSON-RPC 2.0 from stdin, dispatches to EMA daemon via HTTP,
  writes responses to stdout. No OTP app boot needed.
  """

  @server_info %{"name" => "ema-mcp", "version" => "2.1.0"}
  @protocol_version "2024-11-05"

  def handle([], _parsed, _transport, _opts), do: serve_loop()

  defp serve_loop do
    case IO.gets("") do
      :eof -> :ok
      {:error, _} -> :ok
      line when is_binary(line) ->
        line = String.trim(line)
        if line != "", do: with({:ok, msg} <- Jason.decode(line), do: handle_message(msg))
        serve_loop()
    end
  end

  defp handle_message(%{"id" => id, "method" => "initialize"}) do
    send_response(id, %{
      "protocolVersion" => @protocol_version,
      "capabilities" => %{"tools" => %{}},
      "serverInfo" => @server_info
    })
  end

  defp handle_message(%{"method" => "notifications/" <> _}), do: :ok
  defp handle_message(%{"id" => id, "method" => "ping"}), do: send_response(id, %{})

  defp handle_message(%{"id" => id, "method" => "tools/list"}) do
    send_response(id, %{"tools" => all_tools()})
  end

  defp handle_message(%{"id" => id, "method" => "tools/call", "params" => params}) do
    case call_tool(params["name"], params["arguments"] || %{}) do
      {:ok, result} ->
        send_response(id, %{
          "content" => [%{"type" => "text", "text" => Jason.encode!(result, pretty: true)}],
          "isError" => false
        })
      {:error, reason} ->
        send_response(id, %{
          "content" => [%{"type" => "text", "text" => "Error: #{reason}"}],
          "isError" => true
        })
    end
  end

  defp handle_message(%{"id" => id}), do: send_error(id, -32601, "Method not found")
  defp handle_message(_), do: :ok

  # ── Tool Registry ──────────────────────────────────────────────────────────

  defp all_tools do
    [
      # Core
      tool("ema_health", "Check EMA daemon health", %{}),
      tool("ema_dashboard_today", "Get today's dashboard overview", %{}),

      # Projects
      tool("ema_get_projects", "List all EMA projects", %{}),
      tool("ema_show_project", "Get project details", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_create_project", "Create a new project", %{
        "name" => %{"type" => "string"}, "slug" => %{"type" => "string"},
        "path" => %{"type" => "string"}, "description" => %{"type" => "string"}
      }, ["name"]),

      # Tasks
      tool("ema_get_tasks", "Get tasks with optional filters", %{
        "project_id" => %{"type" => "string"}, "status" => %{"type" => "string"}
      }),
      tool("ema_create_task", "Create a task", %{
        "title" => %{"type" => "string"}, "project_id" => %{"type" => "string"},
        "priority" => %{"type" => "string"}, "description" => %{"type" => "string"}
      }, ["title"]),
      tool("ema_show_task", "Get task details", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_delete_task", "Delete a task", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_transition_task", "Transition task status", %{
        "id" => %{"type" => "string"},
        "status" => %{"type" => "string", "description" => "pending|active|done|blocked"},
        "notes" => %{"type" => "string"}
      }, ["id", "status"]),

      # Brain Dump
      tool("ema_brain_dump", "Add to brain dump inbox", %{"content" => %{"type" => "string"}}, ["content"]),
      tool("ema_list_brain_dumps", "List brain dump items", %{
        "status" => %{"type" => "string", "description" => "unprocessed|processed"}
      }),
      tool("ema_process_brain_dump", "Process brain dump item", %{
        "id" => %{"type" => "string"},
        "action" => %{"type" => "string", "description" => "task|journal|archive|note"}
      }, ["id"]),
      tool("ema_delete_brain_dump", "Delete brain dump item", %{"id" => %{"type" => "string"}}, ["id"]),

      # Vault
      tool("ema_search_vault", "Search EMA vault", %{
        "query" => %{"type" => "string"}, "space" => %{"type" => "string"}
      }, ["query"]),
      tool("ema_get_vault", "List vault notes", %{"space" => %{"type" => "string"}}),
      tool("ema_vault_tree", "Show vault directory tree", %{}),
      tool("ema_vault_read", "Read a vault note by path", %{
        "path" => %{"type" => "string"}
      }, ["path"]),
      tool("ema_vault_write", "Create or update a vault note", %{
        "path" => %{"type" => "string"}, "content" => %{"type" => "string"},
        "title" => %{"type" => "string"}
      }, ["path", "content"]),
      tool("ema_vault_graph", "Show vault link graph stats", %{}),

      # Goals
      tool("ema_get_goals", "List goals", %{}),
      tool("ema_show_goal", "Get goal details", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_create_goal", "Create a goal", %{
        "title" => %{"type" => "string"}, "description" => %{"type" => "string"},
        "status" => %{"type" => "string"}, "timeframe" => %{"type" => "string"},
        "parent_id" => %{"type" => "string"}, "project_id" => %{"type" => "string"}
      }, ["title"]),
      tool("ema_update_goal", "Update a goal", %{
        "id" => %{"type" => "string"}, "title" => %{"type" => "string"},
        "status" => %{"type" => "string"}, "description" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_delete_goal", "Delete a goal", %{"id" => %{"type" => "string"}}, ["id"]),

      # Proposals
      tool("ema_get_proposals", "List proposals", %{
        "status" => %{"type" => "string"}, "project_id" => %{"type" => "string"},
        "limit" => %{"type" => "number"}
      }),
      tool("ema_show_proposal", "Get proposal details", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_approve_proposal", "Approve a proposal", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_kill_proposal", "Kill a proposal", %{
        "id" => %{"type" => "string"}, "reason" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_redirect_proposal", "Redirect a proposal", %{
        "id" => %{"type" => "string"}, "note" => %{"type" => "string"}
      }, ["id"]),
      tool("ema_proposal_lineage", "Show proposal lineage", %{"id" => %{"type" => "string"}}, ["id"]),

      # Executions
      tool("ema_get_executions", "Get executions", %{
        "limit" => %{"type" => "number"}, "status" => %{"type" => "string"}
      }),
      tool("ema_dispatch_execution", "Dispatch execution", %{
        "intent" => %{"type" => "string"}, "mode" => %{"type" => "string"},
        "project_id" => %{"type" => "string"}
      }, ["intent"]),
      tool("ema_show_execution", "Get execution details", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_approve_execution", "Approve execution", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_cancel_execution", "Cancel execution", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_execution_events", "List execution events", %{"id" => %{"type" => "string"}}, ["id"]),

      # Habits
      tool("ema_get_habits", "List active habits", %{}),
      tool("ema_create_habit", "Create a habit", %{
        "name" => %{"type" => "string"},
        "cadence" => %{"type" => "string", "description" => "daily|weekly|monthly"}
      }, ["name"]),
      tool("ema_toggle_habit", "Toggle habit completion", %{
        "id" => %{"type" => "string"},
        "date" => %{"type" => "string", "description" => "YYYY-MM-DD"}
      }, ["id"]),
      tool("ema_habits_today", "Today's habit checklist", %{}),

      # Journal
      tool("ema_journal_read", "Read journal entry", %{
        "date" => %{"type" => "string", "description" => "YYYY-MM-DD"}
      }),
      tool("ema_journal_write", "Write journal entry", %{
        "date" => %{"type" => "string"}, "content" => %{"type" => "string"},
        "mood" => %{"type" => "string"}, "energy" => %{"type" => "string"},
        "one_thing" => %{"type" => "string"}
      }, ["content"]),
      tool("ema_journal_search", "Search journal", %{"query" => %{"type" => "string"}}, ["query"]),

      # Focus
      tool("ema_get_focus", "Get current focus session", %{}),
      tool("ema_focus_start", "Start focus session", %{
        "duration" => %{"type" => "number"}, "task_id" => %{"type" => "string"}
      }),
      tool("ema_focus_stop", "Stop focus session", %{}),
      tool("ema_focus_pause", "Pause focus session", %{}),
      tool("ema_focus_resume", "Resume focus session", %{}),
      tool("ema_focus_today", "Today's focus stats", %{}),

      # Engine
      tool("ema_engine_status", "Proposal engine status", %{}),
      tool("ema_engine_pause", "Pause proposal engine", %{}),
      tool("ema_engine_resume", "Resume proposal engine", %{}),

      # Seeds
      tool("ema_get_seeds", "List seeds", %{
        "project_id" => %{"type" => "string"}, "active" => %{"type" => "boolean"}
      }),
      tool("ema_create_seed", "Create a seed", %{
        "title" => %{"type" => "string"}, "prompt" => %{"type" => "string"},
        "type" => %{"type" => "string"}, "project_id" => %{"type" => "string"}
      }, ["title"]),
      tool("ema_show_seed", "Get seed details", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_toggle_seed", "Toggle seed active/paused", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_run_seed", "Trigger seed now", %{"id" => %{"type" => "string"}}, ["id"]),

      # Agents
      tool("ema_get_agents", "List agents", %{}),
      tool("ema_show_agent", "Get agent details", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_chat_agent", "Chat with agent", %{
        "slug" => %{"type" => "string"}, "message" => %{"type" => "string"}
      }, ["slug", "message"]),

      # Responsibilities
      tool("ema_get_responsibilities", "List responsibilities", %{
        "project_id" => %{"type" => "string"}
      }),
      tool("ema_check_in_responsibility", "Check in on responsibility", %{
        "id" => %{"type" => "string"}, "notes" => %{"type" => "string"},
        "status" => %{"type" => "string", "description" => "ok|at_risk|failing"}
      }, ["id"]),
      tool("ema_at_risk_responsibilities", "List at-risk responsibilities", %{}),

      # Pipes
      tool("ema_get_pipes", "List pipes", %{"project_id" => %{"type" => "string"}}),
      tool("ema_create_pipe", "Create pipe", %{
        "name" => %{"type" => "string"}, "trigger" => %{"type" => "string"},
        "description" => %{"type" => "string"}
      }, ["name"]),
      tool("ema_toggle_pipe", "Toggle pipe", %{"id" => %{"type" => "string"}}, ["id"]),
      tool("ema_pipe_catalog", "List pipe triggers and actions", %{}),
      tool("ema_pipe_history", "Pipe execution history", %{"limit" => %{"type" => "number"}}),

      # Babysitter
      tool("ema_babysitter_state", "Get babysitter state", %{}),
      tool("ema_babysitter_nudge", "Send babysitter nudge", %{
        "message" => %{"type" => "string"}
      }, ["message"]),

      # Sessions
      tool("ema_list_sessions", "List Claude Code sessions", %{
        "active_only" => %{"type" => "boolean"}
      }),
      tool("ema_spawn_session", "Spawn Claude Code session with EMA context", %{
        "prompt" => %{"type" => "string"}, "project_slug" => %{"type" => "string"},
        "task_id" => %{"type" => "string"},
        "model" => %{"type" => "string", "enum" => ["sonnet", "opus", "haiku"]}
      }, ["prompt"]),
      tool("ema_check_session", "Check session status", %{"session_id" => %{"type" => "string"}}, ["session_id"]),
      tool("ema_session_context", "Get project context bundle", %{"project_slug" => %{"type" => "string"}}),
      tool("ema_resume_session", "Resume a session", %{
        "session_id" => %{"type" => "string"}, "prompt" => %{"type" => "string"}
      }, ["session_id", "prompt"]),
      tool("ema_kill_session", "Kill a session", %{"session_id" => %{"type" => "string"}}, ["session_id"]),

      # Context
      tool("context_operator", "Fetch operator context package", %{}),
      tool("context_project", "Fetch project context package", %{
        "project" => %{"type" => "string"}
      }, ["project"]),

      # Workspace (dispatched via HTTP MCP bridge)
      tool("ema_orient", "Get current EMA state and orientation", %{
        "mode" => %{"type" => "string", "enum" => ["operator", "workspace"]},
        "actor_slug" => %{"type" => "string"}
      }, ["mode"]),
      tool("ema_phase_transition", "Advance actor phase: idle → plan → execute → review → retro", %{
        "actor_slug" => %{"type" => "string"}, "to_phase" => %{"type" => "string"},
        "reason" => %{"type" => "string"}, "summary" => %{"type" => "string"}
      }, ["actor_slug", "to_phase"]),
      tool("ema_phase_status", "Current phase + transition history for an actor", %{
        "actor_slug" => %{"type" => "string"}
      }, ["actor_slug"]),
      tool("ema_sprint_cycle", "Start/review/complete planning cycles (week/month/quarter)", %{
        "actor_slug" => %{"type" => "string"}, "cycle_type" => %{"type" => "string"},
        "action" => %{"type" => "string"}
      }, ["actor_slug", "cycle_type", "action"]),
      tool("ema_workspace", "Actor workspace state: data, tags, config", %{
        "op" => %{"type" => "string"}, "actor_slug" => %{"type" => "string"},
        "entity_type" => %{"type" => "string"}, "entity_id" => %{"type" => "string"},
        "key" => %{"type" => "string"}, "value" => %{"type" => "string"}
      }, ["op"]),
      tool("ema_search", "Unified search across all EMA entities", %{
        "query" => %{"type" => "string"}, "scope" => %{"type" => "string"},
        "project_id" => %{"type" => "string"}, "limit" => %{"type" => "number"}
      }, ["query"]),
      tool("ema_decide", "Record a decision with rationale", %{
        "title" => %{"type" => "string"}, "rationale" => %{"type" => "string"},
        "alternatives" => %{"type" => "string"}, "project_slug" => %{"type" => "string"}
      }, ["title", "rationale"]),
      tool("ema_dispatch", "Dispatch an execution for agent work", %{
        "title" => %{"type" => "string"}, "objective" => %{"type" => "string"},
        "mode" => %{"type" => "string"}, "project_slug" => %{"type" => "string"},
        "auto_approve" => %{"type" => "boolean"}
      }, ["title", "objective", "mode"]),
      tool("ema_intelligence_gaps", "Operational gaps — stale tasks, orphan notes", %{
        "project_id" => %{"type" => "string"}, "limit" => %{"type" => "number"}
      }),
      tool("ema_intelligence_reflexion", "Lessons from past executions", %{
        "agent" => %{"type" => "string"}, "project_slug" => %{"type" => "string"}, "limit" => %{"type" => "number"}
      }),
      tool("ema_intelligence_memory", "Session memory fragments from past work", %{
        "project_path" => %{"type" => "string"}, "query" => %{"type" => "string"}
      }),
      tool("ema_codebase_ask", "Query codebase via knowledge graph + vault", %{
        "query" => %{"type" => "string"}, "project_slug" => %{"type" => "string"}
      }, ["query"]),
      tool("ema_codebase_index", "Rebuild knowledge graph for a project", %{
        "project_slug" => %{"type" => "string"}, "repo_path" => %{"type" => "string"}
      })
    ]
  end

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

  # ── Tool Dispatch ──────────────────────────────────────────────────────────

  # Core
  defp call_tool("ema_health", _), do: api_get("/health")
  defp call_tool("ema_dashboard_today", _), do: api_get("/dashboard/today")

  # Projects
  defp call_tool("ema_get_projects", _), do: api_get("/projects")
  defp call_tool("ema_show_project", %{"id" => id}), do: api_get("/projects/#{id}")
  defp call_tool("ema_create_project", args), do: api_post("/projects", args)

  # Tasks
  defp call_tool("ema_get_tasks", args), do: api_get("/tasks", args)
  defp call_tool("ema_create_task", args), do: api_post("/tasks", args)
  defp call_tool("ema_show_task", %{"id" => id}), do: api_get("/tasks/#{id}")
  defp call_tool("ema_delete_task", %{"id" => id}), do: api_delete("/tasks/#{id}")
  defp call_tool("ema_transition_task", %{"id" => id} = a), do: api_post("/tasks/#{id}/transition", Map.delete(a, "id"))

  # Brain Dump
  defp call_tool("ema_brain_dump", args), do: api_post("/brain-dump/items", args)
  defp call_tool("ema_list_brain_dumps", args), do: api_get("/brain-dump/items", args)
  defp call_tool("ema_process_brain_dump", %{"id" => id} = a), do: api_patch("/brain-dump/items/#{id}/process", Map.delete(a, "id"))
  defp call_tool("ema_delete_brain_dump", %{"id" => id}), do: api_delete("/brain-dump/items/#{id}")

  # Vault
  defp call_tool("ema_search_vault", %{"query" => q} = a), do: api_get("/vault/search", %{"q" => q, "space" => a["space"]})
  defp call_tool("ema_search_vault", _), do: {:error, "query is required"}
  defp call_tool("ema_get_vault", args), do: api_get("/vault/tree", args)
  defp call_tool("ema_vault_tree", _), do: api_get("/vault/tree")
  defp call_tool("ema_vault_read", %{"path" => p}), do: api_get("/vault/note", %{"path" => p})
  defp call_tool("ema_vault_write", %{"path" => _, "content" => _} = a), do: api_put("/vault/note", a)
  defp call_tool("ema_vault_graph", _), do: api_get("/vault/graph")

  # Goals
  defp call_tool("ema_get_goals", _), do: api_get("/goals")
  defp call_tool("ema_show_goal", %{"id" => id}), do: api_get("/goals/#{id}")
  defp call_tool("ema_create_goal", args), do: api_post("/goals", args)
  defp call_tool("ema_update_goal", %{"id" => id} = a), do: api_put("/goals/#{id}", Map.delete(a, "id"))
  defp call_tool("ema_delete_goal", %{"id" => id}), do: api_delete("/goals/#{id}")

  # Proposals
  defp call_tool("ema_get_proposals", args), do: api_get("/proposals", args)
  defp call_tool("ema_show_proposal", %{"id" => id}), do: api_get("/proposals/#{id}")
  defp call_tool("ema_approve_proposal", %{"id" => id}), do: api_post("/proposals/#{id}/approve", %{})
  defp call_tool("ema_kill_proposal", %{"id" => id} = a), do: api_post("/proposals/#{id}/kill", Map.delete(a, "id"))
  defp call_tool("ema_redirect_proposal", %{"id" => id} = a), do: api_post("/proposals/#{id}/redirect", Map.delete(a, "id"))
  defp call_tool("ema_proposal_lineage", %{"id" => id}), do: api_get("/proposals/#{id}/lineage")

  # Executions
  defp call_tool("ema_get_executions", args), do: api_get("/executions", args)
  defp call_tool("ema_dispatch_execution", args), do: api_post("/executions", args)
  defp call_tool("ema_show_execution", %{"id" => id}), do: api_get("/executions/#{id}")
  defp call_tool("ema_approve_execution", %{"id" => id}), do: api_post("/executions/#{id}/approve", %{})
  defp call_tool("ema_cancel_execution", %{"id" => id}), do: api_post("/executions/#{id}/cancel", %{})
  defp call_tool("ema_execution_events", %{"id" => id}), do: api_get("/executions/#{id}/events")

  # Habits
  defp call_tool("ema_get_habits", _), do: api_get("/habits")
  defp call_tool("ema_create_habit", args), do: api_post("/habits", args)
  defp call_tool("ema_toggle_habit", %{"id" => id} = a), do: api_post("/habits/#{id}/toggle", Map.delete(a, "id"))
  defp call_tool("ema_habits_today", _), do: api_get("/habits/today")

  # Journal
  defp call_tool("ema_journal_read", args), do: api_get("/journal/#{args["date"] || today()}")
  defp call_tool("ema_journal_write", %{"content" => _} = a), do: api_put("/journal/#{a["date"] || today()}", a)
  defp call_tool("ema_journal_search", %{"query" => q}), do: api_get("/journal/search", %{"q" => q})

  # Focus
  defp call_tool("ema_get_focus", _), do: api_get("/focus/current")
  defp call_tool("ema_focus_start", args), do: api_post("/focus/start", args)
  defp call_tool("ema_focus_stop", _), do: api_post("/focus/stop", %{})
  defp call_tool("ema_focus_pause", _), do: api_post("/focus/pause", %{})
  defp call_tool("ema_focus_resume", _), do: api_post("/focus/resume", %{})
  defp call_tool("ema_focus_today", _), do: api_get("/focus/today")

  # Engine
  defp call_tool("ema_engine_status", _), do: api_get("/engine/status")
  defp call_tool("ema_engine_pause", _), do: api_post("/engine/pause", %{})
  defp call_tool("ema_engine_resume", _), do: api_post("/engine/resume", %{})

  # Seeds
  defp call_tool("ema_get_seeds", args), do: api_get("/seeds", args)
  defp call_tool("ema_create_seed", args), do: api_post("/seeds", args)
  defp call_tool("ema_show_seed", %{"id" => id}), do: api_get("/seeds/#{id}")
  defp call_tool("ema_toggle_seed", %{"id" => id}), do: api_post("/seeds/#{id}/toggle", %{})
  defp call_tool("ema_run_seed", %{"id" => id}), do: api_post("/seeds/#{id}/run-now", %{})

  # Agents
  defp call_tool("ema_get_agents", _), do: api_get("/agents")
  defp call_tool("ema_show_agent", %{"id" => id}), do: api_get("/agents/#{id}")
  defp call_tool("ema_chat_agent", %{"slug" => s, "message" => m}), do: api_post("/agents/#{s}/chat", %{"message" => m})

  # Responsibilities
  defp call_tool("ema_get_responsibilities", args), do: api_get("/responsibilities", args)
  defp call_tool("ema_check_in_responsibility", %{"id" => id} = a), do: api_post("/responsibilities/#{id}/check-in", Map.delete(a, "id"))
  defp call_tool("ema_at_risk_responsibilities", _), do: api_get("/responsibilities/at-risk")

  # Pipes
  defp call_tool("ema_get_pipes", args), do: api_get("/pipes", args)
  defp call_tool("ema_create_pipe", args), do: api_post("/pipes", args)
  defp call_tool("ema_toggle_pipe", %{"id" => id}), do: api_post("/pipes/#{id}/toggle", %{})
  defp call_tool("ema_pipe_catalog", _), do: api_get("/pipes/catalog")
  defp call_tool("ema_pipe_history", args), do: api_get("/pipes/history", args)

  # Babysitter
  defp call_tool("ema_babysitter_state", _), do: api_get("/babysitter/state")
  defp call_tool("ema_babysitter_nudge", %{"message" => m}), do: api_post("/babysitter/nudge", %{"message" => m})

  # Sessions
  defp call_tool("ema_list_sessions", args) do
    qs = if args["active_only"], do: "?active_only=true", else: ""
    api_get("/orchestrator/sessions#{qs}")
  end
  defp call_tool("ema_spawn_session", args), do: api_post("/orchestrator/sessions/spawn", args)
  defp call_tool("ema_check_session", %{"session_id" => id}), do: api_get("/orchestrator/sessions/#{id}/check")
  defp call_tool("ema_session_context", args) do
    qs = if args["project_slug"], do: "?project_slug=#{args["project_slug"]}", else: ""
    api_get("/orchestrator/context#{qs}")
  end
  defp call_tool("ema_resume_session", %{"session_id" => id, "prompt" => p}),
    do: api_post("/orchestrator/sessions/#{id}/resume", %{"prompt" => p})
  defp call_tool("ema_kill_session", %{"session_id" => id}), do: api_post("/orchestrator/sessions/#{id}/kill", %{})

  # Context
  defp call_tool("context_operator", _), do: api_get("/context/operator/package")
  defp call_tool("context_project", %{"project" => ref}), do: api_get("/context/project/#{ref}/package")

  # Workspace tools — dispatch via HTTP MCP bridge to daemon
  @workspace_tools ~w(
    ema_orient ema_phase_transition ema_phase_status ema_sprint_cycle
    ema_workspace ema_search ema_decide ema_dispatch
    ema_intelligence_gaps ema_intelligence_reflexion ema_intelligence_memory
    ema_codebase_ask ema_codebase_index
  )

  defp call_tool(name, args) when name in @workspace_tools do
    api_post("/mcp/tools/execute", %{"name" => name, "arguments" => args})
    |> case do
      {:ok, %{"ok" => true, "result" => result}} -> {:ok, result}
      {:ok, %{"ok" => false, "error" => error}} -> {:error, error}
      other -> other
    end
  end

  defp call_tool(name, _), do: {:error, "Unknown tool: #{name}"}

  # ── HTTP Helpers ───────────────────────────────────────────────────────────

  @base "http://localhost:4488/api"

  defp api_get(path, params \\ %{}) do
    params = params |> Enum.reject(fn {_k, v} -> is_nil(v) or v == "" end) |> Map.new()
    qs = if map_size(params) > 0, do: "?" <> URI.encode_query(params), else: ""
    case Req.get("#{@base}#{path}#{qs}", receive_timeout: 15_000, retry: false) do
      {:ok, %{status: s, body: body}} when s in 200..299 -> {:ok, body}
      {:ok, %{status: s, body: body}} -> {:error, "HTTP #{s}: #{inspect(body)}"}
      {:error, reason} -> {:error, "Connection failed: #{inspect(reason)}"}
    end
  end

  defp api_post(path, body) do
    case Req.post("#{@base}#{path}", json: body, receive_timeout: 30_000, retry: false) do
      {:ok, %{status: s, body: body}} when s in 200..299 -> {:ok, body}
      {:ok, %{status: s, body: body}} -> {:error, "HTTP #{s}: #{inspect(body)}"}
      {:error, reason} -> {:error, "Connection failed: #{inspect(reason)}"}
    end
  end

  defp api_put(path, body) do
    case Req.put("#{@base}#{path}", json: body, receive_timeout: 30_000, retry: false) do
      {:ok, %{status: s, body: body}} when s in 200..299 -> {:ok, body}
      {:ok, %{status: s, body: body}} -> {:error, "HTTP #{s}: #{inspect(body)}"}
      {:error, reason} -> {:error, "Connection failed: #{inspect(reason)}"}
    end
  end

  defp api_patch(path, body) do
    case Req.patch("#{@base}#{path}", json: body, receive_timeout: 30_000, retry: false) do
      {:ok, %{status: s, body: body}} when s in 200..299 -> {:ok, body}
      {:ok, %{status: s, body: body}} -> {:error, "HTTP #{s}: #{inspect(body)}"}
      {:error, reason} -> {:error, "Connection failed: #{inspect(reason)}"}
    end
  end

  defp api_delete(path) do
    case Req.delete("#{@base}#{path}", receive_timeout: 15_000, retry: false) do
      {:ok, %{status: s, body: body}} when s in 200..299 -> {:ok, body}
      {:ok, %{status: s, body: body}} -> {:error, "HTTP #{s}: #{inspect(body)}"}
      {:error, reason} -> {:error, "Connection failed: #{inspect(reason)}"}
    end
  end

  # ── Protocol ───────────────────────────────────────────────────────────────

  defp send_response(id, result) do
    IO.puts(Jason.encode!(%{"jsonrpc" => "2.0", "id" => id, "result" => result}))
  end

  defp send_error(id, code, message) do
    IO.puts(Jason.encode!(%{"jsonrpc" => "2.0", "id" => id, "error" => %{"code" => code, "message" => message}}))
  end

  defp today, do: Date.utc_today() |> Date.to_iso8601()
end
