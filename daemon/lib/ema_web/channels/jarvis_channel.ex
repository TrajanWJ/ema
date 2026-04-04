defmodule EmaWeb.JarvisChannel do
  use Phoenix.Channel
  require Logger

  @impl true
  def join("jarvis:lobby", _payload, socket) do
    send(self(), :send_initial_state)
    {:ok, socket}
  end

  def join(topic, _payload, _socket) do
    {:error, %{reason: "unknown topic #{topic}"}}
  end

  @impl true
  def handle_info(:send_initial_state, socket) do
    push(socket, "state", %{
      status: "ready",
      active_task: nil,
      history: []
    })
    {:noreply, socket}
  end

  @impl true
  def handle_in("ping", _payload, socket) do
    {:reply, {:ok, %{pong: true}}, socket}
  end

  def handle_in("ask", %{"query" => query}, socket) do
    Logger.info("[JarvisChannel] ask: #{query}")
    push(socket, "thinking", %{query: query})
    {:noreply, socket}
  end

  def handle_in(_event, _payload, socket), do: {:noreply, socket}
end
