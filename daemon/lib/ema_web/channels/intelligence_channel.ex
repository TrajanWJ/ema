defmodule EmaWeb.IntelligenceChannel do
  use Phoenix.Channel

  # Topics backed by real PubSub broadcasts:
  #   intelligence:tokens  <- Ema.Intelligence.TokenTracker, CostForecaster
  #   intelligence:vm      <- Ema.Intelligence.VmMonitor
  #   intelligence:trust   <- Ema.Intelligence.TrustScorer
  #   intelligence:route   <- Ema.Intelligence.Router

  @impl true
  def join("intelligence:tokens", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "intelligence:tokens")
    {:ok, socket}
  end

  def join("intelligence:vm", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "intelligence:vm")
    {:ok, socket}
  end

  def join("intelligence:trust", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "intelligence:trust")
    {:ok, socket}
  end

  def join("intelligence:route", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "intelligence:route")
    {:ok, socket}
  end

  def join("intelligence:" <> _rest, _payload, socket) do
    # Unknown subtopic -- accept but do not subscribe to any PubSub topic
    {:ok, socket}
  end

  # Relay PubSub events to the WebSocket client

  @impl true
  def handle_info({event, payload}, socket) when is_atom(event) do
    push(socket, to_string(event), payload)
    {:noreply, socket}
  end

  def handle_info(_msg, socket), do: {:noreply, socket}
end
