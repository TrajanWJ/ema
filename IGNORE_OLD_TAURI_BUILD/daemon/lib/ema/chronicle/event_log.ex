defmodule Ema.Chronicle.EventLog do
  @moduledoc """
  Records all entity mutations as chronicle events for audit trail and undo.

  Usage from context modules:

      # After an update
      EventLog.record("task", task.id, "update", old_task, updated_task, actor_id: actor_id)

      # After a delete
      EventLog.record("task", task.id, "delete", task, nil)
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Chronicle.Event

  @doc "Record a mutation event. prev_state and new_state are structs or maps (or nil)."
  def record(entity_type, entity_id, action, prev_state, new_state, opts \\ []) do
    attrs = %{
      id: generate_id(),
      entity_type: to_string(entity_type),
      entity_id: to_string(entity_id),
      action: to_string(action),
      actor_id: opts[:actor_id] && to_string(opts[:actor_id]),
      prev_state: serialize_state(prev_state),
      new_state: serialize_state(new_state),
      metadata: opts[:metadata] || %{}
    }

    %Event{}
    |> Event.changeset(attrs)
    |> Repo.insert()
  end

  @doc "List events for an entity, newest first."
  def history(entity_type, entity_id, opts \\ []) do
    Event
    |> where([e], e.entity_type == ^to_string(entity_type))
    |> where([e], e.entity_id == ^to_string(entity_id))
    |> order_by([e], desc: e.inserted_at)
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  @doc "Most recent event for an entity."
  def last_event(entity_type, entity_id) do
    Event
    |> where([e], e.entity_type == ^to_string(entity_type))
    |> where([e], e.entity_id == ^to_string(entity_id))
    |> order_by([e], desc: e.inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  @doc "List recent events across all entities."
  def recent(opts \\ []) do
    limit = opts[:limit] || 50

    Event
    |> order_by([e], desc: e.inserted_at)
    |> maybe_filter(:entity_type, opts[:entity_type])
    |> maybe_filter(:action, opts[:action])
    |> maybe_filter(:actor_id, opts[:actor_id])
    |> limit(^limit)
    |> Repo.all()
  end

  @doc "Get a single event by ID."
  def get_event(id), do: Repo.get(Event, id)

  def get_event!(id), do: Repo.get!(Event, id)

  # -- Serialization --

  @doc "Public serializer for use by Reverter."
  def serialize_state_public(state), do: serialize_state(state)

  defp serialize_state(nil), do: nil

  defp serialize_state(%{__struct__: _} = struct) do
    struct
    |> Map.from_struct()
    |> Map.drop([:__meta__, :subtasks, :comments, :children, :links, :events, :tags])
    |> drop_ecto_associations()
    |> stringify_keys()
  end

  defp serialize_state(map) when is_map(map) do
    stringify_keys(map)
  end

  defp drop_ecto_associations(map) do
    Map.reject(map, fn {_k, v} -> match?(%Ecto.Association.NotLoaded{}, v) end)
  end

  defp stringify_keys(map) do
    Map.new(map, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), stringify_value(v)}
      {k, v} -> {k, stringify_value(v)}
    end)
  end

  defp stringify_value(%Date{} = d), do: Date.to_iso8601(d)
  defp stringify_value(%DateTime{} = dt), do: DateTime.to_iso8601(dt)
  defp stringify_value(%NaiveDateTime{} = ndt), do: NaiveDateTime.to_iso8601(ndt)
  defp stringify_value(v), do: v

  # -- Helpers --

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "evt_#{timestamp}_#{random}"
  end

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, limit), do: limit(query, ^limit)

  defp maybe_filter(query, _field, nil), do: query

  defp maybe_filter(query, field, value) do
    where(query, [e], field(e, ^field) == ^value)
  end
end
