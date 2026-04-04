defmodule EmaWeb.BabysitterController do
  @moduledoc """
  HTTP API for the Babysitter system.

  GET  /api/babysitter/state  — last 20 events + tick config
  POST /api/babysitter/config — {tick_interval_ms: N}
  POST /api/babysitter/nudge  — {channel_id, message}
  POST /api/babysitter/tick   — immediate tick
  """

  use EmaWeb, :controller

  def state(conn, _params) do
    events =
      Ema.Babysitter.VisibilityHub.all_events()
      |> Enum.take(-20)
      |> Enum.map(&serialize_event/1)

    config = Ema.Babysitter.StreamTicker.config()

    json(conn, %{
      events: events,
      tick_config: %{
        interval_ms: config.interval_ms,
        last_tick_at: DateTime.to_iso8601(config.last_tick_at)
      }
    })
  end

  def config(conn, %{"tick_interval_ms" => ms_raw}) do
    ms = parse_int(ms_raw)

    if ms && ms > 0 do
      :ok = Ema.Babysitter.StreamTicker.set_interval(ms)
      json(conn, %{ok: true, tick_interval_ms: ms})
    else
      conn
      |> put_status(400)
      |> json(%{error: "tick_interval_ms must be a positive integer"})
    end
  end

  def config(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{error: "tick_interval_ms required"})
  end

  def nudge(conn, %{"channel_id" => channel_id, "message" => message}) do
    Ema.Babysitter.OrgController.nudge(channel_id, message)
    json(conn, %{ok: true})
  end

  def nudge(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{error: "channel_id and message required"})
  end

  def tick(conn, _params) do
    Ema.Babysitter.StreamTicker.tick_now()
    json(conn, %{ok: true})
  end

  # --- Helpers ---

  defp serialize_event(%{category: cat, topic: topic, event: event, at: at}) do
    %{
      category: cat,
      topic: topic,
      event: inspect(event, limit: 5),
      at: DateTime.to_iso8601(at)
    }
  end

  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> nil
    end
  end
  defp parse_int(_), do: nil
end
