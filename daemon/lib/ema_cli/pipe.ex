defmodule EmaCli.Pipe do
  @moduledoc "CLI commands for Pipes automation"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, format_output: 2, error: 1, warn: 1, success: 1]

  def run("list", opts) do
    case api_get("/pipes") do
      {:ok, %{"pipes" => pipes}} -> format_output(pipes, opts)
      {:ok, pipes} when is_list(pipes) -> format_output(pipes, opts)
      {:error, msg} -> error(msg)
    end
  end

  def run("show", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema pipe show <id>")

    case api_get("/pipes/#{id}") do
      {:ok, pipe} when is_map(pipe) ->
        IO.puts("\n\e[1mPipe: #{pipe["name"] || id}\e[0m")
        IO.puts("  ID:      #{pipe["id"]}")
        IO.puts("  Status:  #{pipe["status"] || "unknown"}")
        IO.puts("  Trigger: #{pipe["trigger_pattern"] || "none"}")
        IO.puts("  Updated: #{pipe["updated_at"] || "n/a"}")

        actions = pipe["actions"] || []

        if actions != [] do
          IO.puts("\n  Actions:")
          Enum.each(actions, fn a -> IO.puts("    -> #{a["type"] || a["action_type"]}") end)
        end

      {:error, msg} ->
        error(msg)
    end
  end

  def run("create", opts) do
    name = Map.get(opts, :_arg) || error("Usage: ema pipe create <name>")
    trigger = Map.get(opts, :trigger, "manual:trigger")

    case api_post("/pipes", %{pipe: %{name: name, trigger_pattern: trigger, status: "paused"}}) do
      {:ok, pipe} -> success("Created pipe #{pipe["id"]}: #{name}")
      {:error, msg} -> error(msg)
    end
  end

  def run("toggle", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema pipe toggle <id>")

    case api_post("/pipes/#{id}/toggle", %{}) do
      {:ok, pipe} -> success("Pipe #{id} is now #{pipe["status"] || "toggled"}")
      {:error, msg} -> error(msg)
    end
  end

  def run("catalog", opts) do
    case api_get("/pipes/catalog") do
      {:ok, %{"triggers" => triggers, "actions" => actions}} ->
        IO.puts("\n\e[1mTriggers\e[0m")
        Enum.each(triggers, fn t -> IO.puts("  #{t}") end)
        IO.puts("\n\e[1mActions\e[0m")
        Enum.each(actions, fn a -> IO.puts("  #{a}") end)

      {:ok, data} when is_map(data) ->
        format_output([data], opts)

      {:error, _} ->
        warn("Pipe catalog not available")
    end
  end

  def run("history", opts) do
    limit = Map.get(opts, :limit, "20")

    case api_get("/pipes/history?limit=#{limit}") do
      {:ok, %{"runs" => runs}} -> format_output(runs, opts)
      {:ok, runs} when is_list(runs) -> format_output(runs, opts)
      {:error, _} -> warn("Pipe history not available")
    end
  end

  def run(unknown, _),
    do: error("Unknown pipe subcommand: #{unknown}. Try: list, show, create, toggle, catalog, history")
end
