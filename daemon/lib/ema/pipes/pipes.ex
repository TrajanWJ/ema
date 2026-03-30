defmodule Ema.Pipes do
  @moduledoc """
  Pipes -- visual workflow automation. Wires triggers to actions across all
  EMA contexts via a node-based pipeline system. Every stock behavior is a
  pipe that can be inspected, modified, disabled, or extended.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Pipes.{Pipe, PipeAction, PipeTransform, PipeRun}

  # --- Pipes CRUD ---

  def list_pipes(opts \\ []) do
    Pipe
    |> maybe_filter_project(opts[:project_id])
    |> maybe_filter_active(opts[:active])
    |> maybe_filter_system(opts[:system])
    |> order_by(asc: :name)
    |> preload([:pipe_actions, :pipe_transforms])
    |> Repo.all()
  end

  def get_pipe(id) do
    Pipe
    |> preload([:pipe_actions, :pipe_transforms])
    |> Repo.get(id)
  end

  def create_pipe(attrs) do
    id = generate_id("pipe")

    %Pipe{}
    |> Pipe.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_ok(&notify_change/1)
  end

  def update_pipe(%Pipe{} = pipe, attrs) do
    pipe
    |> Pipe.changeset(attrs)
    |> Repo.update()
    |> tap_ok(&notify_change/1)
  end

  def delete_pipe(%Pipe{system: true}), do: {:error, :cannot_delete_system_pipe}

  def delete_pipe(%Pipe{} = pipe) do
    Repo.delete(pipe)
    |> tap_ok(&notify_change/1)
  end

  def toggle_pipe(%Pipe{} = pipe) do
    pipe
    |> Pipe.changeset(%{active: !pipe.active})
    |> Repo.update()
    |> tap_ok(&notify_change/1)
  end

  def list_system_pipes do
    list_pipes(system: true)
  end

  def fork_pipe(%Pipe{} = pipe) do
    pipe = Repo.preload(pipe, [:pipe_actions, :pipe_transforms])
    id = generate_id("pipe")

    fork_attrs = %{
      id: id,
      name: "#{pipe.name} (fork)",
      system: false,
      active: false,
      trigger_pattern: pipe.trigger_pattern,
      description: pipe.description,
      metadata: Map.put(pipe.metadata || %{}, "forked_from", pipe.id),
      project_id: pipe.project_id
    }

    Repo.transaction(fn ->
      {:ok, forked} =
        %Pipe{}
        |> Pipe.changeset(fork_attrs)
        |> Repo.insert()

      for action <- pipe.pipe_actions do
        %PipeAction{}
        |> PipeAction.changeset(%{
          id: generate_id("pa"),
          action_id: action.action_id,
          config: action.config,
          sort_order: action.sort_order,
          pipe_id: forked.id
        })
        |> Repo.insert!()
      end

      for transform <- pipe.pipe_transforms do
        %PipeTransform{}
        |> PipeTransform.changeset(%{
          id: generate_id("pt"),
          transform_type: transform.transform_type,
          config: transform.config,
          sort_order: transform.sort_order,
          pipe_id: forked.id
        })
        |> Repo.insert!()
      end

      Repo.preload(forked, [:pipe_actions, :pipe_transforms])
    end)
  end

  # --- Actions ---

  def add_action(%Pipe{} = pipe, attrs) do
    id = generate_id("pa")

    max_order =
      PipeAction
      |> where([a], a.pipe_id == ^pipe.id)
      |> select([a], max(a.sort_order))
      |> Repo.one() || -1

    %PipeAction{}
    |> PipeAction.changeset(
      attrs
      |> Map.put(:id, id)
      |> Map.put(:pipe_id, pipe.id)
      |> Map.put_new(:sort_order, max_order + 1)
    )
    |> Repo.insert()
  end

  def remove_action(%Pipe{} = pipe, action_id) do
    case Repo.get_by(PipeAction, id: action_id, pipe_id: pipe.id) do
      nil -> {:error, :not_found}
      action -> Repo.delete(action)
    end
  end

  # --- Transforms ---

  def add_transform(%Pipe{} = pipe, attrs) do
    id = generate_id("pt")

    max_order =
      PipeTransform
      |> where([t], t.pipe_id == ^pipe.id)
      |> select([t], max(t.sort_order))
      |> Repo.one() || -1

    %PipeTransform{}
    |> PipeTransform.changeset(
      attrs
      |> Map.put(:id, id)
      |> Map.put(:pipe_id, pipe.id)
      |> Map.put_new(:sort_order, max_order + 1)
    )
    |> Repo.insert()
  end

  def remove_transform(%Pipe{} = pipe, transform_id) do
    case Repo.get_by(PipeTransform, id: transform_id, pipe_id: pipe.id) do
      nil -> {:error, :not_found}
      transform -> Repo.delete(transform)
    end
  end

  # --- Runs ---

  def record_run(%Pipe{} = pipe, attrs) do
    id = generate_id("pr")

    %PipeRun{}
    |> PipeRun.changeset(
      attrs
      |> Map.put(:id, id)
      |> Map.put(:pipe_id, pipe.id)
    )
    |> Repo.insert()
  end

  def execution_history(pipe_id, opts \\ []) do
    limit = opts[:limit] || 50

    PipeRun
    |> where([r], r.pipe_id == ^pipe_id)
    |> order_by(desc: :started_at)
    |> limit(^limit)
    |> Repo.all()
  end

  def recent_runs(opts \\ []) do
    limit = opts[:limit] || 100

    PipeRun
    |> order_by(desc: :started_at)
    |> limit(^limit)
    |> preload(:pipe)
    |> Repo.all()
  end

  def pipe_count do
    Repo.aggregate(Pipe, :count)
  end

  # --- Private ---

  defp maybe_filter_project(query, nil), do: query
  defp maybe_filter_project(query, project_id), do: where(query, [p], p.project_id == ^project_id)

  defp maybe_filter_active(query, nil), do: query
  defp maybe_filter_active(query, active), do: where(query, [p], p.active == ^active)

  defp maybe_filter_system(query, nil), do: query
  defp maybe_filter_system(query, system), do: where(query, [p], p.system == ^system)

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end

  defp tap_ok({:ok, result} = tuple, fun) do
    fun.(result)
    tuple
  end

  defp tap_ok(error, _fun), do: error

  defp notify_change(_pipe) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "pipes:config", :pipes_changed)
  end
end
