defmodule EmaWeb.ProjectGraphChannel do
  use Phoenix.Channel

  @impl true
  def join("project_graph:" <> _topic, _payload, socket) do
    {:ok, socket}
  end
end
