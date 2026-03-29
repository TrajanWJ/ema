defmodule PlaceWeb.BrainDumpChannel do
  use Phoenix.Channel

  @impl true
  def join("brain_dump:queue", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
