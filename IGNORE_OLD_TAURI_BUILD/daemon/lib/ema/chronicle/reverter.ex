defmodule Ema.Chronicle.Reverter do
  @moduledoc """
  Reverts a chronicle event by restoring prev_state to the entity.

  Each undo is itself recorded as a new chronicle event (action: "undo"),
  so the chronicle remains append-only.
  """

  alias Ema.Repo
  alias Ema.Chronicle.{Event, EventLog}

  @doc """
  Undo a specific event by ID. Applies prev_state back to the entity.
  Returns {:ok, reverted_entity} or {:error, reason}.
  """
  def undo(event_id) do
    case Repo.get(Event, event_id) do
      nil ->
        {:error, :event_not_found}

      %Event{prev_state: nil, action: "create"} ->
        {:error, :cannot_undo_create}

      %Event{prev_state: nil} ->
        {:error, :no_prev_state}

      event ->
        do_undo(event)
    end
  end

  defp do_undo(%Event{} = event) do
    case resolve_entity(event.entity_type, event.entity_id) do
      {:ok, entity, update_fn} ->
        # Snapshot current state before reverting
        current_state = EventLog.serialize_state_public(entity)

        case update_fn.(entity, atomize_keys(event.prev_state)) do
          {:ok, reverted} ->
            # Record the undo as a new event
            EventLog.record(
              event.entity_type,
              event.entity_id,
              "undo",
              current_state,
              reverted,
              actor_id: event.actor_id,
              metadata: %{"undone_event_id" => event.id}
            )

            {:ok, reverted}

          {:error, changeset} ->
            {:error, {:update_failed, changeset}}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp resolve_entity("task", id) do
    case Ema.Tasks.get_task(id) do
      nil -> {:error, :entity_not_found}
      task -> {:ok, task, &Ema.Tasks.update_task/2}
    end
  end

  defp resolve_entity("proposal", id) do
    case Ema.Proposals.get_proposal(id) do
      nil -> {:error, :entity_not_found}
      proposal -> {:ok, proposal, &Ema.Proposals.update_proposal/2}
    end
  end

  defp resolve_entity("intent", id) do
    case Ema.Intents.get_intent(id) do
      nil -> {:error, :entity_not_found}
      intent -> {:ok, intent, &Ema.Intents.update_intent/2}
    end
  end

  defp resolve_entity(type, _id) do
    {:error, {:unsupported_entity_type, type}}
  end

  # Convert string keys from stored JSON back to atom keys for changeset
  defp atomize_keys(map) when is_map(map) do
    # Only convert keys that are known schema fields — drop internal fields
    drop_keys = ~w(id __meta__ inserted_at updated_at)

    map
    |> Map.drop(drop_keys)
    |> Map.new(fn
      {k, v} when is_binary(k) -> {String.to_existing_atom(k), v}
      {k, v} -> {k, v}
    end)
  rescue
    ArgumentError -> map
  end
end
