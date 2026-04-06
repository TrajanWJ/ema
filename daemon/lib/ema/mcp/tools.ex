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
      }
      ,%{
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

  def call(name, _args, _request_id) do
    {:error, "Unknown tool: #{name}"}
  end

  # ── Tool: context_operator / context_project ─────────────────────────────

  defp call_context_operator(_args, _request_id) do
    case get("/api/context/operator/package") do
      {:ok, %{status: status, body: body}} when status in 200..299 -> {:ok, body}
      {:ok, %{status: status, body: body}} -> {:error, "EMA API error #{status}: #{inspect(body)}"}
      {:error, reason} -> {:error, reason}
    end
  end

  defp call_context_project(args, _request_id) do
    with {:ok, project_ref} <- require_string(args, "project"),
         {:ok, project_id} <- resolve_project_id(project_ref),
         {:ok, %{status: status, body: body}} when status in 200..299 <- get("/api/context/project/#{project_id}/package") do
      {:ok, body}
    else
      {:ok, %{status: status, body: body}} -> {:error, "EMA API error #{status}: #{inspect(body)}"}
      {:error, reason} -> {:error, reason}
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
             description: description,
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
           get("/api/vectors/search?query=#{URI.encode(query)}&limit=#{limit}") do
      duration = System.monotonic_time(:millisecond) - start_time
      log_mcp_call("query_vault", request_id, :success, duration)

      {:ok,
       %{
         query: query,
         limit: limit,
         results: format_vault_results(body),
         total: length(List.wrap(body)),
         message: "Found #{length(List.wrap(body))} vault matches."
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
end
