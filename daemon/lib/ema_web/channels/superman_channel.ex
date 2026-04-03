defmodule EmaWeb.SupermanChannel do
  use Phoenix.Channel

  alias Ema.Intelligence.SupermanClient

  @impl true
  def join("superman:lobby", _params, socket) do
    send(self(), :check_health)
    {:ok, socket}
  end

  @impl true
  def handle_info(:check_health, socket) do
    case SupermanClient.health_check() do
      {:ok, _} -> push(socket, "health", %{status: "connected"})
      {:error, _} -> push(socket, "health", %{status: "disconnected"})
    end

    {:noreply, socket}
  end

  @impl true
  def handle_in("check_health", _params, socket) do
    case SupermanClient.health_check() do
      {:ok, body} -> {:reply, {:ok, %{status: "connected", server: body}}, socket}
      {:error, reason} -> {:reply, {:ok, %{status: "disconnected", error: inspect(reason)}}, socket}
    end
  end

  def handle_in("get_status", _params, socket) do
    case SupermanClient.get_status() do
      {:ok, body} -> {:reply, {:ok, body}, socket}
      {:error, reason} -> {:reply, {:error, %{error: inspect(reason)}}, socket}
    end
  end
end
