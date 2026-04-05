defmodule EmaWeb.HabitsController do
  use EmaWeb, :controller

  alias Ema.Habits
  alias EmaWeb.Endpoint

  action_fallback EmaWeb.FallbackController

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
      payload = serialize_habit(habit)
      Endpoint.broadcast("habits:tracker", "habit_created", payload)

      conn
      |> put_status(:created)
      |> json(payload)
    end
  end

  def archive(conn, %{"id" => id}) do
    with {:ok, habit} <- Habits.archive_habit(id) do
      payload = serialize_habit(habit)
      Endpoint.broadcast("habits:tracker", "habit_archived", payload)

      json(conn, payload)
    end
  end

  def toggle(conn, %{"id" => id} = params) do
    date = params["date"] || Date.utc_today() |> Date.to_iso8601()

    with {:ok, log} <- Habits.toggle_log(id, date) do
      streak = Habits.calculate_streak(id)
      payload = %{log: serialize_log(log), streak: streak}
      Endpoint.broadcast("habits:tracker", "habit_toggled", payload)

      json(conn, payload)
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
