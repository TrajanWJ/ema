defmodule EmaWeb.GoalChannel do
  use Phoenix.Channel

  alias Ema.Goals

  @impl true
  def join("goals:lobby", _payload, socket) do
    :ok = Phoenix.PubSub.subscribe(Ema.PubSub, "goals:updates")

    goals =
      Goals.list_goals()
      |> Enum.map(&serialize/1)

    {:ok, %{goals: goals}, socket}
  end

  @impl true
  def handle_info({:goal_created, goal}, socket) do
    push(socket, "goal_created", serialize(goal))
    {:noreply, socket}
  end

  @impl true
  def handle_info({:goal_updated, goal}, socket) do
    push(socket, "goal_updated", serialize(goal))
    {:noreply, socket}
  end

  @impl true
  def handle_info({:goal_deleted, goal}, socket) do
    push(socket, "goal_deleted", %{id: goal.id})
    {:noreply, socket}
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
end
