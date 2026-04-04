defmodule EmaWeb.DecisionsChannel do
  use Phoenix.Channel

  @impl true
  def join("decisions:" <> _topic, _payload, socket) do
    {:ok, socket}
  end
end
