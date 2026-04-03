defmodule EmaWeb.SecurityController do
  use EmaWeb, :controller

  alias Ema.Intelligence.SecurityAuditor

  action_fallback EmaWeb.FallbackController

  def posture(conn, _params) do
    report = SecurityAuditor.audit()
    json(conn, report)
  end

  def audit(conn, _params) do
    report = SecurityAuditor.audit()
    json(conn, %{ok: true, report: report})
  end
end
