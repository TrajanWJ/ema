defmodule Ema.Intents.IntentEvent do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @event_types ~w(
    created status_changed phase_advanced linked unlinked
    reparented merged split archived
    execution_started execution_completed
    confirmed promoted demoted crystallized
    outcome_recorded imported
  )

  schema "intent_events" do
    belongs_to :intent, Ema.Intents.Intent, type: :string

    field :event_type, :string
    field :payload, :string
    field :actor, :string, default: "system"

    field :inserted_at, :utc_datetime
  end

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:id, :intent_id, :event_type, :payload, :actor, :inserted_at])
    |> validate_required([:intent_id, :event_type, :actor])
    |> validate_inclusion(:event_type, @event_types)
    |> maybe_generate_id()
    |> maybe_set_timestamp()
  end

  def decode_payload(%__MODULE__{payload: nil}), do: %{}

  def decode_payload(%__MODULE__{payload: p}) when is_binary(p) do
    case Jason.decode(p) do
      {:ok, map} when is_map(map) -> map
      _ -> %{}
    end
  end

  defp maybe_generate_id(changeset) do
    case get_field(changeset, :id) do
      nil ->
        ts = System.system_time(:millisecond)
        rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
        put_change(changeset, :id, "ie_#{ts}_#{rand}")

      _ ->
        changeset
    end
  end

  defp maybe_set_timestamp(changeset) do
    case get_change(changeset, :inserted_at) do
      nil -> put_change(changeset, :inserted_at, DateTime.utc_now() |> DateTime.truncate(:second))
      _ -> changeset
    end
  end
end
