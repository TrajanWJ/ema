defmodule Ema.CLI.Commands.Engine do
  @moduledoc "CLI commands for proposal engine control."

  alias Ema.CLI.{Helpers, Output}

  def handle([:status], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        # Engine status from GenServers
        status = %{
          scheduler: genserver_state(Ema.ProposalEngine.Scheduler),
          generator: genserver_state(Ema.ProposalEngine.Generator),
          refiner: genserver_state(Ema.ProposalEngine.Refiner),
          debater: genserver_state(Ema.ProposalEngine.Debater),
          tagger: genserver_state(Ema.ProposalEngine.Tagger)
        }

        if opts[:json] do
          Output.json(status)
        else
          IO.puts("Proposal Engine")
          IO.puts(String.duplicate("─", 40))

          Enum.each(status, fn {stage, state} ->
            IO.puts("  #{stage}: #{state}")
          end)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/engine/status") do
          {:ok, body} ->
            status = Helpers.extract_record(body, "engine") || Helpers.extract_record(body, "status") || body

            if opts[:json] do
              Output.json(status)
            else
              render_engine_status(status)
            end

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:pause], _parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        # Pause the scheduler
        GenServer.cast(Ema.ProposalEngine.Scheduler, :pause)
        Output.success("Engine paused")

      Ema.CLI.Transport.Http ->
        case transport.post("/engine/pause") do
          {:ok, _} -> Output.success("Engine paused")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:resume], _parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        GenServer.cast(Ema.ProposalEngine.Scheduler, :resume)
        Output.success("Engine resumed")

      Ema.CLI.Transport.Http ->
        case transport.post("/engine/resume") do
          {:ok, _} -> Output.success("Engine resumed")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown engine subcommand: #{inspect(sub)}")
  end

  defp render_engine_status(status) do
    paused = get_val(status, "paused")
    seeds = get_val(status, "active_seed_count")
    due = get_val(status, "due_now_count")
    dispatched = get_val(status, "seeds_dispatched")
    state = get_val(status, "derived_state")
    diag = get_val(status, "diagnostics") || %{}

    paused_label = if paused, do: IO.ANSI.red() <> "PAUSED" <> IO.ANSI.reset(), else: IO.ANSI.green() <> "ACTIVE" <> IO.ANSI.reset()

    IO.puts("")
    IO.puts(IO.ANSI.bright() <> "  Proposal Engine" <> IO.ANSI.reset() <> "  #{paused_label}")
    IO.puts("  state: #{state || "-"}")
    IO.puts("  seeds: #{seeds || 0} active, #{due || 0} due now, #{dispatched || 0} dispatched")

    last_gen = get_val(diag, "last_generation")
    last_tick = get_val(diag, "last_scheduler_tick_at")
    tick_count = get_val(diag, "scheduler_tick_count")

    if last_gen || last_tick do
      IO.puts("  last generation: #{last_gen || "-"}")
      IO.puts("  last tick: #{last_tick || "-"} (#{tick_count || 0} total)")
    end

    IO.puts("")
  end

  defp get_val(map, key) when is_map(map), do: Map.get(map, key) || Map.get(map, String.to_atom(key))
  defp get_val(_, _), do: nil

  defp genserver_state(module) do
    case Process.whereis(module) do
      nil -> "not running"
      pid -> if Process.alive?(pid), do: "running", else: "dead"
    end
  rescue
    _ -> "unknown"
  end
end
