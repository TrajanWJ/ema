defmodule Ema.Intelligence.Recap do
  @moduledoc "Generates activity recaps for a time period. Pure DB queries, no AI calls."

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Tasks.Task
  alias Ema.Proposals.Proposal
  alias Ema.Executions.Execution
  alias Ema.BrainDump.Item
  alias Ema.Journal.Entry
  alias Ema.SecondBrain.Note

  @type period :: :today | :yesterday | :week | :month
  @type recap :: %{
          period: period(),
          start: DateTime.t(),
          end: DateTime.t(),
          tasks: map(),
          proposals: map(),
          executions: map(),
          brain_dumps: map(),
          journal: map(),
          wiki_changes: map(),
          cost: map()
        }

  @doc "Generate a recap for the given period."
  @spec generate(keyword()) :: recap()
  def generate(opts \\ []) do
    period = Keyword.get(opts, :period, :today)
    {start_dt, end_dt} = resolve_period(period)

    %{
      period: period,
      start: DateTime.to_iso8601(start_dt),
      end: DateTime.to_iso8601(end_dt),
      tasks: recap_tasks(start_dt, end_dt),
      proposals: recap_proposals(start_dt, end_dt),
      executions: recap_executions(start_dt, end_dt),
      brain_dumps: recap_brain_dumps(start_dt, end_dt),
      journal: recap_journal(start_dt, end_dt),
      wiki_changes: recap_wiki(start_dt, end_dt),
      cost: recap_cost(start_dt, end_dt)
    }
  end

  @doc "Render a recap map into an ANSI-colored string for CLI display."
  @spec format(recap()) :: String.t()
  def format(recap) do
    sections = [
      format_header(recap),
      format_tasks(recap.tasks),
      format_proposals(recap.proposals),
      format_executions(recap.executions),
      format_brain_dumps(recap.brain_dumps),
      format_journal(recap.journal),
      format_wiki(recap.wiki_changes),
      format_cost(recap.cost)
    ]

    Enum.join(sections, "\n")
  end

  # ── Period Resolution ──

  defp resolve_period(:today) do
    today = Date.utc_today()
    {start_of_day(today), DateTime.utc_now()}
  end

  defp resolve_period(:yesterday) do
    yesterday = Date.add(Date.utc_today(), -1)
    {start_of_day(yesterday), end_of_day(yesterday)}
  end

  defp resolve_period(:week) do
    today = Date.utc_today()
    monday = Date.add(today, -(Date.day_of_week(today) - 1))
    {start_of_day(monday), DateTime.utc_now()}
  end

  defp resolve_period(:month) do
    today = Date.utc_today()
    first = Date.new!(today.year, today.month, 1)
    {start_of_day(first), DateTime.utc_now()}
  end

  defp resolve_period(other), do: resolve_period(parse_period(other))

  defp parse_period("today"), do: :today
  defp parse_period("yesterday"), do: :yesterday
  defp parse_period("week"), do: :week
  defp parse_period("month"), do: :month
  defp parse_period(_), do: :today

  defp start_of_day(date), do: DateTime.new!(date, ~T[00:00:00], "Etc/UTC")
  defp end_of_day(date), do: DateTime.new!(date, ~T[23:59:59], "Etc/UTC")

  # ── Data Queries ──

  defp recap_tasks(start_dt, end_dt) do
    completed =
      Task
      |> where([t], t.status == "done" and t.updated_at >= ^start_dt and t.updated_at <= ^end_dt)
      |> select([t], %{id: t.id, title: t.title})
      |> Repo.all()

    created =
      Task
      |> where([t], t.inserted_at >= ^start_dt and t.inserted_at <= ^end_dt)
      |> select([t], %{id: t.id, title: t.title, status: t.status})
      |> Repo.all()

    in_progress =
      Task
      |> where([t], t.status == "in_progress")
      |> select([t], %{id: t.id, title: t.title})
      |> Repo.all()

    %{
      completed: completed,
      completed_count: length(completed),
      created: created,
      created_count: length(created),
      in_progress: in_progress,
      in_progress_count: length(in_progress)
    }
  end

  defp recap_proposals(start_dt, end_dt) do
    by_status =
      Proposal
      |> where([p], p.updated_at >= ^start_dt and p.updated_at <= ^end_dt)
      |> group_by([p], p.status)
      |> select([p], {p.status, count(p.id)})
      |> Repo.all()
      |> Map.new()

    generated =
      Proposal
      |> where([p], p.inserted_at >= ^start_dt and p.inserted_at <= ^end_dt)
      |> Repo.aggregate(:count)

    %{
      by_status: by_status,
      generated: generated,
      approved: Map.get(by_status, "approved", 0),
      killed: Map.get(by_status, "killed", 0),
      redirected: Map.get(by_status, "redirected", 0)
    }
  end

  defp recap_executions(start_dt, end_dt) do
    all =
      Execution
      |> where([e], e.inserted_at >= ^start_dt and e.inserted_at <= ^end_dt)
      |> select([e], %{id: e.id, title: e.title, status: e.status})
      |> Repo.all()

    by_status = Enum.group_by(all, & &1.status)

    completed =
      Execution
      |> where(
        [e],
        e.status == "completed" and e.completed_at >= ^start_dt and e.completed_at <= ^end_dt
      )
      |> select([e], %{id: e.id, title: e.title})
      |> Repo.all()

    %{
      total: length(all),
      by_status: Map.new(by_status, fn {k, v} -> {k, length(v)} end),
      completed: completed,
      completed_count: length(completed),
      dispatched: Map.get(by_status, "dispatched", []) |> length()
    }
  end

  defp recap_brain_dumps(start_dt, end_dt) do
    items =
      Item
      |> where([i], i.inserted_at >= ^start_dt and i.inserted_at <= ^end_dt)
      |> select([i], %{id: i.id, content: i.content, processed: i.processed, source: i.source})
      |> order_by(desc: :inserted_at)
      |> Repo.all()

    processed = Enum.count(items, & &1.processed)

    %{
      total: length(items),
      processed: processed,
      unprocessed: length(items) - processed,
      items: Enum.take(items, 10)
    }
  end

  defp recap_journal(start_dt, end_dt) do
    start_date = DateTime.to_date(start_dt) |> Date.to_iso8601()
    end_date = DateTime.to_date(end_dt) |> Date.to_iso8601()

    entries =
      Entry
      |> where([e], e.date >= ^start_date and e.date <= ^end_date)
      |> select([e], %{date: e.date, mood: e.mood, one_thing: e.one_thing})
      |> Repo.all()

    avg_mood =
      entries
      |> Enum.map(& &1.mood)
      |> Enum.reject(&is_nil/1)
      |> case do
        [] -> nil
        moods -> Float.round(Enum.sum(moods) / length(moods), 1)
      end

    %{
      entries: length(entries),
      avg_mood: avg_mood,
      one_things: entries |> Enum.map(& &1.one_thing) |> Enum.reject(&is_nil/1)
    }
  end

  defp recap_wiki(start_dt, end_dt) do
    changed =
      Note
      |> where([n], n.updated_at >= ^start_dt and n.updated_at <= ^end_dt)
      |> select([n], %{file_path: n.file_path, space: n.space})
      |> order_by(desc: :updated_at)
      |> Repo.all()

    created =
      Note
      |> where([n], n.inserted_at >= ^start_dt and n.inserted_at <= ^end_dt)
      |> select([n], %{file_path: n.file_path, space: n.space})
      |> Repo.all()

    %{
      changed_count: length(changed),
      created_count: length(created),
      changed: Enum.take(changed, 10),
      created: Enum.take(created, 10)
    }
  end

  defp recap_cost(start_dt, _end_dt) do
    try do
      alias Ema.Intelligence.UsageRecord

      total =
        UsageRecord
        |> where([u], u.inserted_at >= ^start_dt)
        |> select([u], sum(u.cost_usd))
        |> Repo.one()
        |> Kernel.||(0.0)

      tokens =
        UsageRecord
        |> where([u], u.inserted_at >= ^start_dt)
        |> select([u], %{input: sum(u.input_tokens), output: sum(u.output_tokens)})
        |> Repo.one()

      %{
        total_usd: Float.round(total * 1.0, 4),
        input_tokens: (tokens && tokens.input) || 0,
        output_tokens: (tokens && tokens.output) || 0
      }
    rescue
      _ -> %{total_usd: 0.0, input_tokens: 0, output_tokens: 0}
    end
  end

  # ── Formatting ──

  defp format_header(recap) do
    label = recap.period |> to_string() |> String.upcase()

    """
    #{IO.ANSI.bright()}#{IO.ANSI.cyan()}EMA Recap — #{label}#{IO.ANSI.reset()}
    #{IO.ANSI.cyan()}#{String.duplicate("─", 50)}#{IO.ANSI.reset()}
    Period: #{recap.start} → #{recap.end}
    """
  end

  defp format_tasks(tasks) do
    """
    #{section_header("Tasks")}
      #{IO.ANSI.green()}✓ Completed:#{IO.ANSI.reset()}  #{tasks.completed_count}#{completed_titles(tasks.completed)}
      #{IO.ANSI.yellow()}+ Created:#{IO.ANSI.reset()}    #{tasks.created_count}
      #{IO.ANSI.blue()}▸ In Progress:#{IO.ANSI.reset()} #{tasks.in_progress_count}#{in_progress_titles(tasks.in_progress)}
    """
  end

  defp format_proposals(proposals) do
    """
    #{section_header("Proposals")}
      Generated:  #{proposals.generated}
      #{IO.ANSI.green()}Approved:#{IO.ANSI.reset()}   #{proposals.approved}
      #{IO.ANSI.red()}Killed:#{IO.ANSI.reset()}     #{proposals.killed}
      Redirected: #{proposals.redirected}
    """
  end

  defp format_executions(execs) do
    """
    #{section_header("Executions")}
      Total:     #{execs.total}
      #{IO.ANSI.green()}Completed:#{IO.ANSI.reset()} #{execs.completed_count}
      Dispatched: #{execs.dispatched}
    """
  end

  defp format_brain_dumps(dumps) do
    """
    #{section_header("Brain Dumps")}
      Captured:    #{dumps.total}
      Processed:   #{dumps.processed}
      Unprocessed: #{dumps.unprocessed}
    """
  end

  defp format_journal(journal) do
    mood_str = if journal.avg_mood, do: "#{journal.avg_mood}/5", else: "—"

    things =
      case journal.one_things do
        [] -> ""
        items -> "\n      One Things: " <> Enum.join(items, ", ")
      end

    """
    #{section_header("Journal")}
      Entries:  #{journal.entries}
      Avg Mood: #{mood_str}#{things}
    """
  end

  defp format_wiki(wiki) do
    """
    #{section_header("Wiki")}
      Changed: #{wiki.changed_count}
      Created: #{wiki.created_count}
    """
  end

  defp format_cost(cost) do
    """
    #{section_header("AI Cost")}
      Total:  $#{:erlang.float_to_binary(cost.total_usd, decimals: 4)}
      Tokens: #{cost.input_tokens} in / #{cost.output_tokens} out
    """
  end

  defp section_header(name) do
    "  #{IO.ANSI.bright()}#{IO.ANSI.white()}#{name}#{IO.ANSI.reset()}"
  end

  defp completed_titles([]), do: ""

  defp completed_titles(items) do
    items
    |> Enum.take(5)
    |> Enum.map(fn t -> "\n        #{IO.ANSI.faint()}· #{t.title}#{IO.ANSI.reset()}" end)
    |> Enum.join()
  end

  defp in_progress_titles([]), do: ""

  defp in_progress_titles(items) do
    items
    |> Enum.take(5)
    |> Enum.map(fn t -> "\n        #{IO.ANSI.faint()}· #{t.title}#{IO.ANSI.reset()}" end)
    |> Enum.join()
  end
end
