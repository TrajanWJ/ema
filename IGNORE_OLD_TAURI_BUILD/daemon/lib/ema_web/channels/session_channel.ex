defmodule EmaWeb.SessionChannel do
  use Phoenix.Channel

  alias Ema.ClaudeSessions

  @impl true
  def join("sessions:live", _payload, socket) do
    send(self(), :send_snapshot)
    Phoenix.PubSub.subscribe(Ema.PubSub, "claude_sessions")
    {:ok, socket}
  end

  @impl true
  def join("sessions:" <> _id, _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_info(:send_snapshot, socket) do
    active =
      ClaudeSessions.get_active_sessions()
      |> Enum.map(&serialize/1)

    push(socket, "snapshot", %{active_sessions: active})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:session_detected, data}, socket) do
    push(socket, "session_detected", data)
    {:noreply, socket}
  end

  @impl true
  def handle_info({:session_active, data}, socket) do
    push(socket, "session_active", data)
    {:noreply, socket}
  end

  @impl true
  def handle_info({:session_inactive, data}, socket) do
    push(socket, "session_inactive", data)
    {:noreply, socket}
  end

  @impl true
  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  defp serialize(session) do
    %{
      id: session.id,
      session_id: session.session_id,
      project_path: session.project_path,
      project_id: session.project_id,
      status: session.status,
      last_active: session.last_active
    }
  end
end
