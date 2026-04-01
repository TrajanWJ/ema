defmodule EmaWeb.RalphController do
  use EmaWeb, :controller

  action_fallback EmaWeb.FallbackController

  def status(conn, _params) do
    json(conn, %{
      status: "idle",
      last_run: nil,
      config: %{interval_minutes: 60, max_surface: 3}
    })
  end

  def run_cycle(conn, _params) do
    json(conn, %{status: "ok", surfaced: 0})
  end

  def configure(conn, _params) do
    json(conn, %{status: "ok"})
  end

  def surface(conn, %{"id" => id}) do
    json(conn, %{status: "ok", proposal_id: id})
  end
end
