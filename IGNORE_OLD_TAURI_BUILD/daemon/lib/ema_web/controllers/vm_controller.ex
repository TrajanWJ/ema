defmodule EmaWeb.VmController do
  use EmaWeb, :controller

  alias Ema.Intelligence.VmMonitor

  action_fallback EmaWeb.FallbackController

  def health(conn, _params) do
    json(conn, VmMonitor.heartbeat_snapshot())
  end

  def containers(conn, _params) do
    json(conn, %{containers: VmMonitor.containers()})
  end

  def check(conn, _params) do
    VmMonitor.check_now()
    json(conn, %{ok: true, message: "Health check triggered"})
  end
end
