defmodule Ema.CLI.Commands.Status do
  @moduledoc "System status overview — quick health check."

  alias Ema.CLI.Output

  def handle([], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        status = gather_direct_status(transport)

        if opts[:json] do
          Output.json(status)
        else
          print_status(status)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/health") do
          {:ok, health} ->
            if opts[:json] do
              Output.json(health)
            else
              IO.puts("Daemon:    online")
              print_map_fields(health)
            end

          {:error, reason} ->
            Output.error("Daemon unreachable: #{inspect(reason)}")
        end
    end
  end

  defp gather_direct_status(transport) do
    tasks =
      case transport.call(Ema.Tasks, :count_by_status, []) do
        {:ok, counts} -> counts
        _ -> %{}
      end

    proposals =
      case transport.call(Ema.Proposals, :list_proposals, [limit: 5, status: "queued"]) do
        {:ok, list} -> length(list)
        _ -> 0
      end

    agents =
      case transport.call(Ema.Agents, :list_active_agents, []) do
        {:ok, list} -> length(list)
        _ -> 0
      end

    focus =
      case transport.call(Ema.Focus.Timer, :status, []) do
        {:ok, s} -> s[:phase] || "idle"
        _ -> "unknown"
      end

    %{
      daemon: "online",
      tasks: tasks,
      queued_proposals: proposals,
      active_agents: agents,
      focus: focus
    }
  end

  defp print_status(status) do
    IO.puts("EMA Status")
    IO.puts(String.duplicate("─", 40))
    IO.puts("  Daemon:     #{status.daemon}")
    IO.puts("  Focus:      #{status.focus}")
    IO.puts("  Agents:     #{status.active_agents} active")
    IO.puts("  Proposals:  #{status.queued_proposals} queued")

    if is_map(status.tasks) and map_size(status.tasks) > 0 do
      IO.puts("  Tasks:")

      Enum.each(status.tasks, fn {k, v} ->
        IO.puts("    #{k}: #{v}")
      end)
    end
  end

  defp print_map_fields(map) when is_map(map) do
    Enum.each(map, fn {k, v} ->
      IO.puts("  #{k}: #{inspect(v)}")
    end)
  end
end
