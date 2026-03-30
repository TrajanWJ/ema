defmodule EmaWeb.TaskController do
  use EmaWeb, :controller

  alias Ema.Tasks

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    tasks =
      case params["status"] do
        nil -> Tasks.list_tasks()
        status -> Tasks.list_by_status(status)
      end
      |> Enum.map(&serialize_task/1)

    json(conn, %{tasks: tasks})
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      description: params["description"],
      status: params["status"],
      priority: params["priority"],
      source_type: params["source_type"],
      source_id: params["source_id"],
      effort: params["effort"],
      due_date: parse_date(params["due_date"]),
      recurrence: params["recurrence"],
      sort_order: params["sort_order"],
      metadata: params["metadata"],
      project_id: params["project_id"],
      goal_id: params["goal_id"],
      responsibility_id: params["responsibility_id"],
      parent_id: params["parent_id"]
    }

    with {:ok, task} <- Tasks.create_task(attrs) do
      broadcast_task_event(task, "task_created")

      conn
      |> put_status(:created)
      |> json(serialize_task(task))
    end
  end

  def show(conn, %{"id" => id}) do
    case Tasks.get_with_subtasks(id) do
      nil ->
        {:error, :not_found}

      task ->
        json(conn, %{
          task: serialize_task(task),
          subtasks: Enum.map(task.subtasks, &serialize_task/1),
          comments: Enum.map(task.comments, &serialize_comment/1)
        })
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Tasks.get_task(id) do
      nil ->
        {:error, :not_found}

      task ->
        attrs = %{
          title: params["title"],
          description: params["description"],
          priority: params["priority"],
          effort: params["effort"],
          due_date: parse_date(params["due_date"]),
          recurrence: params["recurrence"],
          sort_order: params["sort_order"],
          metadata: params["metadata"],
          project_id: params["project_id"],
          goal_id: params["goal_id"]
        }

        with {:ok, updated} <- Tasks.update_task(task, attrs) do
          broadcast_task_event(updated, "task_updated")
          json(conn, serialize_task(updated))
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Tasks.get_task(id) do
      nil ->
        {:error, :not_found}

      task ->
        project_id = task.project_id

        with {:ok, _} <- Tasks.delete_task(task) do
          if project_id do
            EmaWeb.Endpoint.broadcast("tasks:#{project_id}", "task_deleted", %{id: id})
          end

          EmaWeb.Endpoint.broadcast("tasks:lobby", "task_deleted", %{id: id})
          json(conn, %{ok: true})
        end
    end
  end

  def transition(conn, %{"id" => id} = params) do
    status = params["status"]

    case Tasks.get_task(id) do
      nil ->
        {:error, :not_found}

      task ->
        with {:ok, updated} <- Tasks.transition_status(task, status) do
          broadcast_task_event(updated, "task_updated")
          json(conn, serialize_task(updated))
        end
    end
  end

  def by_project(conn, %{"project_id" => project_id}) do
    tasks = Tasks.list_by_project(project_id) |> Enum.map(&serialize_task/1)
    json(conn, %{tasks: tasks})
  end

  def add_comment(conn, %{"id" => task_id} = params) do
    attrs = %{
      body: params["body"],
      source: params["source"] || "user"
    }

    case Tasks.get_task(task_id) do
      nil ->
        {:error, :not_found}

      _task ->
        with {:ok, comment} <- Tasks.add_comment(task_id, attrs) do
          broadcast_task_event_by_id(task_id, "comment_added", serialize_comment(comment))

          conn
          |> put_status(:created)
          |> json(serialize_comment(comment))
        end
    end
  end

  defp broadcast_task_event(task, event) do
    serialized = serialize_task(task)

    if task.project_id do
      EmaWeb.Endpoint.broadcast("tasks:#{task.project_id}", event, serialized)
    end

    EmaWeb.Endpoint.broadcast("tasks:lobby", event, serialized)
  end

  defp broadcast_task_event_by_id(task_id, event, payload) do
    case Tasks.get_task(task_id) do
      nil -> :ok
      task ->
        if task.project_id do
          EmaWeb.Endpoint.broadcast("tasks:#{task.project_id}", event, payload)
        end

        EmaWeb.Endpoint.broadcast("tasks:lobby", event, payload)
    end
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

  defp serialize_comment(comment) do
    %{
      id: comment.id,
      body: comment.body,
      source: comment.source,
      task_id: comment.task_id,
      created_at: comment.inserted_at,
      updated_at: comment.updated_at
    }
  end

  defp parse_date(nil), do: nil

  defp parse_date(date_string) when is_binary(date_string) do
    case Date.from_iso8601(date_string) do
      {:ok, date} -> date
      {:error, _} -> nil
    end
  end

  defp parse_date(date), do: date
end
