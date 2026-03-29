defmodule PlaceWeb.JournalChannel do
  use Phoenix.Channel

  @impl true
  def join("journal:today", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
