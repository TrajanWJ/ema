defmodule Place.Habits do
  @moduledoc """
  Habits — daily/weekly habit tracking with streak calculation.
  """

  import Ecto.Query
  alias Place.Repo
  alias Place.Habits.{Habit, HabitLog}

  @max_habits 7

  def list_active do
    Habit
    |> where([h], h.active == true)
    |> order_by(asc: :sort_order)
    |> Repo.all()
  end

  def get_habit(id), do: Repo.get(Habit, id)

  def create_habit(attrs) do
    active_count = Habit |> where([h], h.active == true) |> Repo.aggregate(:count)

    if active_count >= @max_habits do
      {:error, :max_habits_reached}
    else
      id = generate_id("hab")
      color = attrs[:color] || auto_color(active_count)

      %Habit{}
      |> Habit.changeset(Map.merge(attrs, %{id: id, color: color, sort_order: active_count}))
      |> Repo.insert()
    end
  end

  def archive_habit(id) do
    case get_habit(id) do
      nil -> {:error, :not_found}
      habit -> habit |> Ecto.Changeset.change(active: false) |> Repo.update()
    end
  end

  def toggle_log(habit_id, date) do
    case Repo.get_by(HabitLog, habit_id: habit_id, date: date) do
      nil ->
        id = generate_id("hl")

        %HabitLog{}
        |> HabitLog.changeset(%{id: id, habit_id: habit_id, date: date, completed: true})
        |> Repo.insert()

      log ->
        log
        |> Ecto.Changeset.change(completed: !log.completed)
        |> Repo.update()
    end
  end

  def logs_for_date(date) do
    HabitLog
    |> where([l], l.date == ^date)
    |> Repo.all()
  end

  def logs_for_range(habit_id, start_date, end_date) do
    HabitLog
    |> where([l], l.habit_id == ^habit_id and l.date >= ^start_date and l.date <= ^end_date)
    |> order_by(asc: :date)
    |> Repo.all()
  end

  def calculate_streak(habit_id) do
    today = Date.utc_today() |> Date.to_iso8601()

    logs =
      HabitLog
      |> where([l], l.habit_id == ^habit_id and l.completed == true)
      |> order_by(desc: :date)
      |> limit(60)
      |> Repo.all()

    completed_dates = MapSet.new(logs, & &1.date)
    count_streak(today, completed_dates, 0)
  end

  defp count_streak(date_str, completed_dates, acc) do
    if MapSet.member?(completed_dates, date_str) do
      prev = date_str |> Date.from_iso8601!() |> Date.add(-1) |> Date.to_iso8601()
      count_streak(prev, completed_dates, acc + 1)
    else
      acc
    end
  end

  defp auto_color(index) do
    colors = Habit.colors()
    Enum.at(colors, rem(index, length(colors)))
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
