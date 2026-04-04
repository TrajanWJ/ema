defmodule EmaWeb.JarvisChannel do
  use Phoenix.Channel

  @impl true
  def join("jarvis:" <> _topic, _payload, socket) do
    {:ok, socket}
  end
end
