defmodule PlaceWeb.DashboardChannel do
  use Phoenix.Channel

  @impl true
  def join("dashboard:lobby", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
