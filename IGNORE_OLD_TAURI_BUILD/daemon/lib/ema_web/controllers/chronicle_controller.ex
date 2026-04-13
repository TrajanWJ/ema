defmodule EmaWeb.ChronicleController do
  use EmaWeb, :controller

  alias Ema.Chronicle.{EventLog, Reverter}

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:entity_type, params["entity_type"])
      |> maybe_add(:action, params["action"])
      |> maybe_add(:actor_id, params["actor_id"])
      |> maybe_add(:limit, parse_int(params["limit"]))

    events = EventLog.recent(opts) |> Enum.map(&serialize/1)
    json(conn, %{events: events})
  end

  def history(conn, %{"entity_type" => entity_type, "entity_id" => entity_id} = params) do
    opts = maybe_add([], :limit, parse_int(params["limit"]))
    events = EventLog.history(entity_type, entity_id, opts) |> Enum.map(&serialize/1)
    json(conn, %{events: events})
  end

  def show(conn, %{"id" => id}) do
    case EventLog.get_event(id) do
      nil -> {:error, :not_found}
      event -> json(conn, %{event: serialize(event)})
    end
  end

  def undo(conn, %{"id" => id}) do
    case Reverter.undo(id) do
      {:ok, _reverted} ->
        json(conn, %{ok: true, message: "Event #{id} undone"})

      {:error, :event_not_found} ->
        {:error, :not_found}

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: inspect(reason)})
    end
  end

  defp serialize(event) do
    %{
      id: event.id,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      action: event.action,
      actor_id: event.actor_id,
      prev_state: event.prev_state,
      new_state: event.new_state,
      metadata: event.metadata,
      inserted_at: event.inserted_at,
      updated_at: event.updated_at
    }
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
end
