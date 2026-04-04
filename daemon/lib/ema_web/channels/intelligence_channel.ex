defmodule EmaWeb.IntelligenceChannel do
  use Phoenix.Channel
  require Logger

  # intelligence:tokens
  @impl true
  def join("intelligence:tokens", _payload, socket) do
    send(self(), :send_token_state)
    {:ok, socket}
  end

  # intelligence:vm
  def join("intelligence:vm", _payload, socket) do
    send(self(), :send_vm_state)
    {:ok, socket}
  end

  def join(topic, _payload, _socket) do
    {:error, %{reason: "unknown topic #{topic}"}}
  end

  @impl true
  def handle_info(:send_token_state, socket) do
    state =
      try do
        Ema.Intelligence.TokenTracker.get_summary()
      rescue
        _ ->
          %{tokens_used: 0, tokens_remaining: 100_000, model: "unknown",
            cost_usd: 0.0, session_count: 0}
      end

    push(socket, "token_state", state)
    {:noreply, socket}
  end

  def handle_info(:send_vm_state, socket) do
    state =
      try do
        Ema.Intelligence.VmMonitor.get_health()
      rescue
        _ ->
          %{cpu: 0.0, memory: 0.0, status: "healthy",
            uptime_seconds: 0, load_avg: 0.0}
      end

    push(socket, "vm_state", state)
    {:noreply, socket}
  end

  @impl true
  def handle_in("ping", _payload, socket) do
    {:reply, {:ok, %{pong: true}}, socket}
  end

  def handle_in("request_update", _payload, socket) do
    topic = socket.topic
    cond do
      String.ends_with?(topic, "tokens") -> send(self(), :send_token_state)
      String.ends_with?(topic, "vm") -> send(self(), :send_vm_state)
      true -> :ok
    end
    {:noreply, socket}
  end

  def handle_in(_event, _payload, socket), do: {:noreply, socket}
end
