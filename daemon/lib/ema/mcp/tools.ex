defmodule Ema.MCP.Tools do
  @moduledoc """
  MCP Tool handlers for EMA.

  Tools are callable actions that MCP clients (Claude Code) can invoke
  to take action inside EMA. Each tool call:
    1. Validates required parameters
    2. Makes REST calls to EMA daemon (localhost:4000)
    3. Logs the call + result to outcome tracker
    4. Returns structured JSON

  All tool calls use `with` chains for clean error handling.
  EMA API calls have a 30s timeout; vault calls fall back gracefully.

  Registered tools:
    create_proposal   → Trigger the Proposal Pipeline
    create_task       → Create a task in EMA
    update_task       → Update task status + lifecycle
    query_vault       → Semantic vault search
    log_outcome       → Record an outcome to the tracker
  """

  require Logger
  alias Ema.MCP.RecursionGuard

  @base_url "http://localhost:4488"
  @api_timeout 30_000

  # ── Tool Registry ─────────────────────────────────────────────────────────

  @doc """
  Returns the MCP tool list descriptor for all registered tools.
  """
  def list do
    [
      %{
        "name" => "create_proposal",
        "description" =>
          "Trigger the EMA Proposal Pipeline to generate a new proposal. The pipeline runs Generator → Refiner → Debater → Tagger stages automatically. Returns a proposal_id and a streaming PubSub topic you can subscribe to for real-time generation progress.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "title" => %{"type" => "string", "description" => "Proposal title"},
            "description" => %{
              "type" => "string",
              "description" => "Detailed description of what to propose"
            },
            "project_id" => %{
              "type" => "string",
              "description" => "EMA project ID to associate this proposal with"
            },
            "context_keys" => %{
              "type" => "array",
              "items" => %{"type" => "string"},
              "description" =>
                "MCP resource URIs to inject as context (e.g. ['ema://goals/active'])"
            }
          },
          "required" => ["title", "description", "project_id"]
        }
      },
      %{
        "name" => "create_task",
        "description" =>
          "Create a new task in EMA under a specific project and goal. Returns the created task_id and who/what it was assigned to.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "title" => %{"type" => "string", "description" => "Task title"},
            "description" => %{"type" => "string", "description" => "Task description"},
            "project_id" => %{"type" => "string", "description" => "EMA project ID"},
            "goal_id" => %{
              "type" => "string",
              "description" => "Goal this task contributes to (optional)"
            },
            "priority" => %{
              "type" => "string",
              "enum" => ["low", "medium", "high", "critical"],
              "description" => "Task priority level"
            },
            "estimated_time" => %{
              "type" => "string",
              "description" => "Human-readable time estimate (e.g. '2h', '30min', '3 days')"
            }
          },
          "required" => ["title", "description", "project_id"]
        }
      },
      %{
        "name" => "update_task",
        "description" =>
          "Update a task's status and add notes. Also updates the goal's progress tracking. Returns the updated task and current goal progress.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "task_id" => %{"type" => "string", "description" => "EMA task ID"},
            "status" => %{
              "type" => "string",
              "enum" => ["pending", "active", "done", "blocked"],
              "description" => "New task status"
            },
            "notes" => %{"type" => "string", "description" => "Notes or context for this update"}
          },
          "required" => ["task_id", "status"]
        }
      },
      %{
        "name" => "query_vault",
        "description" =>
          "Semantic search over the EMA knowledge vault. Returns the top matching notes with text snippets and backlinks.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "query" => %{"type" => "string", "description" => "Natural language search query"},
            "limit" => %{
              "type" => "integer",
              "description" => "Maximum number of results (default: 5, max: 20)",
              "default" => 5
            }
          },
          "required" => ["query"]
        }
      },
      %{
        "name" => "log_outcome",
        "description" =>
          "Record the outcome of a task to the EMA outcome tracker. EMA will automatically detect patterns from logged outcomes. Returns the logged outcome and any patterns detected.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "task_id" => %{"type" => "string", "description" => "EMA task ID"},
            "outcome" => %{
              "type" => "string",
              "enum" => ["success", "failure", "warning"],
              "description" => "Outcome type"
            },
            "feedback" => %{
              "type" => "string",
              "description" => "What happened — include context, blockers, learnings"
            },
            "duration_seconds" => %{
              "type" => "integer",
              "description" => "How long the task took in seconds"
            }
          },
          "required" => ["task_id", "outcome", "feedback"]
        }
      },
      %{
        "name" => "context_operator",
        "description" => "Fetch the canonical EMA operator context package from host EMA.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{}
        }
      },
      %{
        "name" => "context_project",
        "description" => "Fetch the canonical EMA project context package by project id or slug.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "project" => %{"type" => "string", "description" => "Project id, slug, or name"}
          },
          "required" => ["project"]
        }
      },
      %{
        "name" => "bootstrap_status",
        "description" =>
          "Fetch EMA bootstrap/readiness status, including provider health and detected CLI tools.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{}
        }
      },
      %{
        "name" => "run_bootstrap",
        "description" =>
          "Run EMA's onboarding/bootstrap sweep to detect tools, catalog imports, and refresh construction context.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{}
        }
      },
      %{
        "name" => "ema_get_intents",
        "description" =>
          "List intents from the EMA Intent Engine with optional filters. Intents are the semantic hierarchy — from vision (L0) down to tasks (L4) and steps (L5). Returns serialized intents with level names, status, and metadata.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "project_id" => %{
              "type" => "string",
              "description" => "Filter by EMA project ID"
            },
            "level" => %{
              "type" => "integer",
              "description" =>
                "Filter by intent level (0=vision, 1=goal, 2=project, 3=feature, 4=task, 5=execution)",
              "minimum" => 0,
              "maximum" => 5
            },
            "status" => %{
              "type" => "string",
              "description" =>
                "Filter by status (planned, active, researched, outlined, implementing, complete, blocked, archived)"
            },
            "kind" => %{
              "type" => "string",
              "description" => "Filter by kind (e.g. 'task', 'goal', 'feature', 'bug')"
            },
            "limit" => %{
              "type" => "integer",
              "description" => "Maximum number of intents to return (default: 20)",
              "default" => 20
            }
          }
        }
      },
      %{
        "name" => "ema_create_intent",
        "description" =>
          "Create a new intent in the EMA Intent Engine. Intents represent semantic truth at any level of the hierarchy — from high-level goals to concrete tasks. Returns the created intent with its ID and serialized fields.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "title" => %{"type" => "string", "description" => "Intent title"},
            "description" => %{
              "type" => "string",
              "description" => "Detailed description of the intent"
            },
            "level" => %{
              "type" => "integer",
              "description" =>
                "Intent level (0=vision, 1=goal, 2=project, 3=feature, 4=task, 5=execution). Default: 4",
              "default" => 4,
              "minimum" => 0,
              "maximum" => 5
            },
            "kind" => %{
              "type" => "string",
              "description" =>
                "Intent kind (e.g. 'task', 'goal', 'feature', 'bug'). Default: 'task'",
              "default" => "task"
            },
            "project_id" => %{
              "type" => "string",
              "description" => "EMA project ID to associate this intent with"
            },
            "parent_id" => %{
              "type" => "string",
              "description" => "Parent intent ID for hierarchy nesting"
            }
          },
          "required" => ["title"]
        }
      },
      %{
        "name" => "ema_get_intent_tree",
        "description" =>
          "Get the full intent hierarchy as a nested tree. Each node contains its children recursively. Useful for understanding the complete intent structure of a project or the whole system.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "project_id" => %{
              "type" => "string",
              "description" =>
                "Filter tree to a specific project (optional — omit for all projects)"
            }
          }
        }
      },
      %{
        "name" => "ema_get_intent_context",
        "description" =>
          "Get an intent with its full operational context: linked records (tasks, proposals, executions), recent lineage events, and parent chain. Use this to understand what's connected to an intent and its history.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "intent_id" => %{
              "type" => "string",
              "description" => "Intent ID to fetch context for"
            }
          },
          "required" => ["intent_id"]
        }
      },
      %{
        "name" => "ema_attach_intent_actor",
        "description" =>
          "Attach an actor to an intent using the canonical semantic bridge. Use this for ownership, assignment, or operator relationships.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "intent_id" => %{"type" => "string", "description" => "Intent ID"},
            "actor_id" => %{"type" => "string", "description" => "Actor ID or slug"},
            "role" => %{
              "type" => "string",
              "description" => "Link role (owner, assignee, operator)",
              "default" => "assignee"
            },
            "provenance" => %{
              "type" => "string",
              "description" => "Link provenance",
              "default" => "manual"
            }
          },
          "required" => ["intent_id", "actor_id"]
        }
      },
      %{
        "name" => "ema_attach_intent_execution",
        "description" => "Attach an execution to an intent as runtime truth.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "intent_id" => %{"type" => "string", "description" => "Intent ID"},
            "execution_id" => %{"type" => "string", "description" => "Execution ID"},
            "role" => %{"type" => "string", "description" => "Link role", "default" => "runtime"},
            "provenance" => %{
              "type" => "string",
              "description" => "Link provenance",
              "default" => "execution"
            }
          },
          "required" => ["intent_id", "execution_id"]
        }
      },
      %{
        "name" => "ema_attach_intent_session",
        "description" => "Attach a Claude, AI, or agent session to an intent as runtime context.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "intent_id" => %{"type" => "string", "description" => "Intent ID"},
            "session_id" => %{"type" => "string", "description" => "Session ID"},
            "session_type" => %{
              "type" => "string",
              "description" => "claude_session | ai_session | agent_session",
              "default" => "claude_session"
            },
            "role" => %{"type" => "string", "description" => "Link role", "default" => "runtime"},
            "provenance" => %{"type" => "string", "description" => "Optional provenance override"}
          },
          "required" => ["intent_id", "session_id"]
        }
      },
      %{
        "name" => "ema_get_intent_runtime",
        "description" =>
          "Get the runtime bundle for an intent: actors, executions, sessions, links, and recent lineage.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "intent_id" => %{"type" => "string", "description" => "Intent ID"}
          },
          "required" => ["intent_id"]
        }
      }
    ]
  end

  # ── Tool Dispatch ─────────────────────────────────────────────────────────

  @doc """
  Call a tool by name with the given arguments.
  Returns {:ok, result_map} or {:error, reason}.
  """
  def call("create_proposal", args, request_id) do
    call_create_proposal(args, request_id)
  end

  def call("create_task", args, request_id) do
    call_create_task(args, request_id)
  end

  def call("update_task", args, request_id) do
    call_update_task(args, request_id)
  end

  def call("query_vault", args, request_id) do
    call_query_vault(args, request_id)
  end

  def call("log_outcome", args, request_id) do
    call_log_outcome(args, request_id)
  end

  def call("context_operator", args, request_id) do
    call_context_operator(args, request_id)
  end

  def call("context_project", args, request_id) do
    call_context_project(args, request_id)
  end

  def call("bootstrap_status", args, request_id) do
    call_bootstrap_status(args, request_id)
  end

  def call("run_bootstrap", args, request_id) do
    call_run_bootstrap(args, request_id)
  end

  def call("ema_get_intents", args, request_id) do
    call_get_intents(args, request_id)
  end

  def call("ema_create_intent", args, request_id) do
    call_create_intent(args, request_id)
  end

  def call("ema_get_intent_tree", args, request_id) do
    call_get_intent_tree(args, request_id)
  end

  def call("ema_get_intent_context", args, request_id) do
    call_get_intent_context(args, request_id)
  end

  def call("ema_attach_intent_actor", args, request_id) do
    call_attach_intent_actor(args, request_id)
  end

  def call("ema_attach_intent_execution", args, request_id) do
    call_attach_intent_execution(args, request_id)
  end

  def call("ema_attach_intent_session", args, request_id) do
    call_attach_intent_session(args, request_id)
  end

  def call("ema_get_intent_runtime", args, request_id) do
    call_get_intent_runtime(args, request_id)
  end

  def call(name, _args, _request_id) do
    {:error, "Unknown tool: #{name}"}
  end

  # ── Tool: context_operator / context_project ─────────────────────────────

  defp call_context_operator(_args, _request_id) do
    case get("/api/context/operator/package") do
      {:ok, %{status: status, body: body}} when status in 200..299 ->
        {:ok, body}

      {:ok, %{status: status, body: body}} ->
        {:error, "EMA API error #{status}: #{inspect(body)}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp call_context_project(args, _request_id) do
    with {:ok, project_ref} <- require_string(args, "project"),
         {:ok, project_id} <- resolve_project_id(project_ref),
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           get("/api/context/project/#{project_id}/package") do
      {:ok, body}
    else
      {:ok, %{status: status, body: body}} ->
        {:error, "EMA API error #{status}: #{inspect(body)}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp call_bootstrap_status(_args, _request_id) do
    case get("/api/onboarding/status") do
      {:ok, %{status: status, body: body}} when status in 200..299 ->
        {:ok, body}

      {:ok, %{status: status, body: body}} ->
        {:error, "EMA API error #{status}: #{inspect(body)}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp call_run_bootstrap(_args, _request_id) do
    case post("/api/onboarding/run", %{}) do
      {:ok, %{status: status, body: body}} when status in 200..299 ->
        {:ok, body}

      {:ok, %{status: status, body: body}} ->
        {:error, "EMA API error #{status}: #{inspect(body)}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # ── Tool: create_proposal ─────────────────────────────────────────────────

  defp call_create_proposal(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, title} <- require_string(args, "title"),
         {:ok, description} <- require_string(args, "description"),
         {:ok, project_id} <- require_string(args, "project_id"),
         context_keys = Map.get(args, "context_keys", []),
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           post("/api/proposals", %{
             title: title,
             body: description,
             project_id: project_id,
             context_keys: context_keys,
             source: "mcp",
             mcp_request_id: request_id
           }) do
      duration = System.monotonic_time(:millisecond) - start_time

      log_mcp_call("create_proposal", request_id, :success, duration)

      {:ok,
       %{
         proposal_id: body["id"],
         title: body["title"],
         status: body["status"],
         streaming_topic: "ema:proposals:#{body["id"]}",
         initial_output: Map.get(body, "body", ""),
         message: "Proposal created. Subscribe to streaming_topic for real-time generation."
       }}
    else
      {:error, reason} ->
        log_mcp_call("create_proposal", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("create_proposal", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  # ── Tool: create_task ─────────────────────────────────────────────────────

  defp call_create_task(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, title} <- require_string(args, "title"),
         {:ok, description} <- require_string(args, "description"),
         {:ok, project_id} <- require_string(args, "project_id"),
         payload = %{
           title: title,
           description: description,
           project_id: project_id,
           goal_id: Map.get(args, "goal_id"),
           priority: Map.get(args, "priority", "medium"),
           estimated_time: Map.get(args, "estimated_time"),
           source: "mcp",
           mcp_request_id: request_id
         },
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           post("/api/tasks", payload) do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("create_task", request_id, :success, duration)

      {:ok,
       %{
         task_id: body["id"],
         title: body["title"],
         status: body["status"],
         priority: body["priority"],
         project_id: body["project_id"],
         goal_id: body["goal_id"],
         assigned_to: Map.get(body, "assigned_to", "unassigned"),
         message: "Task created successfully."
       }}
    else
      {:error, reason} ->
        log_mcp_call("create_task", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("create_task", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  # ── Tool: update_task ─────────────────────────────────────────────────────

  defp call_update_task(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, task_id} <- require_string(args, "task_id"),
         {:ok, status} <- require_enum(args, "status", ~w(pending active done blocked)),
         notes = Map.get(args, "notes", ""),
         {:ok, %{status: http_status, body: task_body}} when http_status in 200..299 <-
           post("/api/tasks/#{task_id}/transition", %{
             status: status,
             notes: notes,
             source: "mcp",
             mcp_request_id: request_id
           }) do
      # Also fetch updated goal progress if the task has a goal
      goal_progress = fetch_goal_progress(task_body)

      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("update_task", request_id, :success, duration)

      {:ok,
       %{
         task_id: task_body["id"],
         title: task_body["title"],
         status: task_body["status"],
         notes: task_body["notes"],
         updated_goal_progress: goal_progress,
         message: "Task updated to status: #{status}"
       }}
    else
      {:error, reason} ->
        log_mcp_call("update_task", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: http_status, body: body}} ->
        log_mcp_call("update_task", request_id, :error, 0)
        {:error, "EMA API error #{http_status}: #{inspect(body)}"}
    end
  end

  # ── Tool: query_vault ─────────────────────────────────────────────────────

  defp call_query_vault(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, query} <- require_string(args, "query"),
         limit = min(Map.get(args, "limit", 5), 20),
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           get("/api/vectors/query?q=#{URI.encode(query)}&k=#{limit}") do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("query_vault", request_id, :success, duration)

      results = body["results"] || []

      {:ok,
       %{
         query: query,
         limit: limit,
         results: format_vault_results(results),
         total: length(results),
         message: "Found #{length(results)} vault matches."
       }}
    else
      {:error, reason} ->
        log_mcp_call("query_vault", request_id, :error, 0)
        # Vault down — return empty results, don't fail
        Logger.warning("[MCP Tools] Vault search failed: #{inspect(reason)}")

        {:ok,
         %{
           query: Map.get(args, "query", ""),
           results: [],
           total: 0,
           degraded: true,
           message: "Vault search unavailable: #{inspect(reason)}"
         }}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("query_vault", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  # ── Tool: log_outcome ─────────────────────────────────────────────────────

  defp call_log_outcome(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, task_id} <- require_string(args, "task_id"),
         {:ok, outcome} <- require_enum(args, "outcome", ~w(success failure warning)),
         {:ok, feedback} <- require_string(args, "feedback"),
         duration_seconds = Map.get(args, "duration_seconds"),
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           post("/api/intelligence/outcomes", %{
             task_id: task_id,
             outcome: outcome,
             feedback: feedback,
             duration_seconds: duration_seconds,
             source: "mcp",
             mcp_request_id: request_id
           }) do
      elapsed = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("log_outcome", request_id, :success, elapsed)

      {:ok,
       %{
         task_id: task_id,
         outcome: outcome,
         logged_at: DateTime.utc_now() |> DateTime.to_iso8601(),
         insights: Map.get(body, "insights", []),
         patterns_detected: Map.get(body, "patterns_detected", []),
         message:
           "Outcome logged. #{length(Map.get(body, "patterns_detected", []))} pattern(s) detected."
       }}
    else
      {:error, reason} ->
        log_mcp_call("log_outcome", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("log_outcome", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  # ── Tool: Intent Engine ───────────────────────────────────────────────────

  defp call_get_intents(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    query_params =
      %{}
      |> maybe_put("project_id", Map.get(args, "project_id"))
      |> maybe_put("level", Map.get(args, "level"))
      |> maybe_put("status", Map.get(args, "status"))
      |> maybe_put("kind", Map.get(args, "kind"))
      |> maybe_put("limit", Map.get(args, "limit", 20))

    qs = URI.encode_query(query_params)
    path = if qs == "", do: "/api/intents", else: "/api/intents?#{qs}"

    case get(path) do
      {:ok, %{status: status, body: body}} when status in 200..299 ->
        duration = System.monotonic_time(:millisecond) - start_time
        log_mcp_call("ema_get_intents", request_id, :success, duration)

        intents = Map.get(body, "intents", Map.get(body, "data", body))
        intents_list = List.wrap(intents)

        {:ok,
         %{
           intents: intents_list,
           count: length(intents_list),
           filters: query_params,
           message: "#{length(intents_list)} intent(s) found."
         }}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("ema_get_intents", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}

      {:error, reason} ->
        log_mcp_call("ema_get_intents", request_id, :error, 0)
        {:error, reason}
    end
  end

  defp call_create_intent(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, title} <- require_string(args, "title"),
         payload = %{
           title: title,
           description: Map.get(args, "description"),
           level: Map.get(args, "level", 4),
           kind: Map.get(args, "kind", "task"),
           project_id: Map.get(args, "project_id"),
           parent_id: Map.get(args, "parent_id"),
           source_type: "mcp"
         },
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           post("/api/intents", payload) do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("ema_create_intent", request_id, :success, duration)

      intent = Map.get(body, "data", body)

      {:ok,
       %{
         intent: intent,
         message: "Intent created: #{intent["title"] || title}"
       }}
    else
      {:error, reason} ->
        log_mcp_call("ema_create_intent", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("ema_create_intent", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  defp call_get_intent_tree(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    path =
      case Map.get(args, "project_id") do
        nil -> "/api/intents/tree"
        pid -> "/api/intents/tree?project_id=#{URI.encode(to_string(pid))}"
      end

    case get(path) do
      {:ok, %{status: status, body: body}} when status in 200..299 ->
        duration = System.monotonic_time(:millisecond) - start_time
        log_mcp_call("ema_get_intent_tree", request_id, :success, duration)

        tree = Map.get(body, "tree", Map.get(body, "data", body))

        {:ok,
         %{
           tree: tree,
           message: "Intent tree fetched."
         }}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("ema_get_intent_tree", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}

      {:error, reason} ->
        log_mcp_call("ema_get_intent_tree", request_id, :error, 0)
        {:error, reason}
    end
  end

  defp call_get_intent_context(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, intent_id} <- require_string(args, "intent_id"),
         {:ok, %{status: s1, body: intent_body}} when s1 in 200..299 <-
           get("/api/intents/#{intent_id}"),
         {:ok, %{status: s2, body: lineage_body}} when s2 in 200..299 <-
           get("/api/intents/#{intent_id}/lineage") do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("ema_get_intent_context", request_id, :success, duration)

      intent = Map.get(intent_body, "data", intent_body)
      lineage_events = Map.get(lineage_body, "events", Map.get(lineage_body, "data", []))

      {:ok,
       %{
         intent: intent,
         links: Map.get(intent, "links", []),
         lineage: lineage_events,
         message: "Intent context fetched for #{intent["title"] || intent_id}."
       }}
    else
      {:error, reason} ->
        log_mcp_call("ema_get_intent_context", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("ema_get_intent_context", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  defp call_attach_intent_actor(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, intent_id} <- require_string(args, "intent_id"),
         {:ok, actor_id} <- require_string(args, "actor_id"),
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           post("/api/intents/#{intent_id}/actors", %{
             actor_id: actor_id,
             role: Map.get(args, "role", "assignee"),
             provenance: Map.get(args, "provenance", "manual")
           }) do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("ema_attach_intent_actor", request_id, :success, duration)
      {:ok, %{link: body, message: "Actor attached to intent."}}
    else
      {:error, reason} ->
        log_mcp_call("ema_attach_intent_actor", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("ema_attach_intent_actor", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  defp call_attach_intent_execution(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, intent_id} <- require_string(args, "intent_id"),
         {:ok, execution_id} <- require_string(args, "execution_id"),
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           post("/api/intents/#{intent_id}/executions", %{
             execution_id: execution_id,
             role: Map.get(args, "role", "runtime"),
             provenance: Map.get(args, "provenance", "execution")
           }) do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("ema_attach_intent_execution", request_id, :success, duration)
      {:ok, %{link: body, message: "Execution attached to intent."}}
    else
      {:error, reason} ->
        log_mcp_call("ema_attach_intent_execution", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("ema_attach_intent_execution", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  defp call_attach_intent_session(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, intent_id} <- require_string(args, "intent_id"),
         {:ok, session_id} <- require_string(args, "session_id"),
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           post("/api/intents/#{intent_id}/sessions", %{
             session_id: session_id,
             session_type: Map.get(args, "session_type", "claude_session"),
             role: Map.get(args, "role", "runtime"),
             provenance: Map.get(args, "provenance")
           }) do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("ema_attach_intent_session", request_id, :success, duration)
      {:ok, %{link: body, message: "Session attached to intent."}}
    else
      {:error, reason} ->
        log_mcp_call("ema_attach_intent_session", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("ema_attach_intent_session", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  defp call_get_intent_runtime(args, request_id) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, intent_id} <- require_string(args, "intent_id"),
         {:ok, %{status: status, body: body}} when status in 200..299 <-
           get("/api/intents/#{intent_id}/runtime") do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("ema_get_intent_runtime", request_id, :success, duration)
      {:ok, body}
    else
      {:error, reason} ->
        log_mcp_call("ema_get_intent_runtime", request_id, :error, 0)
        {:error, reason}

      {:ok, %{status: status, body: body}} ->
        log_mcp_call("ema_get_intent_runtime", request_id, :error, 0)
        {:error, "EMA API error #{status}: #{inspect(body)}"}
    end
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  # ── Private: HTTP Helpers ─────────────────────────────────────────────────

  defp get(path) do
    url = @base_url <> path

    case Req.get(url,
           receive_timeout: @api_timeout,
           headers: mcp_headers()
         ) do
      {:ok, resp} -> {:ok, resp}
      {:error, reason} -> {:error, reason}
    end
  end

  defp post(path, body) do
    url = @base_url <> path

    case Req.post(url,
           json: body,
           receive_timeout: @api_timeout,
           headers: mcp_headers()
         ) do
      {:ok, resp} -> {:ok, resp}
      {:error, reason} -> {:error, reason}
    end
  end

  defp mcp_headers do
    depth = RecursionGuard.current_depth()

    [
      {"x-mcp-internal", "true"},
      {"x-mcp-depth", Integer.to_string(depth)}
    ]
  end

  # ── Private: Validation ───────────────────────────────────────────────────

  defp require_string(args, key) do
    case Map.get(args, key) do
      nil -> {:error, "Required parameter '#{key}' is missing"}
      "" -> {:error, "Required parameter '#{key}' cannot be empty"}
      val when is_binary(val) -> {:ok, val}
      val -> {:ok, to_string(val)}
    end
  end

  defp require_enum(args, key, valid_values) do
    case Map.get(args, key) do
      nil ->
        {:error, "Required parameter '#{key}' is missing"}

      val when is_binary(val) ->
        if val in valid_values do
          {:ok, val}
        else
          {:error, "Parameter '#{key}' must be one of: #{Enum.join(valid_values, ", ")}"}
        end

      val ->
        {:error, "Parameter '#{key}' must be a string, got: #{inspect(val)}"}
    end
  end

  # ── Private: Formatters ───────────────────────────────────────────────────

  defp format_vault_results(body) when is_list(body) do
    Enum.map(body, fn item ->
      %{
        id: item["id"],
        title: item["title"] || item["name"],
        snippet: truncate(item["content"] || item["snippet"] || "", 400),
        path: item["path"],
        score: item["score"],
        backlinks: Map.get(item, "backlinks", [])
      }
    end)
  end

  defp format_vault_results(_), do: []

  defp truncate(text, max) when byte_size(text) > max do
    String.slice(text, 0, max) <> "…"
  end

  defp truncate(text, _max), do: text

  defp fetch_goal_progress(%{"goal_id" => goal_id}) when is_binary(goal_id) and goal_id != "" do
    case get("/api/goals/#{goal_id}") do
      {:ok, %{status: 200, body: goal}} ->
        %{
          goal_id: goal_id,
          title: goal["title"],
          progress: goal["progress"],
          status: goal["status"]
        }

      _ ->
        nil
    end
  end

  defp fetch_goal_progress(_), do: nil

  # ── Private: Cost + Outcome Tracking ─────────────────────────────────────

  defp log_mcp_call(tool_name, request_id, result, duration_ms) do
    # Fire-and-forget: log this MCP call for cost tracking + audit
    Task.start(fn ->
      payload = %{
        tool: tool_name,
        request_id: request_id,
        result: result,
        duration_ms: duration_ms,
        depth: RecursionGuard.current_depth(),
        logged_at: DateTime.utc_now() |> DateTime.to_iso8601()
      }

      case Req.post("#{@base_url}/api/intelligence/mcp-calls",
             json: payload,
             receive_timeout: 5_000,
             headers: [{"x-mcp-internal", "true"}]
           ) do
        {:ok, _} ->
          :ok

        {:error, reason} ->
          Logger.debug("[MCP Tools] Cost log failed (non-critical): #{inspect(reason)}")
      end
    end)
  end

  defp resolve_project_id(project_ref) do
    with {:ok, %{status: 200, body: body}} <- get("/api/projects"),
         projects <- Map.get(body, "projects", []),
         project when not is_nil(project) <-
           Enum.find(projects, fn p -> project_ref in [p["id"], p["slug"], p["name"]] end) do
      {:ok, project["id"]}
    else
      nil ->
        {:error, "Project not found: #{project_ref}"}

      {:ok, %{status: status, body: body}} ->
        {:error, "EMA API error #{status}: #{inspect(body)}"}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
