defmodule EmaWeb.FeedbackController do
  @moduledoc """
  REST API for EMA feedback stream.

  GET  /api/feedback           — recent events (default 50)
  GET  /api/feedback?limit=N   — last N events
  GET  /api/feedback/status    — delivery layer status
  POST /api/feedback/emit      — manually emit a feedback event (internal use)
  """

  use EmaWeb, :controller

  alias Ema.Feedback.{Store, Broadcast, Consumer, DiscordDelivery}

  # GET /api/feedback
  def index(conn, params) do
    limit = min(parse_int(params["limit"], 50), 500)
    events = Store.recent(limit)

    json(conn, %{
      ok: true,
      count: length(events),
      events: Enum.map(events, &serialize_event/1)
    })
  end

  # GET /api/feedback/status
  def status(conn, _params) do
    consumer_status = Consumer.status()
    delivery_status = DiscordDelivery.status()

    json(conn, %{
      ok: true,
      consumer: consumer_status,
      delivery: delivery_status,
      store_size: Store.size()
    })
  end

  # POST /api/feedback/emit
  def emit(conn, %{"channel_id" => channel_id, "message" => message} = params) do
    source = String.to_existing_atom(params["source"] || "system")
    metadata = params["metadata"] || %{}
    Broadcast.emit(source, channel_id, message, metadata)
    json(conn, %{ok: true})
  rescue
    _ ->
      conn |> put_status(400) |> json(%{error: "invalid params"})
  end

  def emit(conn, _params) do
    conn |> put_status(400) |> json(%{error: "channel_id and message required"})
  end

  defp serialize_event(event) do
    %{
      source: event.source,
      channel_id: event.channel_id,
      message: event.message,
      timestamp: DateTime.to_iso8601(event.timestamp),
      metadata: event.metadata
    }
  end

  defp parse_int(nil, default), do: default
  defp parse_int(s, default) do
    case Integer.parse(s) do
      {n, _} -> n
      :error -> default
    end
  end
end
