defmodule Ema.CLI.Commands.McpServe do
  @moduledoc """
  Standalone MCP server over stdio — runs as an escript process.
  Reads JSON-RPC 2.0 from stdin, dispatches to EMA daemon via HTTP,
  writes responses to stdout. No OTP app boot needed.
  """

  @server_info %{
    "name" => "ema-mcp",
    "version" => "2.0.0"
  }

  @protocol_version "2024-11-05"

  def handle([], _parsed, _transport, _opts) do
    serve_loop()
  end

  defp serve_loop do
    case IO.gets("") do
      :eof -> :ok
      {:error, _} -> :ok
      line when is_binary(line) ->
        line = String.trim(line)

        if line != "" do
          case Jason.decode(line) do
            {:ok, msg} -> handle_message(msg)
            {:error, _} -> :ok
          end
        end

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

  defp handle_message(%{"id" => id, "method" => "ping"}) do
    send_response(id, %{})
  end

  defp handle_message(%{"id" => id, "method" => "tools/list"}) do
    send_response(id, %{"tools" => all_tools()})
  end

  defp handle_message(%{"id" => id, "method" => "tools/call", "params" => params}) do
    name = params["name"]
    args = params["arguments"] || %{}

    case call_tool(name, args) do
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

  defp handle_message(%{"id" => id}) do
    send_error(id, -32601, "Method not found")
  end

  defp handle_message(_), do: :ok

  # -- Tool registry --

  defp all_tools do
    [
      tool("ema_health", "Check EMA daemon health", %{}),
      tool("ema_get_projects", "List all EMA projects", %{}),
      tool("ema_get_tasks", "Get tasks, optionally filtered", %{
        "project_id" => %{"type" => "string"},
        "status" => %{"type" => "string"}
      }),
      tool("ema_create_task", "Create a task in EMA", %{
        "title" => %{"type" => "string"},
        "project_id" => %{"type" => "string"},
        "priority" => %{"type" => "string"},
        "description" => %{"type" => "string"}
      }, ["title"]),
      tool("ema_brain_dump", "Add to EMA brain dump", %{
        "content" => %{"type" => "string"}
      }, ["content"]),
      tool("ema_search_vault", "Search EMA vault", %{
        "query" => %{"type" => "string"},
        "space" => %{"type" => "string"}
      }, ["query"]),
      tool("ema_get_vault", "List vault notes", %{
        "space" => %{"type" => "string"}
      }),
      tool("ema_get_executions", "Get executions", %{
        "limit" => %{"type" => "number"},
        "status" => %{"type" => "string"}
      }),
      tool("ema_dispatch_execution", "Dispatch execution", %{
        "intent" => %{"type" => "string"},
        "mode" => %{"type" => "string"},
        "project_id" => %{"type" => "string"}
      }, ["intent"]),
      tool("ema_get_goals", "Get EMA goals", %{}),
      tool("ema_get_focus", "Get current focus session", %{}),
      # Session orchestration
      tool("ema_list_sessions", "List all Claude Code sessions known to EMA", %{
        "active_only" => %{"type" => "boolean", "description" => "Only show running sessions"}
      }),
      tool("ema_spawn_session", "Spawn a new Claude Code session with EMA context injected", %{
        "prompt" => %{"type" => "string", "description" => "Task prompt"},
        "project_slug" => %{"type" => "string", "description" => "EMA project slug"},
        "task_id" => %{"type" => "string", "description" => "EMA task to link"},
        "model" => %{"type" => "string", "enum" => ["sonnet", "opus", "haiku"]}
      }, ["prompt"]),
      tool("ema_check_session", "Check status and output of a spawned session", %{
        "session_id" => %{"type" => "string"}
      }, ["session_id"]),
      tool("ema_session_context", "Get EMA project context bundle for injection", %{
        "project_slug" => %{"type" => "string"}
      }),
      tool("ema_resume_session", "Follow-up on a session in the same project", %{
        "session_id" => %{"type" => "string"},
        "prompt" => %{"type" => "string"}
      }, ["session_id", "prompt"]),
      tool("ema_kill_session", "Kill a running session", %{
        "session_id" => %{"type" => "string"}
      }, ["session_id"]),
      # Context packages
      tool("context_operator", "Fetch EMA operator context package", %{}),
      tool("context_project", "Fetch project context package", %{
        "project" => %{"type" => "string", "description" => "Project id, slug, or name"}
      }, ["project"])
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

  # -- Tool dispatch --

  defp call_tool("ema_health", _args), do: api_get("/health")
  defp call_tool("ema_get_projects", _args), do: api_get("/projects")
  defp call_tool("ema_get_tasks", args), do: api_get("/tasks", args)
  defp call_tool("ema_create_task", args), do: api_post("/tasks", %{"task" => args})
  defp call_tool("ema_brain_dump", args), do: api_post("/brain-dump/items", args)
  defp call_tool("ema_search_vault", %{"query" => q} = args), do: api_get("/vault/search", %{"q" => q, "space" => args["space"]})
  defp call_tool("ema_search_vault", _), do: {:error, "query is required"}
  defp call_tool("ema_get_vault", args), do: api_get("/vault/tree", args)
  defp call_tool("ema_get_executions", args), do: api_get("/executions", args)
  defp call_tool("ema_dispatch_execution", args), do: api_post("/executions", args)
  defp call_tool("ema_get_goals", _args), do: api_get("/goals")
  defp call_tool("ema_get_focus", _args), do: api_get("/focus/current")

  # Session orchestration
  defp call_tool("ema_list_sessions", args) do
    qs = if args["active_only"], do: "?active_only=true", else: ""
    api_get("/orchestrator/sessions#{qs}")
  end

  defp call_tool("ema_spawn_session", args), do: api_post("/orchestrator/sessions/spawn", args)
  defp call_tool("ema_check_session", %{"session_id" => id}), do: api_get("/orchestrator/sessions/#{id}/check")
  defp call_tool("ema_check_session", _), do: {:error, "session_id is required"}
  defp call_tool("ema_session_context", args) do
    qs = if args["project_slug"], do: "?project_slug=#{args["project_slug"]}", else: ""
    api_get("/orchestrator/context#{qs}")
  end

  defp call_tool("ema_resume_session", %{"session_id" => id, "prompt" => prompt}) do
    api_post("/orchestrator/sessions/#{id}/resume", %{"prompt" => prompt})
  end

  defp call_tool("ema_resume_session", _), do: {:error, "session_id and prompt required"}
  defp call_tool("ema_kill_session", %{"session_id" => id}), do: api_post("/orchestrator/sessions/#{id}/kill", %{})
  defp call_tool("ema_kill_session", _), do: {:error, "session_id is required"}

  # Context packages
  defp call_tool("context_operator", _args), do: api_get("/context/operator/package")
  defp call_tool("context_project", %{"project" => ref}), do: api_get("/context/project/#{ref}/package")
  defp call_tool("context_project", _), do: {:error, "project is required"}

  defp call_tool(name, _args), do: {:error, "Unknown tool: #{name}"}

  # -- HTTP --

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

  # -- Protocol --

  defp send_response(id, result) do
    frame = Jason.encode!(%{"jsonrpc" => "2.0", "id" => id, "result" => result})
    IO.puts(frame)
  end

  defp send_error(id, code, message) do
    frame = Jason.encode!(%{"jsonrpc" => "2.0", "id" => id, "error" => %{"code" => code, "message" => message}})
    IO.puts(frame)
  end
end
