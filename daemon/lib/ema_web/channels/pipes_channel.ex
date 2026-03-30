defmodule EmaWeb.PipesChannel do
  use Phoenix.Channel

  alias Ema.Pipes

  @impl true
  def join("pipes:editor", _payload, socket) do
    pipes =
      Pipes.list_pipes()
      |> Enum.map(&serialize_pipe/1)

    {:ok, %{pipes: pipes}, socket}
  end

  @impl true
  def join("pipes:monitor", _payload, socket) do
    # Subscribe to execution events
    Phoenix.PubSub.subscribe(Ema.PubSub, "pipes:monitor")

    runs =
      Pipes.recent_runs(limit: 50)
      |> Enum.map(&serialize_run/1)

    {:ok, %{recent_runs: runs}, socket}
  end

  @impl true
  def join("pipes:" <> _rest, _payload, _socket) do
    {:error, %{reason: "unknown_topic"}}
  end

  @impl true
  def handle_info({:pipe_executed, data}, socket) do
    push(socket, "pipe_executed", data)
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
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
      error: run.error
    }

    if Ecto.assoc_loaded?(run.pipe) and run.pipe do
      Map.put(base, :pipe_name, run.pipe.name)
    else
      base
    end
  end
end
