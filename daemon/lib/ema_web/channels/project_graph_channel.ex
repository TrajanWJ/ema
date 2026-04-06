defmodule EmaWeb.ProjectGraphChannel do
  use EmaWeb, :channel

  @impl true
  def join(_topic, _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_in(_event, _payload, socket) do
    {:noreply, socket}
  end
end
