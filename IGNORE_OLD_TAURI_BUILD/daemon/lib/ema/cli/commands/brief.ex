defmodule Ema.CLI.Commands.Brief do
  @moduledoc """
  CLI command for `ema brief` — the proactive Brief Mode.

  Renders a richly-formatted, structured snapshot covering state, decisions
  needed, autonomous work, recommendations, upcoming items, and recent wins.
  Falls back to JSON output via `--json`.
  """

  alias Ema.CLI.Output

  @reset IO.ANSI.reset()
  @bold IO.ANSI.bright()
  @dim IO.ANSI.faint()
  @green IO.ANSI.green()
  @yellow IO.ANSI.yellow()
  @red IO.ANSI.red()
  @cyan IO.ANSI.cyan()
  @magenta IO.ANSI.magenta()
  @blue IO.ANSI.blue()

  def handle([], _parsed, transport, opts) do
    brief =
      case transport do
        Ema.CLI.Transport.Http ->
          fetch_http(transport, opts)

        Ema.CLI.Transport.Direct ->
          Ema.Intelligence.Brief.generate(brief_opts(opts))
      end

    cond do
      brief == nil ->
        Output.error("Could not load brief.")

      opts[:json] ->
        Output.json(brief)

      true ->
        print_brief(brief)
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown brief subcommand: #{inspect(sub)}")
  end

  defp brief_opts(opts) do
    []
    |> maybe_put(:actor_id, opts[:actor])
    |> maybe_put(:recommend_limit, opts[:limit])
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp fetch_http(transport, opts) do
    query =
      []
      |> maybe_query("actor_id", opts[:actor])
      |> maybe_query("limit", opts[:limit])

    path =
      case query do
        [] -> "/brief"
        _ -> "/brief?" <> URI.encode_query(query)
      end

    case transport.get(path) do
      {:ok, body} -> normalize_keys(body)
      _ -> nil
    end
  end

  defp maybe_query(qs, _k, nil), do: qs
  defp maybe_query(qs, k, v), do: [{k, to_string(v)} | qs]

  # JSON-decoded HTTP responses come back with string keys; the printer expects
  # atoms. Convert top-level + nested known sections to atom-keyed maps.
  defp normalize_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} ->
      key = if is_binary(k), do: safe_atom(k), else: k
      {key, normalize_keys(v)}
    end)
  end

  defp normalize_keys(list) when is_list(list), do: Enum.map(list, &normalize_keys/1)
  defp normalize_keys(other), do: other

  defp safe_atom(str) do
    try do
      String.to_existing_atom(str)
    rescue
      ArgumentError -> String.to_atom(str)
    end
  end

  # ── Printer ────────────────────────────────────────────────────

  defp print_brief(brief) do
    today = Date.utc_today() |> Date.to_iso8601()
    greeting = Map.get(brief, :greeting, "Hello")

    IO.puts("")
    IO.puts("#{@bold}#{greeting}. Here's your brief for #{today}.#{@reset}")
    IO.puts("")

    print_state(Map.get(brief, :state, %{}), Map.get(brief, :energy_check))
    print_decisions(Map.get(brief, :decisions_needed, %{}))
    print_autonomous(Map.get(brief, :autonomous_work, %{}))
    print_recommendations(Map.get(brief, :recommendations, []))
    print_upcoming(Map.get(brief, :upcoming, %{}))
    print_recent_wins(Map.get(brief, :recent_wins, %{}))
    print_cost(Map.get(brief, :cost_status))

    IO.puts("")
    IO.puts("  #{@dim}#{DateTime.utc_now() |> Calendar.strftime("%Y-%m-%d %H:%M UTC")}#{@reset}")
    IO.puts("")
  end

  defp print_state(state, energy) do
    IO.puts("  #{@bold}#{@cyan}STATE#{@reset}")

    focus = Map.get(state, :current_focus, [])

    case focus do
      [] ->
        IO.puts("    #{@dim}Current focus#{@reset}    none implementing")

      intents ->
        IO.puts("    #{@dim}Current focus#{@reset}")
        Enum.each(intents, &print_focus_cascade/1)
    end

    running = Map.get(state, :active_executions, [])
    IO.puts("    #{@dim}Active execs#{@reset}     #{count_color(length(running), :green)} running")

    energy_str =
      case energy do
        %{mood: m, date: d} -> "#{m}/5 (#{d})"
        _ -> "#{@dim}no journal entry#{@reset}"
      end

    IO.puts("    #{@dim}Energy#{@reset}           #{energy_str}")
    IO.puts("")
  end

  defp print_decisions(decisions) do
    total = Map.get(decisions, :total, 0)
    header_color = if total > 0, do: @yellow, else: @dim

    IO.puts("  #{@bold}#{header_color}NEEDS YOUR DECISION#{@reset} #{@dim}(#{total} item#{plural(total)})#{@reset}")

    queued = Map.get(decisions, :queued_proposals, [])
    blocked = Map.get(decisions, :blocked_tasks, [])
    escalated = Map.get(decisions, :escalated_loops, [])
    stuck = Map.get(decisions, :stuck_executions, [])

    if queued != [],
      do: IO.puts("    • #{count_color(length(queued), :magenta)} proposal(s) queued for review")

    if escalated != [],
      do: IO.puts("    • #{count_color(length(escalated), :yellow)} loop(s) escalated (at risk)")

    if blocked != [],
      do: IO.puts("    • #{count_color(length(blocked), :yellow)} task(s) blocked")

    if stuck != [],
      do: IO.puts("    • #{count_color(length(stuck), :red)} execution(s) stuck >2h")

    if total == 0 do
      IO.puts("    #{@dim}all clear#{@reset}")
    end

    IO.puts("")
  end

  defp print_autonomous(work) do
    IO.puts("  #{@bold}#{@blue}AUTONOMOUS WORK#{@reset}")

    running = length(Map.get(work, :running_executions, []))
    pending = length(Map.get(work, :pending_executions, []))
    agents = Map.get(work, :active_agents, 0)
    paused = Map.get(work, :engine_paused, false)

    engine =
      if paused,
        do: "#{@yellow}paused#{@reset}",
        else: "#{@green}running#{@reset}"

    IO.puts("    #{@dim}Engine#{@reset}           #{engine}")
    IO.puts("    #{@dim}Executions#{@reset}       #{running} running, #{pending} pending")
    IO.puts("    #{@dim}Agents#{@reset}           #{agents} active")
    IO.puts("")
  end

  defp print_recommendations([]) do
    IO.puts("  #{@bold}#{@green}RECOMMENDED NEXT ACTIONS#{@reset}")
    IO.puts("    #{@dim}no recommendations — system idle#{@reset}")
    IO.puts("")
  end

  defp print_recommendations(recs) do
    IO.puts("  #{@bold}#{@green}RECOMMENDED NEXT ACTIONS#{@reset}")

    Enum.each(recs, fn r ->
      rank = Map.get(r, :rank, "?")
      label = Map.get(r, :label, "(no label)")
      kind = Map.get(r, :kind, "")
      impact = Map.get(r, :impact, "")
      estimate = Map.get(r, :estimate, "")

      IO.puts("    #{@bold}#{rank}.#{@reset} #{label}")

      if impact != "" or estimate != "" or kind != "" do
        meta =
          [kind, impact, estimate]
          |> Enum.reject(&(&1 == ""))
          |> Enum.join(" • ")

        IO.puts("       #{@dim}#{meta}#{@reset}")
      end
    end)

    IO.puts("")
  end

  defp print_upcoming(upcoming) do
    today = Map.get(upcoming, :today, [])
    week = Map.get(upcoming, :this_week, [])
    goals = Map.get(upcoming, :goals_active, 0)

    IO.puts("  #{@bold}#{@cyan}UPCOMING#{@reset}")
    IO.puts("    #{@dim}Today#{@reset}            #{length(today)} due")
    IO.puts("    #{@dim}This week#{@reset}        #{length(week)} due")
    IO.puts("    #{@dim}Active goals#{@reset}     #{goals}")
    IO.puts("")
  end

  defp print_recent_wins(wins) do
    count = Map.get(wins, :count, 0)
    IO.puts("  #{@bold}#{@green}RECENT WINS#{@reset} #{@dim}(last 24h)#{@reset}")

    if count == 0 do
      IO.puts("    #{@dim}no completions logged#{@reset}")
    else
      tasks = Map.get(wins, :tasks_completed, [])
      execs = Map.get(wins, :executions_completed, [])

      IO.puts("    #{@dim}Tasks done#{@reset}       #{length(tasks)}")
      IO.puts("    #{@dim}Execs done#{@reset}       #{length(execs)}")

      tasks
      |> Enum.take(3)
      |> Enum.each(fn t ->
        title = Map.get(t, :title) || Map.get(t, "title") || "(untitled)"
        IO.puts("    #{@green}✓#{@reset} #{truncate(title, 60)}")
      end)
    end

    IO.puts("")
  end

  defp print_cost(nil), do: :ok

  defp print_cost(tier) do
    {color, label} =
      case tier do
        :normal -> {@green, "healthy"}
        :pause_engine -> {@yellow, "engine paused (50%)"}
        :downgrade_models -> {@yellow, "downgraded (75%)"}
        :agent_only -> {@red, "agent-only (90%)"}
        :hard_stop -> {@red, "hard stop (100%)"}
        other -> {@dim, to_string(other)}
      end

    IO.puts("  #{@bold}BUDGET#{@reset}           #{color}#{label}#{@reset}")
  end

  # ── small utilities ────────────────────────────────────────────

  defp intent_title(intent) do
    title = Map.get(intent, :title) || Map.get(intent, "title") || "(untitled)"
    truncate(to_string(title), 40)
  end

  defp print_focus_cascade(intent) do
    title = intent_title(intent)
    goals = Map.get(intent, :goals) || Map.get(intent, "goals") || []
    spawned = Map.get(intent, :spawned) || Map.get(intent, "spawned") || []

    # Show ancestors (goals served) on the line above
    case goals do
      [] ->
        :ok

      gs ->
        chain =
          gs
          |> Enum.map(&intent_title/1)
          |> Enum.join(" -> ")

        IO.puts("      #{@dim}↑ serves#{@reset}     #{chain}")
    end

    IO.puts("      #{@cyan}*#{@reset} #{@bold}#{title}#{@reset}")

    # Show first few descendants (tasks spawned) on lines below
    spawned
    |> Enum.take(3)
    |> Enum.each(fn t ->
      child_title = intent_title(t)
      IO.puts("        #{@dim}↳#{@reset} #{child_title}")
    end)

    extra = max(length(spawned) - 3, 0)
    if extra > 0, do: IO.puts("        #{@dim}…and #{extra} more#{@reset}")
  end

  defp count_color(0, _), do: "#{@dim}0#{@reset}"
  defp count_color(n, :green), do: "#{@green}#{n}#{@reset}"
  defp count_color(n, :yellow), do: "#{@yellow}#{n}#{@reset}"
  defp count_color(n, :red), do: "#{@red}#{n}#{@reset}"
  defp count_color(n, :magenta), do: "#{@magenta}#{n}#{@reset}"

  defp plural(1), do: ""
  defp plural(_), do: "s"

  defp truncate(str, max) when byte_size(str) <= max, do: str
  defp truncate(str, max), do: String.slice(str, 0, max - 1) <> "…"
end
