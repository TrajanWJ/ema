defmodule EmaWeb.OnboardingController do
  use EmaWeb, :controller

  alias Ema.IntentionFarmer.Status

  action_fallback EmaWeb.FallbackController

  def status(conn, _params) do
    json(conn, Status.snapshot())
  end

  def readiness(conn, _params) do
    snapshot = Status.snapshot()

    json(conn, %{
      checked_at: snapshot.checked_at,
      readiness: snapshot.readiness,
      connections: snapshot.connections
    })
  end

  def run(conn, _params) do
    case Status.run_bootstrap() do
      {:ok, payload} -> json(conn, %{ok: true, result: payload})
      {:error, reason} -> conn |> put_status(500) |> json(%{error: inspect(reason)})
    end
  end
end
