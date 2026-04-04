defmodule EmaWeb.HealthController do
  use EmaWeb, :controller

  @doc """
  Lightweight health check endpoint. Returns 200 OK when daemon is up.
  Used by Tauri frontend (Shell.tsx) to gate UI rendering.
  """
  def index(conn, _params) do
    json(conn, %{status: "ok", daemon: "ema"})
  end
end
