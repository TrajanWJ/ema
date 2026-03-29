defmodule PlaceWeb.HabitsController do
  use PlaceWeb, :controller

  alias Place.Habits

  action_fallback PlaceWeb.FallbackController

  def index(conn, _params) do
    habits = Habits.list_active() |> Enum.map(&serialize_habit/1)
    json(conn, %{habits: habits})
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"],
      frequency: params["frequency"] || "daily",
      target: params["target"]
    }

    with {:ok, habit} <- Habits.create_habit(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize_habit(habit))
    end
  end

  def archive(conn, %{"id" => id}) do
    with {:ok, habit} <- Habits.archive_habit(id) do
      json(conn, serialize_habit(habit))
    end
  end

  def toggle(conn, %{"id" => id} = params) do
    date = params["date"] || Date.utc_today() |> Date.to_iso8601()

    with {:ok, log} <- Habits.toggle_log(id, date) do
      streak = Habits.calculate_streak(id)

      json(conn, %{
        log: serialize_log(log),
        streak: streak
      })
    end
  end

  def logs(conn, %{"id" => id} = params) do
    start_date = params["start"]
    end_date = params["end"]

    logs = Habits.logs_for_range(id, start_date, end_date) |> Enum.map(&serialize_log/1)
    json(conn, %{logs: logs})
  end

  def today_logs(conn, _params) do
    today = Date.utc_today() |> Date.to_iso8601()
    logs = Habits.logs_for_date(today) |> Enum.map(&serialize_log/1)
    json(conn, %{logs: logs})
  end

  defp serialize_habit(habit) do
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
  end

  defp serialize_log(log) do
    %{
      id: log.id,
      habit_id: log.habit_id,
      date: log.date,
      completed: log.completed,
      notes: log.notes,
      created_at: log.inserted_at,
      updated_at: log.updated_at
    }
  end
end
