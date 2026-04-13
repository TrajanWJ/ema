defmodule EmaWeb.PipeController do
  use EmaWeb, :controller

  alias Ema.Pipes
  alias Ema.Pipes.Registry

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:project_id, params["project_id"])
      |> maybe_put(:active, parse_bool(params["active"]))

    pipes =
      Pipes.list_pipes(opts)
      |> Enum.map(&serialize_pipe/1)

    json(conn, %{pipes: pipes})
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"],
      trigger_pattern: params["trigger_pattern"],
      description: params["description"],
      metadata: params["metadata"],
      project_id: params["project_id"],
      active: params["active"]
    }

    with {:ok, pipe} <- Pipes.create_pipe(attrs) do
      pipe = Pipes.get_pipe(pipe.id)
      broadcast_change("pipe_created", pipe)

      conn
      |> put_status(:created)
      |> json(serialize_pipe(pipe))
    end
  end

  def show(conn, %{"id" => id}) do
    case Pipes.get_pipe(id) do
      nil -> {:error, :not_found}
      pipe -> json(conn, serialize_pipe(pipe))
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Pipes.get_pipe(id) do
      nil ->
        {:error, :not_found}

      pipe ->
        attrs = %{
          name: params["name"],
          trigger_pattern: params["trigger_pattern"],
          description: params["description"],
          metadata: params["metadata"],
          active: params["active"]
        }

        with {:ok, updated} <- Pipes.update_pipe(pipe, attrs) do
          updated = Pipes.get_pipe(updated.id)
          broadcast_change("pipe_updated", updated)
          json(conn, serialize_pipe(updated))
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Pipes.get_pipe(id) do
      nil ->
        {:error, :not_found}

      pipe ->
        with {:ok, _} <- Pipes.delete_pipe(pipe) do
          broadcast_change("pipe_deleted", %{id: id})
          json(conn, %{ok: true})
        end
    end
  end

  def toggle(conn, %{"id" => id}) do
    case Pipes.get_pipe(id) do
      nil ->
        {:error, :not_found}

      pipe ->
        with {:ok, toggled} <- Pipes.toggle_pipe(pipe) do
          toggled = Pipes.get_pipe(toggled.id)
          broadcast_change("pipe_toggled", toggled)
          json(conn, serialize_pipe(toggled))
        end
    end
  end

  def system_pipes(conn, _params) do
    pipes =
      Pipes.list_system_pipes()
      |> Enum.map(&serialize_pipe/1)

    json(conn, %{pipes: pipes})
  end

  def fork(conn, %{"id" => id}) do
    case Pipes.get_pipe(id) do
      nil ->
        {:error, :not_found}

      pipe ->
        with {:ok, forked} <- Pipes.fork_pipe(pipe) do
          broadcast_change("pipe_created", forked)

          conn
          |> put_status(:created)
          |> json(serialize_pipe(forked))
        end
    end
  end

  def catalog(conn, _params) do
    triggers =
      Registry.list_triggers()
      |> Enum.map(fn t ->
        %{
          id: t.id,
          context: t.context,
          event_type: t.event_type,
          label: t.label,
          description: t.description
        }
      end)

    actions =
      Registry.list_actions()
      |> Enum.map(fn a ->
        %{
          id: a.id,
          context: a.context,
          action_id: a.action_id,
          label: a.label,
          description: a.description,
          schema: a.schema
        }
      end)

    transforms =
      Registry.list_transforms()
      |> Enum.map(fn t ->
        %{id: t.id, label: t.label, type: t.type, description: t.description}
      end)

    json(conn, %{triggers: triggers, actions: actions, transforms: transforms})
  end

  def execution_history(conn, params) do
    runs =
      case params["pipe_id"] do
        nil -> Pipes.recent_runs(limit: parse_int(params["limit"], 100))
        pipe_id -> Pipes.execution_history(pipe_id, limit: parse_int(params["limit"], 50))
      end
      |> Enum.map(&serialize_run/1)

    json(conn, %{runs: runs})
  end

  # --- Serialization ---

  defp serialize_pipe(pipe) when is_map(pipe) and not is_struct(pipe, Ema.Pipes.Pipe) do
    pipe
  end

  defp serialize_pipe(pipe) do
    %{
      id: pipe.id,
      name: pipe.name,
      system: pipe.system,
      active: pipe.active,
      trigger_pattern: pipe.trigger_pattern,
      description: pipe.description,
      metadata: pipe.metadata,
      project_id: pipe.project_id,
      actions: Enum.map(pipe.pipe_actions || [], &serialize_action/1),
      transforms: Enum.map(pipe.pipe_transforms || [], &serialize_transform/1),
      created_at: pipe.inserted_at,
      updated_at: pipe.updated_at
    }
  end

  defp serialize_action(action) do
    %{
      id: action.id,
      action_id: action.action_id,
      config: action.config,
      sort_order: action.sort_order
    }
  end

  defp serialize_transform(transform) do
    %{
      id: transform.id,
      transform_type: transform.transform_type,
      config: transform.config,
      sort_order: transform.sort_order
    }
  end

  defp serialize_run(run) do
    base = %{
      id: run.id,
      pipe_id: run.pipe_id,
      status: run.status,
      trigger_event: run.trigger_event,
      started_at: run.started_at,
      completed_at: run.completed_at,
      error: run.error,
      created_at: run.inserted_at
    }

    if Ecto.assoc_loaded?(run.pipe) and run.pipe do
      Map.put(base, :pipe_name, run.pipe.name)
    else
      base
    end
  end

  # --- Helpers ---

  defp broadcast_change(event, data) do
    EmaWeb.Endpoint.broadcast("pipes:editor", event, data)
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_bool("true"), do: true
  defp parse_bool("false"), do: false
  defp parse_bool(_), do: nil

  defp parse_int(nil, default), do: default

  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> default
    end
  end

  defp parse_int(val, _default) when is_integer(val), do: val
end
