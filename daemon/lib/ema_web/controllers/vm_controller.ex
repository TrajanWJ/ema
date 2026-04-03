defmodule EmaWeb.VmController do
  use EmaWeb, :controller

  alias Ema.Intelligence.VmMonitor

  action_fallback EmaWeb.FallbackController

  def health(conn, _params) do
    case VmMonitor.current_health() do
      nil ->
        json(conn, %{status: "unknown", openclaw_up: false, ssh_up: false, latency_ms: nil, containers: [], checked_at: nil})

      event ->
        containers = VmMonitor.containers()

        json(conn, %{
          status: event.status,
          openclaw_up: event.openclaw_up,
          ssh_up: event.ssh_up,
          latency_ms: event.latency_ms,
          containers: containers,
          checked_at: event.checked_at
        })
    end
  end

  def containers(conn, _params) do
    json(conn, %{containers: VmMonitor.containers()})
  end

  def check(conn, _params) do
    VmMonitor.check_now()
    json(conn, %{ok: true, message: "Health check triggered"})
  end
end
