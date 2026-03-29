defmodule PlaceWeb.SettingsChannel do
  use Phoenix.Channel

  @impl true
  def join("settings:sync", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
