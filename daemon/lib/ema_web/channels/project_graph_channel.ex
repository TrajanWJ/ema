defmodule EmaWeb.ProjectGraphChannel do
  use Phoenix.Channel
  require Logger

  @impl true
  def join("project_graph:lobby", _payload, socket) do
    send(self(), :send_graph)
    {:ok, socket}
  end

  def join(topic, _payload, _socket) do
    {:error, %{reason: "unknown topic #{topic}"}}
  end

  @impl true
  def handle_info(:send_graph, socket) do
    graph =
      try do
        Ema.Intelligence.ProjectGraph.get_graph()
      rescue
        _ -> %{nodes: [], edges: []}
      end

    push(socket, "graph", graph)
    {:noreply, socket}
  end

  @impl true
  def handle_in("ping", _payload, socket) do
    {:reply, {:ok, %{pong: true}}, socket}
  end

  def handle_in("refresh", _payload, socket) do
    send(self(), :send_graph)
    {:noreply, socket}
  end

  def handle_in(_event, _payload, socket), do: {:noreply, socket}
end
