defmodule Ema.Tasks do
  require Logger
  @moduledoc """
  Tasks -- actionable work items linked to projects, goals, and responsibilities.
  Supports lifecycle transitions, decomposition into subtasks, comments, and dependencies.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Intelligence.ScopeAdvisor
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

  def list_recent_by_project(project_id, limit \\ 10) do
    Task
    |> where([t], t.project_id == ^project_id)
    |> order_by([t], desc: t.updated_at)
    |> limit(^limit)
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
    title = Map.get(attrs, :title) || Map.get(attrs, "title") || ""
    description = Map.get(attrs, :description) || Map.get(attrs, "description") || ""

    # DeliberationGate checks title + description for high-risk keywords
    case Ema.DeliberationGate.check_task(%{title: title, description: description}) do
      {:needs_deliberation, proposal_id} when not force_dispatch ->
        {:needs_deliberation, proposal_id}

      _ ->
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
  end

  defp do_create_task(attrs) do
    id = generate_id()
    attrs = put_scope_advice(attrs)
    # Use matching key style to avoid mixed-key maps
    id_key = if attrs |> Map.keys() |> Enum.any?(&is_atom/1), do: :id, else: "id"
    attrs_with_id = Map.put(attrs, id_key, id)

    result =
      %Task{}
      |> Task.changeset(attrs_with_id)
      |> Repo.insert()

    case result do
      {:ok, task} ->
        # Auto-route if no agent specified
        task =
          if is_nil(task.agent) do
            routing = Ema.Routing.IntentRouter.route(task)

            case update_task(task, %{
                   agent: routing.recommended_agent,
                   intent: to_string(routing.intent),
                   intent_confidence: to_string(routing.confidence)
                 }) do
              {:ok, updated} -> updated
              _ -> task
            end
          else
            task
          end

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
      File.write!(path, line <> "\n", [:append])
    end
  end

  def update_task(%Task{} = task, attrs) do
    attrs =
      attrs
      |> put_scope_advice(task)

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

  defp put_scope_advice(attrs, task \\ nil) do
    agent = Map.get(attrs, :agent) || Map.get(attrs, "agent") || task_agent(task)
    domain = domain_from_attrs(attrs) || task_domain(task)
    advice = ScopeAdvisor.check(agent, domain, Map.get(attrs, :title) || Map.get(attrs, "title"))

    if attrs |> Map.keys() |> Enum.all?(&is_binary/1) do
      put_in_metadata(attrs, "scope_advice", ScopeAdvisor.to_metadata(advice))
    else
      attrs
    end
  end

  defp put_in_metadata(attrs, key, value) do
    metadata =
      attrs
      |> metadata_from_attrs()
      |> Map.put(key, value)

    uses_atom_keys = attrs |> Map.keys() |> Enum.any?(&is_atom/1)

    if uses_atom_keys do
      Map.put(attrs, :metadata, metadata)
    else
      Map.put(attrs, "metadata", metadata)
    end
  end

  defp metadata_from_attrs(attrs) do
    Map.get(attrs, :metadata) || Map.get(attrs, "metadata") || %{}
  end

  defp domain_from_attrs(attrs) do
    metadata = metadata_from_attrs(attrs)

    Map.get(attrs, :domain) ||
      Map.get(attrs, "domain") ||
      Map.get(metadata, "domain") ||
      Map.get(metadata, :domain)
  end

  defp task_agent(nil), do: nil
  defp task_agent(task), do: task.agent

  defp task_domain(nil), do: nil

  defp task_domain(task) do
    metadata = task.metadata || %{}
    Map.get(metadata, "domain") || Map.get(metadata, :domain)
  end

  defp is_binary_keyed_map?(map) do
    Enum.all?(Map.keys(map), &is_binary/1)
  end
end
