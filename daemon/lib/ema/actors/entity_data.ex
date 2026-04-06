defmodule Ema.Actors.EntityData do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "entity_data" do
    field :entity_type, :string
    field :entity_id, :string
    field :key, :string
    field :value, :map, default: %{}

    belongs_to :actor, Ema.Actors.Actor, type: :string

    timestamps()
  end

  def changeset(data, attrs) do
    data
    |> cast(attrs, [:id, :actor_id, :entity_type, :entity_id, :key, :value])
    |> validate_required([:id, :actor_id, :entity_type, :entity_id, :key])
    |> unique_constraint([:actor_id, :entity_type, :entity_id, :key])
  end
end
