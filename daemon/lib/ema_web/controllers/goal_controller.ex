defmodule EmaWeb.GoalController do
  use EmaWeb, :controller

  alias Ema.Goals

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:status, params["status"])
      |> maybe_add(:timeframe, params["timeframe"])
      |> maybe_add(:project_id, params["project_id"])

    goals = Goals.list_goals(opts) |> Enum.map(&serialize/1)
    json(conn, %{goals: goals})
  end

  def show(conn, %{"id" => id}) do
    case Goals.get_goal_with_children(id) do
      nil ->
        {:error, :not_found}

      {goal, children} ->
        json(conn, %{
          goal: serialize(goal),
          children: Enum.map(children, &serialize/1)
        })
    end
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      description: params["description"],
      timeframe: params["timeframe"],
      status: params["status"] || "active",
      parent_id: params["parent_id"],
      project_id: params["project_id"]
    }

    with {:ok, goal} <- Goals.create_goal(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize(goal))
    end
  end

  def update(conn, %{"id" => id} = params) do
    attrs =
      %{}
      |> maybe_put(:title, params["title"])
      |> maybe_put(:description, params["description"])
      |> maybe_put(:timeframe, params["timeframe"])
      |> maybe_put(:status, params["status"])
      |> maybe_put(:parent_id, params["parent_id"])
      |> maybe_put(:project_id, params["project_id"])

    with {:ok, goal} <- Goals.update_goal(id, attrs) do
      json(conn, serialize(goal))
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _goal} <- Goals.delete_goal(id) do
      json(conn, %{ok: true})
    end
  end

  defp serialize(goal) do
    %{
      id: goal.id,
      title: goal.title,
      description: goal.description,
      timeframe: goal.timeframe,
      status: goal.status,
      parent_id: goal.parent_id,
      project_id: goal.project_id,
      created_at: goal.inserted_at,
      updated_at: goal.updated_at
    }
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, val), do: Map.put(map, key, val)
end
