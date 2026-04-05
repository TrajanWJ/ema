defmodule EmaWeb.DashboardChannel do
  use Phoenix.Channel

  alias Ema.{BrainDump, Habits, Journal}
  alias Phoenix.Socket.Broadcast

  @live_topics ["brain_dump:queue", "habits:tracker", "journal:today"]

  @impl true
  def join("dashboard:lobby", _payload, socket) do
    Enum.each(@live_topics, &Phoenix.PubSub.subscribe(Ema.PubSub, &1))
    send(self(), :send_snapshot)
    {:ok, socket}
  end

  @impl true
  def handle_info(:send_snapshot, socket) do
    push(socket, "snapshot", build_snapshot())
    {:noreply, socket}
  end

  def handle_info(%Broadcast{topic: topic}, socket) when topic in @live_topics do
    push(socket, "snapshot", build_snapshot())
    {:noreply, socket}
  end

  defp build_snapshot do
    today = Date.utc_today() |> Date.to_iso8601()

    inbox_count = BrainDump.unprocessed_count()

    recent_items =
      BrainDump.list_unprocessed()
      |> Enum.take(5)
      |> Enum.map(fn item ->
        %{id: item.id, content: item.content, source: item.source, created_at: item.inserted_at}
      end)

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

    %{
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
    }
  end
end
