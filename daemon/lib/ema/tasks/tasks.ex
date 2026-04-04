defmodule Ema.Tasks do
  require Logger
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

  def list_tasks(opts) when is_list(opts) do
    Task
    |> maybe_filter_by(:project_id, Keyword.get(opts, :project_id))
    |> maybe_filter_by(:status, Keyword.get(opts, :status))
    |> order_by(asc: :sort_order, asc: :inserted_at)
    |> Repo.all()
  end

  defp maybe_filter_by(query, _field, nil), do: query
  defp maybe_filter_by(query, :project_id, val), do: where(query, [t], t.project_id == ^val)
  defp maybe_filter_by(query, :status, val), do: where(query, [t], t.status == ^val)

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
    create_task(attrs, [])
  end

  def create_task(attrs, opts) do
    force_dispatch = Keyword.get(opts, :force_dispatch, false)
    description = Map.get(attrs, :description) || Map.get(attrs, "description") || ""

    # Build a temporary struct-like map to pass to StructuralDetector
    temp_task = %{description: description}

    case Ema.Tasks.StructuralDetector.route(temp_task) do
      {:require_proposal, _task} when not force_dispatch ->
        keywords = Ema.Tasks.StructuralDetector.detect_keywords(description)
        {:requires_proposal, keywords}

      _ ->
        if force_dispatch do
          Logger.warning(
            "Deliberation gate bypassed for new task: #{description}"
          )
          append_bypass_log(%{description: description, attrs: attrs})
        end

        do_create_task(attrs)
    end
  end

  defp do_create_task(attrs) do
    id = generate_id()

    result =
      %Task{}
      |> Task.changeset(Map.put(attrs, :id, id))
      |> Repo.insert()

    case result do
      {:ok, task} ->
        Ema.Pipes.EventBus.broadcast_event("tasks:created", %{
          task_id: task.id,
          title: task.title,
          status: task.status,
          project_id: task.project_id
        })

        {:ok, task}

      error ->
        error
    end
  end

  defp append_bypass_log(entry) do
    dir = Path.expand("~/.local/share/ema")
    path = Path.join(dir, "deliberation-bypasses.jsonl")

    with :ok <- File.mkdir_p(dir) do
      line = Jason.encode!(%{
        timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
        description: entry.description,
        attrs: entry.attrs
      })
      File.write!(path, line <> "
", [:append])
    end
  end

  def update_task(%Task{} = task, attrs) do
    task
    |> Task.changeset(attrs)
    |> Repo.update()
  end

  def transition_status(%Task{} = task, new_status) do
    if Task.valid_transition?(task.status, new_status) do
      result =
        task
        |> Task.changeset(%{status: new_status})
        |> Repo.update()

      case result do
        {:ok, updated} ->
          Ema.Pipes.EventBus.broadcast_event("tasks:status_changed", %{
            task_id: updated.id,
            old_status: task.status,
            new_status: new_status,
            project_id: updated.project_id
          })

          if new_status == "done" do
            Ema.Pipes.EventBus.broadcast_event("tasks:completed", %{
              task_id: updated.id,
              title: updated.title,
              project_id: updated.project_id
            })
          end

          {:ok, updated}

        error ->
          error
      end
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
