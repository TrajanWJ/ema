defmodule PlaceWeb.HabitsChannel do
  use Phoenix.Channel

  @impl true
  def join("habits:tracker", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
