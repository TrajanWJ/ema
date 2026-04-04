defmodule EmaWeb.PipelineChannel do
  use Phoenix.Channel

  @impl true
  def join("pipeline:" <> _topic, _payload, socket) do
    {:ok, socket}
  end
end
