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
            status = Helpers.extract_record(body, "status")

            if opts[:json] do
              Output.json(status)
            else
              IO.puts("Proposal Engine")
              IO.puts(String.duplicate("─", 40))

              Enum.each(status, fn {k, v} ->
                IO.puts("  #{k}: #{inspect(v)}")
              end)
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

  defp genserver_state(module) do
    case Process.whereis(module) do
      nil -> "not running"
      pid -> if Process.alive?(pid), do: "running", else: "dead"
    end
  rescue
    _ -> "unknown"
  end
end
