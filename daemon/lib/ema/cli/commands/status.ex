defmodule Ema.CLI.Commands.Status do
  @moduledoc "Comprehensive system status dashboard — the one command to check everything."

  alias Ema.CLI.Output

  @ansi_reset IO.ANSI.reset()
  @ansi_bold IO.ANSI.bright()
  @ansi_dim IO.ANSI.faint()
  @ansi_green IO.ANSI.green()
  @ansi_yellow IO.ANSI.yellow()
  @ansi_red IO.ANSI.red()
  @ansi_cyan IO.ANSI.cyan()
  @ansi_magenta IO.ANSI.magenta()

  def handle([], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        status = gather_direct_status(transport)

        if opts[:json] do
          Output.json(status)
        else
          print_dashboard(status)
        end

      Ema.CLI.Transport.Http ->
        status = gather_http_status(transport)

        if opts[:json] do
          Output.json(status)
        else
          print_dashboard(status)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown status subcommand: #{inspect(sub)}")
  end

  defp gather_direct_status(transport) do
    tasks = safe_call(transport, Ema.Tasks, :count_by_status, [], %{})

    queued_proposals =
      safe_call(transport, Ema.Proposals, :list_proposals, [[status: "queued"]], [])
      |> length()

    active_agents =
      safe_call(transport, Ema.Agents, :list_active_agents, [], [])
      |> length()

    running_execs =
      safe_call(transport, Ema.Executions, :list_executions, [[status: "running"]], [])
      |> length()

    pending_execs =
      safe_call(transport, Ema.Executions, :list_executions, [[status: "pending"]], [])
      |> length()

    goals = safe_call(transport, Ema.Goals, :list_goals, [[status: "active"]], [])

    engine_status =
      try do
        Ema.ProposalEngine.Scheduler.status()
      rescue
        _ -> %{paused: false}
      catch
        :exit, _ -> %{paused: false}
      end

    unprocessed_dumps =
      try do
        Ema.BrainDump.unprocessed_count()
      rescue
        _ -> 0
      end

    claude_available =
      try do
        Ema.Claude.Runner.available?()
      rescue
        _ -> false
      end

    recent_events =
      try do
        Ema.Chronicle.EventLog.recent(limit: 20)
      rescue
        _ -> []
      end

    seven_days_ago = DateTime.add(DateTime.utc_now(), -7, :day)

    recent_activity =
      recent_events
      |> Enum.filter(fn e ->
        case e.inserted_at do
          %NaiveDateTime{} = ndt ->
            DateTime.from_naive!(ndt, "Etc/UTC")
            |> DateTime.compare(seven_days_ago) == :gt

          %DateTime{} = dt ->
            DateTime.compare(dt, seven_days_ago) == :gt

          _ ->
            false
        end
      end)
      |> Enum.group_by(& &1.entity_type)
      |> Enum.map(fn {type, events} -> {type, length(events)} end)
      |> Map.new()

    %{
      daemon: "online",
      tasks: tasks,
      todo_count: Map.get(tasks, "todo", 0),
      in_progress_count: Map.get(tasks, "in_progress", 0),
      done_count: Map.get(tasks, "done", 0),
      queued_proposals: queued_proposals,
      active_agents: active_agents,
      running_executions: running_execs,
      pending_executions: pending_execs,
      goals_active: length(goals),
      goals: goals,
      engine_paused: engine_status[:paused] || false,
      unprocessed_dumps: unprocessed_dumps,
      claude_available: claude_available,
      recent_activity_7d: recent_activity
    }
  end

  defp gather_http_status(transport) do
    health =
      case transport.get("/health") do
        {:ok, body} -> body
        _ -> %{}
      end

    tasks =
      case transport.get("/dashboard") do
        {:ok, body} -> body
        _ -> %{}
      end

    %{
      daemon: if(health != %{}, do: "online", else: "unreachable"),
      health: health,
      dashboard: tasks
    }
  end

  defp print_dashboard(status) do
    IO.puts("")
    IO.puts("#{@ansi_bold}#{@ansi_cyan}  EMA Status Dashboard#{@ansi_reset}")
    IO.puts("  #{String.duplicate("─", 50)}")
    IO.puts("")

    # Core system
    IO.puts("  #{@ansi_bold}SYSTEM#{@ansi_reset}")
    print_kv("Daemon", status_badge(status.daemon == "online"))
    print_kv("Claude CLI", status_badge(status[:claude_available] || false))

    engine_label =
      if status[:engine_paused],
        do: "#{@ansi_yellow}paused#{@ansi_reset}",
        else: "#{@ansi_green}running#{@ansi_reset}"

    print_kv("Engine", engine_label)
    IO.puts("")

    # Work items
    IO.puts("  #{@ansi_bold}WORK#{@ansi_reset}")
    todo = status[:todo_count] || 0
    in_progress = status[:in_progress_count] || 0
    done = status[:done_count] || 0

    print_kv(
      "Tasks",
      "#{color_count(todo, :yellow)} todo  #{color_count(in_progress, :cyan)} active  #{@ansi_dim}#{done} done#{@ansi_reset}"
    )

    print_kv("Proposals", "#{color_count(status[:queued_proposals] || 0, :magenta)} queued")
    print_kv("Brain Dump", "#{color_count(status[:unprocessed_dumps] || 0, :yellow)} unprocessed")
    IO.puts("")

    # Runtime
    IO.puts("  #{@ansi_bold}RUNTIME#{@ansi_reset}")
    print_kv("Agents", "#{status[:active_agents] || 0} active")

    running = status[:running_executions] || 0
    pending = status[:pending_executions] || 0

    exec_str =
      cond do
        running > 0 -> "#{@ansi_green}#{running} running#{@ansi_reset}, #{pending} pending"
        pending > 0 -> "#{pending} pending"
        true -> "#{@ansi_dim}idle#{@ansi_reset}"
      end

    print_kv("Executions", exec_str)
    IO.puts("")

    # Goals
    goals = status[:goals] || []

    if goals != [] do
      IO.puts("  #{@ansi_bold}GOALS#{@ansi_reset}")

      Enum.each(Enum.take(goals, 5), fn goal ->
        progress = goal_progress(goal)
        title = truncate(goal_title(goal), 35)
        IO.puts("    #{progress}  #{title}")
      end)

      if length(goals) > 5 do
        IO.puts("    #{@ansi_dim}... and #{length(goals) - 5} more#{@ansi_reset}")
      end

      IO.puts("")
    end

    # Recent activity
    activity = status[:recent_activity_7d] || %{}

    if activity != %{} do
      IO.puts("  #{@ansi_bold}ACTIVITY (7d)#{@ansi_reset}")

      activity
      |> Enum.sort_by(fn {_k, v} -> v end, :desc)
      |> Enum.take(6)
      |> Enum.each(fn {type, count} ->
        print_kv(String.capitalize(type), "#{count} events")
      end)

      IO.puts("")
    end

    IO.puts("  #{@ansi_dim}#{DateTime.utc_now() |> Calendar.strftime("%Y-%m-%d %H:%M UTC")}#{@ansi_reset}")
    IO.puts("")
  end

  defp print_kv(key, value) do
    padded = String.pad_trailing(key, 14)
    IO.puts("    #{@ansi_dim}#{padded}#{@ansi_reset} #{value}")
  end

  defp status_badge(true), do: "#{@ansi_green}online#{@ansi_reset}"
  defp status_badge(false), do: "#{@ansi_red}offline#{@ansi_reset}"

  defp color_count(0, _color), do: "#{@ansi_dim}0#{@ansi_reset}"

  defp color_count(n, :yellow),
    do: "#{@ansi_yellow}#{n}#{@ansi_reset}"

  defp color_count(n, :cyan), do: "#{@ansi_cyan}#{n}#{@ansi_reset}"
  defp color_count(n, :magenta), do: "#{@ansi_magenta}#{n}#{@ansi_reset}"

  defp goal_progress(goal) do
    progress = Map.get(goal, :progress) || Map.get(goal, "progress") || 0
    bar_len = 10
    filled = round(progress / 100 * bar_len)
    empty = bar_len - filled

    color = cond do
      progress >= 75 -> @ansi_green
      progress >= 40 -> @ansi_yellow
      true -> @ansi_red
    end

    "#{color}[#{String.duplicate("█", filled)}#{String.duplicate("░", empty)}]#{@ansi_reset} #{progress}%"
  end

  defp goal_title(goal) do
    Map.get(goal, :title) || Map.get(goal, "title") || "Untitled"
  end

  defp truncate(str, max) when byte_size(str) <= max, do: str
  defp truncate(str, max), do: String.slice(str, 0, max - 1) <> "…"

  defp safe_call(transport, module, function, args, default) do
    case transport.call(module, function, args) do
      {:ok, result} -> result
      _ -> default
    end
  end
end
