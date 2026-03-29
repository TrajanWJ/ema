defmodule PlaceWeb.HabitsChannel do
  use Phoenix.Channel

  alias Place.Habits

  @impl true
  def join("habits:tracker", _payload, socket) do
    today = Date.utc_today() |> Date.to_iso8601()

    habits =
      Habits.list_active()
      |> Enum.map(fn habit ->
        %{
          id: habit.id,
          name: habit.name,
          frequency: habit.frequency,
          target: habit.target,
          active: habit.active,
          sort_order: habit.sort_order,
          color: habit.color,
          created_at: habit.inserted_at,
          updated_at: habit.updated_at
        }
      end)

    today_logs =
      Habits.logs_for_date(today)
      |> Enum.map(fn log ->
        %{
          id: log.id,
          habit_id: log.habit_id,
          date: log.date,
          completed: log.completed,
          notes: log.notes
        }
      end)

    streaks =
      Habits.list_active()
      |> Map.new(fn habit -> {habit.id, Habits.calculate_streak(habit.id)} end)

    {:ok, %{habits: habits, today_logs: today_logs, streaks: streaks}, socket}
  end
end
