defmodule Ema.Focus.Hooks do
  @moduledoc """
  Post-session hooks: auto-log Daily Focus habit, log time on linked task.
  Called asynchronously from Focus.Timer after session completes.
  """

  require Logger

  alias Ema.{Habits, Tasks, Focus}

  @focus_habit_name "Daily Focus"

  @doc """
  Find or create the "Daily Focus" habit and toggle today's log to completed.
  """
  def log_focus_habit(_session) do
    today = Date.utc_today() |> Date.to_iso8601()

    habit =
      Habits.list_active()
      |> Enum.find(&(&1.name == @focus_habit_name))

    habit =
      case habit do
        nil ->
          case Habits.create_habit(%{name: @focus_habit_name, frequency: "daily", target: "Complete a focus session"}) do
            {:ok, h} ->
              Logger.info("Focus.Hooks: created '#{@focus_habit_name}' habit")
              h

            {:error, reason} ->
              Logger.warning("Focus.Hooks: failed to create habit: #{inspect(reason)}")
              nil
          end

        h ->
          h
      end

    if habit do
      # Only toggle if not already completed today
      existing = Habits.logs_for_date(today) |> Enum.find(&(&1.habit_id == habit.id))

      if is_nil(existing) || !existing.completed do
        case Habits.toggle_log(habit.id, today) do
          {:ok, log} ->
            Logger.info("Focus.Hooks: logged Daily Focus habit for #{today}")
            Phoenix.PubSub.broadcast(Ema.PubSub, "habits:updates", {:habit_toggled, habit.id, log})

          {:error, reason} ->
            Logger.warning("Focus.Hooks: failed to log habit: #{inspect(reason)}")
        end
      end
    end
  end

  @doc """
  Add a system comment to the linked task with focus session duration.
  """
  def log_task_time(session, task_id) do
    case Tasks.get_task(task_id) do
      nil ->
        Logger.warning("Focus.Hooks: task #{task_id} not found")

      task ->
        work_ms = Focus.session_elapsed_ms(session)
        duration = format_duration(work_ms)

        body = "Completed #{duration} focus session"
        Tasks.add_comment(task.id, %{body: body, source: "system"})
        Logger.info("Focus.Hooks: logged #{duration} focus time on task #{task_id}")
    end
  end

  defp format_duration(ms) do
    total_min = div(ms, 60_000)
    hours = div(total_min, 60)
    mins = rem(total_min, 60)

    cond do
      hours > 0 -> "#{hours}h #{mins}m"
      true -> "#{mins}m"
    end
  end
end
