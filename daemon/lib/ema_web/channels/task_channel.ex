defmodule EmaWeb.TaskChannel do
  use Phoenix.Channel

  alias Ema.Tasks

  @impl true
  def join("tasks:lobby", _payload, socket) do
    tasks =
      Tasks.list_tasks()
      |> Enum.map(&serialize_task/1)

    {:ok, %{tasks: tasks}, socket}
  end

  @impl true
  def join("tasks:" <> project_id, _payload, socket) do
    tasks =
      Tasks.list_by_project(project_id)
      |> Enum.map(&serialize_task/1)

    {:ok, %{tasks: tasks}, socket}
  end

  defp serialize_task(task) do
    %{
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      source_type: task.source_type,
      source_id: task.source_id,
      effort: task.effort,
      due_date: task.due_date,
      recurrence: task.recurrence,
      sort_order: task.sort_order,
      completed_at: task.completed_at,
      metadata: task.metadata,
      project_id: task.project_id,
      goal_id: task.goal_id,
      responsibility_id: task.responsibility_id,
      parent_id: task.parent_id,
      created_at: task.inserted_at,
      updated_at: task.updated_at
    }
  end
end
