defmodule EmaWeb.EvolutionChannel do
  use Phoenix.Channel

  @impl true
  def join("evolution:updates", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "evolution:events")
    Phoenix.PubSub.subscribe(Ema.PubSub, "evolution:updates")

    {:ok, %{}, socket}
  end

  @impl true
  def join("evolution:" <> _rest, _payload, _socket) do
    {:error, %{reason: "unknown_topic"}}
  end

  # Events from Ema.Evolution.broadcast_evolution_event/2
  @impl true
  def handle_info({event, rule}, socket) when is_binary(event) or is_atom(event) do
    push(socket, to_string(event), normalize_payload(rule))
    {:noreply, socket}
  end

  # Signals from Ema.Evolution.SignalScanner
  def handle_info({:evolution_signal, source, metadata}, socket) do
    push(socket, "signal_detected", %{source: source, metadata: metadata})
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  defp normalize_payload(payload) when is_map(payload), do: payload
  defp normalize_payload(payload), do: %{data: payload}
end
