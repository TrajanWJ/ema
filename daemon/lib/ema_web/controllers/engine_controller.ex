defmodule EmaWeb.EngineController do
  use EmaWeb, :controller

  action_fallback EmaWeb.FallbackController

  def status(conn, _params) do
    status =
      try do
        Ema.ProposalEngine.Scheduler.status()
      catch
        :exit, _ -> %{paused: true, last_tick_at: nil, seeds_dispatched: 0, error: "not_running"}
      end

    json(conn, %{engine: status})
  end

  def pause(conn, _params) do
    try do
      :ok = Ema.ProposalEngine.Scheduler.pause()
      json(conn, %{ok: true, paused: true})
    catch
      :exit, _ ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{error: "engine_not_running"})
    end
  end

  def resume(conn, _params) do
    try do
      :ok = Ema.ProposalEngine.Scheduler.resume()
      json(conn, %{ok: true, paused: false})
    catch
      :exit, _ ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{error: "engine_not_running"})
    end
  end
end
