defmodule EmaCli.AiSession do
  @moduledoc "CLI commands for AI sessions"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, error: 1, success: 1, format_output: 2]

  def run("list", opts) do
    case api_get("/ai-sessions") do
      {:ok, %{"sessions" => sessions}} -> format_output(sessions, opts)
      {:ok, sessions} when is_list(sessions) -> format_output(sessions, opts)
      {:error, msg} -> error(msg)
    end
  end

  def run("show", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema ai-session show <id>")

    case api_get("/ai-sessions/#{id}") do
      {:ok, session} when is_map(session) ->
        IO.puts("\n\e[1mAI Session: #{id}\e[0m")
        IO.puts("  Agent:   #{session["agent"] || session["agent_id"] || "none"}")
        IO.puts("  Status:  #{session["status"] || "unknown"}")
        IO.puts("  Model:   #{session["model"] || "default"}")
        IO.puts("  Created: #{session["created_at"] || session["inserted_at"] || "n/a"}")
        IO.puts("  Tokens:  #{session["token_count"] || 0}")

      {:error, msg} ->
        error(msg)
    end
  end

  def run("create", opts) do
    agent = Map.get(opts, :agent)
    body = if agent, do: %{agent: agent}, else: %{}

    case api_post("/ai-sessions", body) do
      {:ok, session} -> success("Created AI session #{session["id"] || "ok"}")
      {:error, msg} -> error(msg)
    end
  end

  def run("resume", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema ai-session resume <id>")

    case api_post("/ai-sessions/#{id}/resume", %{}) do
      {:ok, _} -> success("Resumed AI session #{id}")
      {:error, msg} -> error(msg)
    end
  end

  def run("fork", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema ai-session fork <id>")

    case api_post("/ai-sessions/#{id}/fork", %{}) do
      {:ok, forked} -> success("Forked AI session #{id} -> #{forked["id"] || "new"}")
      {:error, msg} -> error(msg)
    end
  end

  def run(unknown, _),
    do: error("Unknown ai-session subcommand: #{unknown}. Try: list, show, create, resume, fork")
end
