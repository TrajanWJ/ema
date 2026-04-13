defmodule Ema.Persistence.DccRecord do
  @moduledoc """
  Ecto schema for persisted DCC primitives in the session_store table.
  Wraps `Ema.Core.DccPrimitive` structs for SQLite durability.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Ema.Core.DccPrimitive

  @primary_key {:session_id, :string, autogenerate: false}

  schema "session_store" do
    field :dcc_data, :string
    field :crystallized, :boolean, default: false

    timestamps()
  end

  def changeset(record, attrs) do
    record
    |> cast(attrs, [:session_id, :dcc_data, :crystallized])
    |> validate_required([:session_id, :dcc_data])
  end

  @doc "Build a DccRecord from a DccPrimitive struct."
  def from_dcc(%DccPrimitive{} = dcc) do
    %__MODULE__{
      session_id: dcc.session_id,
      dcc_data: dcc |> DccPrimitive.to_map() |> Jason.encode!(),
      crystallized: dcc.crystallized_at != nil
    }
  end

  @doc "Extract a DccPrimitive from a DccRecord."
  def to_dcc(%__MODULE__{} = record) do
    case Jason.decode(record.dcc_data) do
      {:ok, map} -> {:ok, DccPrimitive.from_map(map)}
      {:error, reason} -> {:error, reason}
    end
  end
end
