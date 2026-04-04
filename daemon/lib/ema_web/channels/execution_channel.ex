defmodule EmaWeb.ExecutionChannel do
  use Phoenix.Channel

  alias Ema.Executions

  @impl true
  def join("executions:all", _payload, socket) do
    executions =
      Executions.list_executions(limit: 100)
      |> Enum.map(&serialize/1)

    # Subscribe to internal PubSub so execution state changes reach this client
    Phoenix.PubSub.subscribe(Ema.PubSub, "executions")

    {:ok, %{executions: executions}, socket}
  end

  def join("executions:" <> rest, _payload, socket) do
    case String.split(rest, ":") do
      [execution_id, "stream"] ->
        # Subscribe to live stream output for this execution
        Phoenix.PubSub.subscribe(Ema.PubSub, "executions:#{execution_id}:stream")
        {:ok, %{streaming: true}, assign(socket, :stream_execution_id, execution_id)}

      [execution_id] ->
        case Executions.get_execution(execution_id) do
          nil -> {:error, %{reason: "not_found"}}
          execution ->
            events = Executions.list_events(execution_id) |> Enum.map(&serialize_event/1)
            sessions = Executions.list_agent_sessions(execution_id) |> Enum.map(&serialize_session/1)
            {:ok, %{execution: serialize(execution), events: events, sessions: sessions}, socket}
        end

      _ ->
        {:error, %{reason: "invalid_topic"}}
    end
  end

  # Relay internal PubSub events to the WS client
  @impl true
  def handle_info({"execution:completed", %{execution: execution, signal: signal}}, socket) do
    push(socket, "execution_completed", %{execution: serialize(execution), signal: signal})
    {:noreply, socket}
  end

  def handle_info({"execution:completed", %{execution: execution}}, socket) do
    push(socket, "execution_completed", %{execution: serialize(execution), signal: nil})
    {:noreply, socket}
  end

  def handle_info({"execution:created", %Ema.Executions.Execution{} = execution}, socket) do
    push(socket, "execution_created", %{execution: serialize(execution)})
    {:noreply, socket}
  end

  def handle_info({"execution:updated", %Ema.Executions.Execution{} = execution}, socket) do
    push(socket, "execution_updated", %{execution: serialize(execution)})
    {:noreply, socket}
  end

  # Relay live stream chunks to subscribed WebSocket clients
  def handle_info({:stream_chunk, %{execution_id: execution_id, chunk: chunk, timestamp: ts}}, socket) do
    push(socket, "stream_chunk", %{execution_id: execution_id, chunk: chunk, timestamp: ts})
    {:noreply, socket}
  end

  def handle_info(_msg, socket), do: {:noreply, socket}

  @impl true
  def handle_in("approve", %{"id" => id}, socket) do
    case Executions.approve_execution(id) do
      {:ok, execution} ->
        broadcast!(socket, "execution_updated", %{execution: serialize(execution)})
        {:reply, {:ok, %{execution: serialize(execution)}}, socket}
      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("cancel", %{"id" => id}, socket) do
    case Executions.cancel_execution(id) do
      {:ok, execution} ->
        broadcast!(socket, "execution_updated", %{execution: serialize(execution)})
        {:reply, {:ok, %{execution: serialize(execution)}}, socket}
      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("complete", %{"id" => id} = params, socket) do
    result_summary = params["result_summary"] || ""
    case Executions.on_execution_completed(id, result_summary) do
      {:ok, execution} ->
        broadcast!(socket, "execution_updated", %{execution: serialize(execution)})
        {:reply, {:ok, %{execution: serialize(execution)}}, socket}
      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  defp serialize(e) do
    %{
      id: e.id,
      title: e.title,
      objective: e.objective,
      mode: e.mode,
      status: e.status,
      project_slug: e.project_slug,
      intent_slug: e.intent_slug,
      intent_path: e.intent_path,
      result_path: e.result_path,
      requires_approval: e.requires_approval,
      brain_dump_item_id: e.brain_dump_item_id,
      proposal_id: e.proposal_id,
      completed_at: e.completed_at,
      inserted_at: e.inserted_at,
      updated_at: e.updated_at
    }
  end

  defp serialize_event(ev) do
    %{id: ev.id, type: ev.type, at: ev.at, actor_kind: ev.actor_kind, payload: ev.payload}
  end

  defp serialize_session(s) do
    %{
      id: s.id,
      agent_role: s.agent_role,
      status: s.status,
      started_at: s.started_at,
      ended_at: s.ended_at
    }
  end
end
