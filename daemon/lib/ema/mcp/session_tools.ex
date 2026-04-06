defmodule Ema.MCP.SessionTools do
  @moduledoc """
  MCP tools for session orchestration — lets Claude Code instances
  discover, spawn, resume, and coordinate with other sessions through EMA.
  """

  require Logger
  alias Ema.Sessions.Orchestrator

  def list do
    [
      %{
        "name" => "ema_list_sessions",
        "description" =>
          "List all Claude Code sessions known to EMA — both actively running and recently detected. Shows session ID, status, project, and whether the session is live.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "active_only" => %{
              "type" => "boolean",
              "description" => "If true, only show currently running sessions",
              "default" => false
            }
          }
        }
      },
      %{
        "name" => "ema_spawn_session",
        "description" =>
          "Spawn a new Claude Code session with EMA context automatically injected. The session runs in the background and EMA tracks its progress. Use this to delegate work to another Claude Code instance.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "prompt" => %{
              "type" => "string",
              "description" => "The task prompt for the new session"
            },
            "project_slug" => %{
              "type" => "string",
              "description" => "EMA project slug to run in (determines working directory)"
            },
            "task_id" => %{
              "type" => "string",
              "description" => "EMA task ID to link this session to"
            },
            "model" => %{
              "type" => "string",
              "description" => "Claude model to use (default: sonnet)",
              "enum" => ["sonnet", "opus", "haiku"]
            },
            "inject_context" => %{
              "type" => "boolean",
              "description" => "Inject EMA project/task context into prompt (default: true)",
              "default" => true
            }
          },
          "required" => ["prompt"]
        }
      },
      %{
        "name" => "ema_session_context",
        "description" =>
          "Get the EMA context bundle for a project — active tasks, goals, recent proposals. Use this to understand what's happening before spawning a session or to inject context into your own work.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "project_slug" => %{
              "type" => "string",
              "description" => "EMA project slug (optional — uses current if omitted)"
            }
          }
        }
      },
      %{
        "name" => "ema_check_session",
        "description" =>
          "Check the status and output of a session. Returns whether it's still running, its exit code, and output summary. Use this to follow up on spawned sessions.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "session_id" => %{
              "type" => "string",
              "description" => "Session ID to check"
            }
          },
          "required" => ["session_id"]
        }
      },
      %{
        "name" => "ema_resume_session",
        "description" =>
          "Send a follow-up prompt to continue work in the same project as a previous session. Creates a new session linked to the same context.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "session_id" => %{
              "type" => "string",
              "description" => "Session ID to resume from (uses same project directory)"
            },
            "prompt" => %{
              "type" => "string",
              "description" => "Follow-up prompt"
            }
          },
          "required" => ["session_id", "prompt"]
        }
      },
      %{
        "name" => "ema_kill_session",
        "description" =>
          "Kill a running CLI session. Only works for sessions spawned through EMA.",
        "inputSchema" => %{
          "type" => "object",
          "properties" => %{
            "session_id" => %{
              "type" => "string",
              "description" => "Session ID to kill"
            }
          },
          "required" => ["session_id"]
        }
      }
    ]
  end

  def call("ema_list_sessions", args, _request_id) do
    active_only = Map.get(args, "active_only", false)

    result =
      if active_only do
        Orchestrator.list_active()
      else
        Orchestrator.list_all()
      end

    {:ok, sessions} = result

    {:ok, %{
      sessions: Enum.map(sessions, &serialize_session/1),
      count: length(sessions),
      message: "#{length(sessions)} session(s) found"
    }}
  end

  def call("ema_spawn_session", args, _request_id) do
    with {:ok, prompt} <- require_string(args, "prompt") do
      opts = [
        project_slug: Map.get(args, "project_slug"),
        task_id: Map.get(args, "task_id"),
        model: Map.get(args, "model", "sonnet"),
        inject_context: Map.get(args, "inject_context", true)
      ]

      case Orchestrator.spawn(prompt, opts) do
        {:ok, result} ->
          {:ok, Map.merge(result, %{
            message: "Session spawned. Use ema_check_session to monitor progress."
          })}

        {:error, reason} ->
          {:error, inspect(reason)}
      end
    end
  end

  def call("ema_session_context", args, _request_id) do
    opts = [project_slug: Map.get(args, "project_slug")]

    {:ok, context} = Orchestrator.build_context(opts)
    {:ok, context}
  end

  def call("ema_check_session", args, _request_id) do
    with {:ok, session_id} <- require_string(args, "session_id") do
      case Orchestrator.check_session(session_id) do
        {:error, reason} -> {:error, reason}
        status -> {:ok, status}
      end
    end
  end

  def call("ema_resume_session", args, _request_id) do
    with {:ok, session_id} <- require_string(args, "session_id"),
         {:ok, prompt} <- require_string(args, "prompt") do
      case Orchestrator.resume(session_id, prompt) do
        {:ok, result} ->
          {:ok, Map.merge(result, %{
            message: "Follow-up session spawned from #{session_id}"
          })}

        {:error, reason} ->
          {:error, inspect(reason)}
      end
    end
  end

  def call("ema_kill_session", args, _request_id) do
    with {:ok, session_id} <- require_string(args, "session_id") do
      case Orchestrator.kill(session_id) do
        {:ok, result} -> {:ok, result}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  def call(name, _args, _request_id) do
    {:error, "Unknown session tool: #{name}"}
  end

  # -- Private --

  defp serialize_session(session) do
    session
    |> Map.from_struct()
    |> Map.drop([:__meta__])
    |> Map.new(fn {k, v} -> {to_string(k), v} end)
  rescue
    _ -> Map.new(session, fn {k, v} -> {to_string(k), v} end)
  end

  defp require_string(args, key) do
    case Map.get(args, key) do
      nil -> {:error, "Required parameter '#{key}' is missing"}
      "" -> {:error, "Required parameter '#{key}' cannot be empty"}
      val when is_binary(val) -> {:ok, val}
      val -> {:ok, to_string(val)}
    end
  end
end
