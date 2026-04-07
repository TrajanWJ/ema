defmodule Ema.Goals do
  @moduledoc """
  Goals — hierarchical goal tracking across timeframes (weekly to 3-year).
  Supports parent/child relationships and project linking.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Goals.Goal

  def list_goals(opts \\ []) do
    query =
      Goal
      |> order_by(asc: :timeframe, asc: :inserted_at)

    query =
      case Keyword.get(opts, :status) do
        nil -> query
        status -> where(query, [g], g.status == ^status)
      end

    query =
      case Keyword.get(opts, :timeframe) do
        nil -> query
        tf -> where(query, [g], g.timeframe == ^tf)
      end

    query =
      case Keyword.get(opts, :project_id) do
        nil -> query
        pid -> where(query, [g], g.project_id == ^pid)
      end

    query =
      case Keyword.get(opts, :space_id) do
        nil -> query
        sid -> where(query, [g], g.space_id == ^sid)
      end

    query =
      case Keyword.get(opts, :actor_id) do
        nil -> query
        aid -> where(query, [g], g.actor_id == ^aid)
      end

    Repo.all(query)
  end

  def get_goal(id), do: Repo.get(Goal, id)

  def get_goal!(id), do: Repo.get!(Goal, id)

  def get_goal_with_children(id) do
    case Repo.get(Goal, id) do
      nil ->
        nil

      goal ->
        children =
          Goal
          |> where([g], g.parent_id == ^id)
          |> order_by(asc: :inserted_at)
          |> Repo.all()

        %{goal: goal, children: children}
    end
  end

  def create_goal(attrs) do
    id = generate_id("goal")

    %Goal{}
    |> Goal.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_broadcast(:goal_created)
    |> tap_ok(fn goal ->
      Phoenix.PubSub.broadcast(Ema.PubSub, "goals", {:goals, :created, goal})
    end)
  end

  def update_goal(id, attrs) do
    case get_goal(id) do
      nil ->
        {:error, :not_found}

      goal ->
        goal
        |> Goal.changeset(attrs)
        |> Repo.update()
        |> tap_broadcast(:goal_updated)
    end
  end

  def delete_goal(id) do
    case get_goal(id) do
      nil ->
        {:error, :not_found}

      goal ->
        # Unlink children before deleting
        Goal
        |> where([g], g.parent_id == ^id)
        |> Repo.update_all(set: [parent_id: nil])

        Repo.delete(goal)
        |> tap_broadcast(:goal_deleted)
    end
  end

  def update_progress(id, status) when status in ~w(active completed archived) do
    update_goal(id, %{status: status})
  end

  def children_of(parent_id) do
    Goal
    |> where([g], g.parent_id == ^parent_id)
    |> order_by(asc: :inserted_at)
    |> Repo.all()
  end

  def top_level_goals do
    Goal
    |> where([g], is_nil(g.parent_id))
    |> where([g], g.status == "active")
    |> order_by(asc: :timeframe, asc: :inserted_at)
    |> Repo.all()
  end

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "goals:updates", {event, record})
        {:ok, record}

      error ->
        error
    end
  end

  defp tap_ok({:ok, record} = result, fun) do
    fun.(record)
    result
  end

  defp tap_ok(error, _fun), do: error

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
