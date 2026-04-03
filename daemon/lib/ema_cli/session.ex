defmodule EmaCli.Session do
  @moduledoc "CLI commands for Session Continuity (DCC)"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, format_output: 2, error: 1, warn: 1, success: 1]

  def run("state", opts) do
    case api_get("/context") do
      {:ok, state} ->
        IO.puts("\n\e[1mSession State\e[0m")
        IO.puts("  ID:           #{state["session_id"] || "none"}")
        IO.puts("  Crystallized: #{state["crystallized_at"] || "no"}")
        IO.puts("  Project:      #{state["project_id"] || "none"}")
        IO.puts("  Tasks:        #{length(state["active_task_ids"] || [])}")
        IO.puts("  Narrative:    #{String.slice(state["session_narrative"] || "(none)", 0, 80)}")

        if Map.get(opts, :format) == "json",
          do: IO.puts("\n" <> Jason.encode!(state, pretty: true))

      {:error, _} ->
        warn("Session store not available -- F3 (Session Continuity) may not be deployed yet")
    end
  end

  def run("list", opts) do
    limit = Map.get(opts, :limit, "10")

    case api_get("/context/sessions?limit=#{limit}") do
      {:ok, data} ->
        sessions = if is_list(data), do: data, else: Map.get(data, "sessions", [])
        format_output(sessions, opts)

      {:error, _} ->
        warn("Session list not available")
    end
  end

  def run("crystallize", opts) do
    session_id = Map.get(opts, :_arg)
    body = if session_id, do: %{session_id: session_id}, else: %{}

    case api_post("/context/crystallize", body) do
      {:ok, result} ->
        success("Crystallized: #{result["session_id"]}")
        if Map.get(opts, :format) == "json", do: IO.puts(Jason.encode!(result, pretty: true))

      {:error, _} ->
        warn("Crystallize not available -- F3 not deployed")
    end
  end

  def run("export", opts) do
    case api_get("/context") do
      {:ok, state} ->
        json = Jason.encode!(state, pretty: true)

        case Map.get(opts, :output) do
          nil ->
            IO.puts(json)

          path ->
            File.write!(path, json)
            success("Exported to #{path}")
        end

      {:error, _} ->
        warn("Session export not available")
    end
  end

  def run(unknown, _),
    do: error("Unknown session subcommand: #{unknown}. Try: state, list, crystallize, export")
end
