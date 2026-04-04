defmodule EmaWeb.DispatchBoardController do
  use EmaWeb, :controller

  def index(conn, _params) do
    now = DateTime.utc_now()

    all_executions = Ema.Executions.list_executions([])

    running =
      all_executions
      |> Enum.filter(fn e -> e.status in ["running", "delegated", "harvesting", "approved"] end)
      |> Enum.map(&serialize_with_elapsed(&1, now))

    queued =
      all_executions
      |> Enum.filter(fn e -> e.status in ["created", "proposed", "awaiting_approval"] end)
      |> Enum.map(&serialize_with_elapsed(&1, now))

    completed =
      all_executions
      |> Enum.filter(fn e -> e.status in ["completed", "failed", "cancelled"] end)
      |> Enum.take(20)
      |> Enum.map(&serialize_with_elapsed(&1, now))

    json(conn, %{
      running: running,
      queued: queued,
      completed: completed,
      counts: %{
        running: length(running),
        queued: length(queued),
        completed_today: count_completed_today(all_executions)
      }
    })
  end

  def stats(conn, _params) do
    now = DateTime.utc_now()
    all = Ema.Executions.list_executions([])

    today_start = DateTime.new!(Date.utc_today(), ~T[00:00:00], "Etc/UTC")

    today =
      Enum.filter(all, fn e ->
        DateTime.compare(e.inserted_at, today_start) in [:gt, :eq]
      end)

    json(conn, %{
      total: length(all),
      today: length(today),
      running: Enum.count(all, fn e -> e.status in ["running", "delegated", "harvesting"] end),
      queued: Enum.count(all, fn e -> e.status in ["created", "proposed", "awaiting_approval"] end),
      completed_today: Enum.count(today, fn e -> e.status == "completed" end),
      failed_today: Enum.count(today, fn e -> e.status == "failed" end),
      avg_duration_seconds: average_duration(all),
      last_updated_at: DateTime.to_iso8601(now)
    })
  end

  defp serialize_with_elapsed(e, now) do
    elapsed =
      if e.completed_at do
        DateTime.diff(e.completed_at, e.inserted_at)
      else
        DateTime.diff(now, e.inserted_at)
      end

    %{
      id: e.id,
      title: e.title,
      mode: e.mode,
      status: e.status,
      project_slug: e.project_slug,
      intent_slug: e.intent_slug,
      elapsed_seconds: elapsed,
      requires_approval: e.requires_approval,
      inserted_at: e.inserted_at,
      completed_at: e.completed_at
    }
  end

  defp count_completed_today(executions) do
    today_start = DateTime.new!(Date.utc_today(), ~T[00:00:00], "Etc/UTC")

    Enum.count(executions, fn e ->
      e.status == "completed" and
        e.completed_at != nil and
        DateTime.compare(e.completed_at, today_start) in [:gt, :eq]
    end)
  end

  defp average_duration(executions) do
    completed =
      Enum.filter(executions, fn e ->
        e.status == "completed" and e.completed_at != nil
      end)

    if Enum.empty?(completed) do
      nil
    else
      total =
        Enum.reduce(completed, 0, fn e, acc ->
          acc + DateTime.diff(e.completed_at, e.inserted_at)
        end)

      div(total, length(completed))
    end
  end
end
