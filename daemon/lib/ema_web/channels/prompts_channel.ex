defmodule EmaWeb.PromptsChannel do
  use Phoenix.Channel

  @impl true
  def join("prompts:" <> _topic, _payload, socket) do
    {:ok, socket}
  end
end
