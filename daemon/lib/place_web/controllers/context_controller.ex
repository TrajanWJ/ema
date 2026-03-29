defmodule PlaceWeb.ContextController do
  use PlaceWeb, :controller

  alias Place.{BrainDump, Habits, Journal}

  def executive_summary(conn, _params) do
    today = Date.utc_today() |> Date.to_iso8601()

    {:ok, entry} = Journal.get_or_create_entry(today)

    habits = Habits.list_active()
    today_logs = Habits.logs_for_date(today)
    completed_count = Enum.count(today_logs, & &1.completed)

    inbox_count = BrainDump.unprocessed_count()

    recent_captures =
      BrainDump.list_unprocessed()
      |> Enum.take(5)
      |> Enum.map(fn item -> %{content: item.content, source: item.source} end)

    content_snippet =
      if entry.content && String.length(entry.content) > 200 do
        String.slice(entry.content, 0, 200) <> "..."
      else
        entry.content
      end

    json(conn, %{
      date: today,
      one_thing: entry.one_thing,
      mood: entry.mood,
      energy: %{
        physical: entry.energy_p,
        mental: entry.energy_m,
        emotional: entry.energy_e
      },
      habits: %{
        completed: completed_count,
        total: length(habits)
      },
      inbox_count: inbox_count,
      recent_captures: recent_captures,
      journal_snippet: content_snippet
    })
  end
end
