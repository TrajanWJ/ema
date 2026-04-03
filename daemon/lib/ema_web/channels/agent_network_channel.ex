defmodule EmaWeb.AgentNetworkChannel do
  @moduledoc """
  Real-time channel for agent network status updates.
  Sends current status on join and pushes changes as they occur.
  """

  use Phoenix.Channel

  alias Ema.Agents.NetworkMonitor

  @impl true
  def join("agent_network:status", _params, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "agent_network")
    status = NetworkMonitor.get_status()
    {:ok, status, socket}
  end

  @impl true
  def handle_info({:network_status, status}, socket) do
    push(socket, "network_status", status)
    {:noreply, socket}
  end

  def handle_info(_msg, socket), do: {:noreply, socket}
end
