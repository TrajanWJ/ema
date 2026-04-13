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

    active_seeds = Ema.Proposals.list_seeds(active: true)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    due_now_count =
      active_seeds
      |> Enum.count(fn seed ->
        case seed.schedule do
          nil ->
            false

          _ when is_nil(seed.last_run_at) ->
            true

          "every_" <> rest ->
            interval_seconds =
              case Integer.parse(rest) do
                {n, "h"} -> n * 3600
                {n, "m"} -> n * 60
                {n, "s"} -> n
                _ -> 3600
              end

            DateTime.diff(now, seed.last_run_at, :second) >= interval_seconds

          _ ->
            false
        end
      end)

    diagnostics = Ema.ProposalEngine.Diagnostics.snapshot()

    derived =
      Ema.ProposalEngine.Diagnostics.derived_status(status, length(active_seeds), due_now_count)

    json(conn, %{
      engine:
        Map.merge(status, %{
          active_seed_count: length(active_seeds),
          due_now_count: due_now_count,
          diagnostics: diagnostics,
          derived_state: derived.state,
          fail_closed: derived.fail_closed
        })
    })
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
