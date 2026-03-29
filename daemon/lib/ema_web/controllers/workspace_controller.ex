defmodule EmaWeb.WorkspaceController do
  use EmaWeb, :controller

  alias Ema.Workspace

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    windows = Workspace.list_all()
    json(conn, %{data: Enum.map(windows, &window_json/1)})
  end

  def update(conn, %{"app_id" => app_id} = params) do
    attrs =
      params
      |> Map.take(["is_open", "x", "y", "width", "height", "is_maximized"])
      |> Map.new(fn {k, v} -> {String.to_existing_atom(k), v} end)

    with {:ok, window} <- Workspace.upsert(app_id, attrs) do
      EmaWeb.Endpoint.broadcast("workspace:state", "window_updated", window_json(window))
      json(conn, %{data: window_json(window)})
    end
  end

  defp window_json(window) do
    %{
      app_id: window.app_id,
      is_open: window.is_open,
      x: window.x,
      y: window.y,
      width: window.width,
      height: window.height,
      is_maximized: window.is_maximized
    }
  end
end
