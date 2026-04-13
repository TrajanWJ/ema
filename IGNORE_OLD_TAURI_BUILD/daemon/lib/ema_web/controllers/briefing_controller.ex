defmodule EmaWeb.BriefingController do
  use EmaWeb, :controller

  alias Ema.{BrainDump, Habits, Tasks, Proposals}

  def show(conn, _params) do
    today = Date.utc_today() |> Date.to_iso8601()

    open_tasks =
      case Tasks.list_tasks(status: "todo") do
        tasks when is_list(tasks) -> length(tasks)
        _ -> 0
      end

    queued_proposals =
      case Proposals.list_proposals(status: "queued") do
        proposals when is_list(proposals) -> length(proposals)
        _ -> 0
      end

    inbox_count = BrainDump.unprocessed_count()

    active_habits =
      case Habits.list_active() do
        habits when is_list(habits) -> length(habits)
        _ -> 0
      end

    today_logs = Habits.logs_for_date(today)
    completed_habits = Enum.count(today_logs, fn l -> l.completed end)

    json(conn, %{
      date: today,
      summary: %{
        open_tasks: open_tasks,
        queued_proposals: queued_proposals,
        inbox_count: inbox_count,
        active_habits: active_habits,
        completed_habits: completed_habits
      }
    })
  end
end
