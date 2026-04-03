defmodule EmaWeb.OpenClawChannel do
  use Phoenix.Channel

  alias Ema.OpenClaw.AgentBridge

  @topic AgentBridge.topic()

  @impl true
  def join("openclaw:events", _payload, socket) do
    send(self(), :subscribe)
    status = AgentBridge.status()
    {:ok, status, socket}
  end

  @impl true
  def handle_info(:subscribe, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, @topic)
    {:noreply, socket}
  end

  def handle_info({:openclaw, event, payload}, socket) do
    push(socket, to_string(event), payload)
    {:noreply, socket}
  end
end
