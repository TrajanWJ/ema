defmodule EmaWeb.WorkspaceChannel do
  use Phoenix.Channel

  alias Ema.Workspace

  def join("workspace:state", _payload, socket) do
    windows = Workspace.list_all()

    data =
      Enum.map(windows, fn w ->
        %{
          app_id: w.app_id,
          is_open: w.is_open,
          x: w.x,
          y: w.y,
          width: w.width,
          height: w.height,
          is_maximized: w.is_maximized
        }
      end)

    {:ok, %{windows: data}, socket}
  end
end
