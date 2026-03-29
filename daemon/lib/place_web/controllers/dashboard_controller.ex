defmodule PlaceWeb.DashboardController do
  use PlaceWeb, :controller

  alias Place.{BrainDump, Habits, Journal}

  def today(conn, _params) do
    today = Date.utc_today() |> Date.to_iso8601()

    inbox_count = BrainDump.unprocessed_count()

    recent_items =
      BrainDump.list_unprocessed()
      |> Enum.take(5)
      |> Enum.map(&serialize_inbox_item/1)

    habits = Habits.list_active()
    today_logs = Habits.logs_for_date(today)

    habits_data =
      Enum.map(habits, fn habit ->
        log = Enum.find(today_logs, fn l -> l.habit_id == habit.id end)
        streak = Habits.calculate_streak(habit.id)

        %{
          id: habit.id,
          name: habit.name,
          color: habit.color,
          completed: log != nil && log.completed,
          streak: streak
        }
      end)

    {:ok, journal_entry} = Journal.get_or_create_entry(today)

    json(conn, %{
      date: today,
      inbox_count: inbox_count,
      recent_inbox: recent_items,
      habits: habits_data,
      journal: %{
        id: journal_entry.id,
        date: journal_entry.date,
        one_thing: journal_entry.one_thing,
        mood: journal_entry.mood,
        energy_p: journal_entry.energy_p,
        energy_m: journal_entry.energy_m,
        energy_e: journal_entry.energy_e,
        content: journal_entry.content
      }
    })
  end

  defp serialize_inbox_item(item) do
    %{
      id: item.id,
      content: item.content,
      source: item.source,
      created_at: item.inserted_at
    }
  end
end
