defmodule Ema.CLI.Commands.Focus do
  @moduledoc "CLI commands for focus timer."

  alias Ema.CLI.Output

  def handle([:start], parsed, transport, opts) do
    duration_min = parsed.options[:duration] || 25
    target_ms = duration_min * 60 * 1000
    task_id = parsed.options[:task]
    start_opts = [target_ms: target_ms]
    start_opts = if task_id, do: [{:task_id, task_id} | start_opts], else: start_opts

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Focus.Timer, :start_session, [start_opts]) do
          {:ok, session} ->
            Output.success("Focus started (#{duration_min}m)")
            if opts[:json], do: Output.json(session)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"target_ms" => target_ms}
        body = if task_id, do: Map.put(body, "task_id", task_id), else: body

        case transport.post("/focus/start", body) do
          {:ok, _} -> Output.success("Focus started (#{duration_min}m)")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:stop], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Focus.Timer, :stop_session, []) do
          {:ok, session} ->
            elapsed = div(session.target_ms || 0, 60_000)
            Output.success("Focus stopped (#{elapsed}m)")
            if opts[:json], do: Output.json(session)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/focus/stop") do
          {:ok, _} -> Output.success("Focus stopped")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:pause], _parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Focus.Timer, :pause, []) do
          {:ok, _} -> Output.success("Focus paused")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/focus/pause") do
          {:ok, _} -> Output.success("Focus paused")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:resume], _parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Focus.Timer, :resume, []) do
          {:ok, _} -> Output.success("Focus resumed")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/focus/resume") do
          {:ok, _} -> Output.success("Focus resumed")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:current], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Focus.Timer, :status, []) do
          {:ok, status} ->
            if opts[:json] do
              Output.json(status)
            else
              print_status(status)
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/focus/current") do
          {:ok, status} ->
            if opts[:json], do: Output.json(status), else: print_status(status)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:today], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Focus, :today_stats, []) do
          {:ok, stats} ->
            if opts[:json] do
              Output.json(stats)
            else
              print_stats("Today", stats)
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/focus/today") do
          {:ok, stats} ->
            if opts[:json], do: Output.json(stats), else: print_stats("Today", stats)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:weekly], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Focus, :weekly_stats, []) do
          {:ok, stats} ->
            if opts[:json] do
              Output.json(stats)
            else
              print_stats("This Week", stats)
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/focus/weekly") do
          {:ok, stats} ->
            if opts[:json], do: Output.json(stats), else: print_stats("This Week", stats)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown focus subcommand: #{inspect(sub)}")
  end

  defp print_status(status) when is_map(status) do
    phase = status[:phase] || status["phase"] || "idle"
    elapsed = status[:elapsed_ms] || status["elapsed_ms"] || 0
    minutes = div(elapsed, 60_000)
    seconds = rem(div(elapsed, 1000), 60)

    IO.puts("Phase:   #{phase}")
    IO.puts("Elapsed: #{minutes}m #{seconds}s")

    if task_id = status[:task_id] || status["task_id"] do
      IO.puts("Task:    ##{task_id}")
    end
  end

  defp print_stats(label, stats) when is_map(stats) do
    sessions = stats[:sessions] || stats["sessions"] || stats[:session_count] || 0
    completed = stats[:completed] || stats["completed"] || 0
    total_ms = stats[:total_work_ms] || stats["total_work_ms"] || stats[:total_ms] || 0
    hours = div(total_ms, 3_600_000)
    minutes = rem(div(total_ms, 60_000), 60)

    IO.puts("#{label}:")
    IO.puts("  Sessions:  #{sessions} (#{completed} completed)")
    IO.puts("  Work time: #{hours}h #{minutes}m")
  end
end
