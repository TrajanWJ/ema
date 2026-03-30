defmodule Ema.Tasks do
  @moduledoc """
  Tasks -- actionable work items linked to projects, goals, and responsibilities.
  Supports lifecycle transitions, decomposition into subtasks, comments, and dependencies.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Tasks.{Task, Comment}

  def list_tasks do
    Task |> order_by(asc: :sort_order, asc: :inserted_at) |> Repo.all()
  end

  def list_by_project(project_id) do
    Task
    |> where([t], t.project_id == ^project_id)
    |> order_by(asc: :sort_order, asc: :inserted_at)
    |> Repo.all()
  end

  def list_by_status(status) do
    Task
    |> where([t], t.status == ^status)
    |> order_by(asc: :priority, asc: :inserted_at)
    |> Repo.all()
  end

  def count_by_status do
    Task
    |> group_by([t], t.status)
    |> select([t], {t.status, count(t.id)})
    |> Repo.all()
    |> Map.new()
  end

  def get_task(id), do: Repo.get(Task, id)

  def get_task!(id), do: Repo.get!(Task, id)

  def get_with_subtasks(id) do
    Task
    |> Repo.get(id)
    |> case do
      nil -> nil
      task -> Repo.preload(task, [:subtasks, :comments])
    end
  end

  def create_task(attrs) do
    id = generate_id()

    %Task{}
    |> Task.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_task(%Task{} = task, attrs) do
    task
    |> Task.changeset(attrs)
    |> Repo.update()
  end

  def transition_status(%Task{} = task, new_status) do
    if Task.valid_transition?(task.status, new_status) do
      task
      |> Task.changeset(%{status: new_status})
      |> Repo.update()
    else
      {:error, :invalid_transition}
    end
  end

  def delete_task(%Task{} = task) do
    Repo.delete(task)
  end

  def add_comment(task_id, attrs) do
    id = generate_comment_id()

    %Comment{}
    |> Comment.changeset(Map.merge(attrs, %{id: id, task_id: task_id}))
    |> Repo.insert()
  end

  def list_comments(task_id) do
    Comment
    |> where([c], c.task_id == ^task_id)
    |> order_by(asc: :inserted_at)
    |> Repo.all()
  end

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "task_#{timestamp}_#{random}"
  end

  defp generate_comment_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "tc_#{timestamp}_#{random}"
  end
end
