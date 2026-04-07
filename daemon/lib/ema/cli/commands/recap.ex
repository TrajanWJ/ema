defmodule Ema.CLI.Commands.Recap do
  @moduledoc "Daily/session recap — what changed across all EMA domains."

  alias Ema.CLI.Output
  alias Ema.Intelligence.Recap

  def handle([], parsed, transport, opts) do
    period = parsed.options[:period] || "today"

    case transport do
      Ema.CLI.Transport.Direct ->
        recap = Recap.generate(period: safe_period(period))

        if opts[:json] do
          Output.json(recap)
        else
          print_recap(recap)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/recap?period=#{period}") do
          {:ok, body} ->
            if opts[:json], do: Output.json(body), else: print_recap_http(body)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown recap subcommand: #{inspect(sub)}")
  end

  defp safe_period("today"), do: :today
  defp safe_period("yesterday"), do: :yesterday
  defp safe_period("week"), do: :week
  defp safe_period("month"), do: :month
  defp safe_period(_), do: :today

  # ── Rich direct-mode output ──

  defp print_recap(recap) do
    label = recap.period |> to_string() |> String.upcase()

    IO.puts("")
    IO.puts("#{bright()}#{cyan()}  EMA Recap — #{label}#{reset()}")
    IO.puts("  #{String.duplicate("─", 50)}")
    IO.puts("  #{dim()}#{recap.start} → #{recap.end}#{reset()}")
    IO.puts("")

    print_tasks_section(recap.tasks)
    print_proposals_section(recap.proposals)
    print_executions_section(recap.executions)
    print_dumps_section(recap.brain_dumps)
    print_journal_section(recap.journal)
    print_wiki_section(recap.wiki_changes)
    print_git_section(recap.period)
    print_cost_section(recap.cost)

    IO.puts("  #{dim()}Generated #{DateTime.utc_now() |> Calendar.strftime("%H:%M UTC")}#{reset()}")
    IO.puts("")
  end

  defp print_tasks_section(tasks) do
    IO.puts("  #{bright()}TASKS#{reset()}")
    kv("Completed", tasks.completed_count, :green)

    Enum.each(Enum.take(tasks.completed, 5), fn t ->
      IO.puts("        #{dim()}#{t.title}#{reset()}")
    end)

    kv("Created", tasks.created_count, :cyan)
    kv("In Progress", tasks.in_progress_count, :yellow)

    Enum.each(Enum.take(tasks.in_progress, 3), fn t ->
      IO.puts("        #{dim()}#{t.title}#{reset()}")
    end)

    IO.puts("")
  end

  defp print_proposals_section(proposals) do
    IO.puts("  #{bright()}PROPOSALS#{reset()}")
    kv("Generated", proposals.generated, :default)
    kv("Approved", proposals.approved, :green)
    kv("Killed", proposals.killed, :red)
    kv("Redirected", proposals.redirected, :default)
    IO.puts("")
  end

  defp print_executions_section(execs) do
    IO.puts("  #{bright()}EXECUTIONS#{reset()}")
    kv("Total", execs.total, :default)
    kv("Completed", execs.completed_count, :green)
    kv("Dispatched", execs.dispatched, :yellow)
    IO.puts("")
  end

  defp print_dumps_section(dumps) do
    IO.puts("  #{bright()}BRAIN DUMPS#{reset()}")
    kv("Captured", dumps.total, :cyan)
    kv("Processed", dumps.processed, :green)
    kv("Unprocessed", dumps.unprocessed, :yellow)

    Enum.each(Enum.take(dumps.items, 3), fn item ->
      content = item.content |> to_string() |> String.slice(0, 60)
      IO.puts("        #{dim()}#{content}#{reset()}")
    end)

    IO.puts("")
  end

  defp print_journal_section(journal) do
    IO.puts("  #{bright()}JOURNAL#{reset()}")
    kv("Entries", journal.entries, :default)

    if journal.avg_mood do
      kv("Avg Mood", "#{journal.avg_mood}/5", mood_color(journal.avg_mood))
    end

    case journal.one_things do
      [] -> :ok
      things ->
        Enum.each(Enum.take(things, 3), fn thing ->
          IO.puts("        #{dim()}#{thing}#{reset()}")
        end)
    end

    IO.puts("")
  end

  defp print_wiki_section(wiki) do
    if wiki.changed_count > 0 or wiki.created_count > 0 do
      IO.puts("  #{bright()}WIKI#{reset()}")
      kv("Changed", wiki.changed_count, :cyan)
      kv("Created", wiki.created_count, :green)

      Enum.each(Enum.take(wiki.changed, 5), fn note ->
        IO.puts("        #{dim()}#{note.file_path}#{reset()}")
      end)

      IO.puts("")
    end
  end

  defp print_git_section(period) do
    date_range = git_date_arg(period)
    git = gather_git(date_range)

    if git.commits > 0 do
      IO.puts("  #{bright()}GIT#{reset()}")
      kv("Commits", git.commits, :green)

      Enum.each(Enum.take(git.messages, 5), fn msg ->
        IO.puts("        #{dim()}#{msg}#{reset()}")
      end)

      IO.puts("")
    end
  end

  defp print_cost_section(cost) do
    if cost.total_usd > 0 do
      IO.puts("  #{bright()}AI COST#{reset()}")
      kv("Total", "$#{:erlang.float_to_binary(cost.total_usd, decimals: 4)}", :yellow)
      kv("Tokens", "#{cost.input_tokens} in / #{cost.output_tokens} out", :default)
      IO.puts("")
    end
  end

  # ── HTTP fallback output ──

  defp print_recap_http(body) when is_map(body) do
    IO.puts("")
    IO.puts("#{bright()}#{cyan()}  EMA Recap — #{String.upcase(body["period"] || "TODAY")}#{reset()}")
    IO.puts("  #{String.duplicate("─", 50)}")

    if tasks = body["tasks"] do
      IO.puts("\n  #{bright()}TASKS#{reset()}")
      kv("Completed", tasks["completed_count"] || 0, :green)
      kv("Created", tasks["created_count"] || 0, :cyan)
      kv("In Progress", tasks["in_progress_count"] || 0, :yellow)
    end

    if proposals = body["proposals"] do
      IO.puts("\n  #{bright()}PROPOSALS#{reset()}")
      kv("Generated", proposals["generated"] || 0, :default)
      kv("Approved", proposals["approved"] || 0, :green)
      kv("Killed", proposals["killed"] || 0, :red)
    end

    if execs = body["executions"] do
      IO.puts("\n  #{bright()}EXECUTIONS#{reset()}")
      kv("Total", execs["total"] || 0, :default)
      kv("Completed", execs["completed_count"] || 0, :green)
    end

    if dumps = body["brain_dumps"] do
      IO.puts("\n  #{bright()}BRAIN DUMPS#{reset()}")
      kv("Captured", dumps["total"] || 0, :cyan)
      kv("Processed", dumps["processed"] || 0, :green)
    end

    if journal = body["journal"] do
      IO.puts("\n  #{bright()}JOURNAL#{reset()}")
      kv("Entries", journal["entries"] || 0, :default)
      mood = if journal["avg_mood"], do: "#{journal["avg_mood"]}/5", else: "---"
      kv("Avg Mood", mood, :default)
    end

    if cost = body["cost"] do
      IO.puts("\n  #{bright()}AI COST#{reset()}")
      kv("Total", "$#{cost["total_usd"] || 0}", :yellow)
      kv("Tokens", "#{cost["input_tokens"] || 0} in / #{cost["output_tokens"] || 0} out", :default)
    end

    IO.puts("")
  end

  defp print_recap_http(other), do: Output.detail(other)

  # ── Git helpers ──

  defp git_date_arg(:today), do: "--since=#{Date.utc_today() |> Date.to_iso8601()}T00:00:00"
  defp git_date_arg(:yesterday), do: "--since=#{Date.add(Date.utc_today(), -1) |> Date.to_iso8601()}T00:00:00 --until=#{Date.utc_today() |> Date.to_iso8601()}T00:00:00"
  defp git_date_arg(:week), do: "--since=#{Date.add(Date.utc_today(), -7) |> Date.to_iso8601()}T00:00:00"
  defp git_date_arg(:month), do: "--since=#{Date.add(Date.utc_today(), -30) |> Date.to_iso8601()}T00:00:00"
  defp git_date_arg(_), do: "--since=#{Date.utc_today() |> Date.to_iso8601()}T00:00:00"

  defp gather_git(date_arg) do
    ema_dir = Path.expand("~/Projects/ema")

    if File.dir?(Path.join(ema_dir, ".git")) do
      args = ["log", "--oneline", "--format=%s"] ++ String.split(date_arg)

      case System.cmd("git", args, cd: ema_dir, stderr_to_stdout: true) do
        {output, 0} ->
          messages = output |> String.trim() |> String.split("\n", trim: true)
          %{commits: length(messages), messages: messages}

        _ ->
          %{commits: 0, messages: []}
      end
    else
      %{commits: 0, messages: []}
    end
  rescue
    _ -> %{commits: 0, messages: []}
  end

  # ── Formatting helpers ──

  defp kv(key, value, color) do
    padded = String.pad_trailing(key, 16)
    IO.puts("    #{dim()}#{padded}#{reset()} #{colorize(value, color)}")
  end

  defp colorize(0, _), do: "#{dim()}0#{reset()}"
  defp colorize(val, :green), do: "#{IO.ANSI.green()}#{val}#{reset()}"
  defp colorize(val, :red), do: "#{IO.ANSI.red()}#{val}#{reset()}"
  defp colorize(val, :cyan), do: "#{cyan()}#{val}#{reset()}"
  defp colorize(val, :yellow), do: "#{IO.ANSI.yellow()}#{val}#{reset()}"
  defp colorize(val, _), do: "#{val}"

  defp mood_color(mood) when mood >= 4, do: :green
  defp mood_color(mood) when mood >= 3, do: :yellow
  defp mood_color(_), do: :red

  defp bright, do: IO.ANSI.bright()
  defp dim, do: IO.ANSI.faint()
  defp cyan, do: IO.ANSI.cyan()
  defp reset, do: IO.ANSI.reset()
end
