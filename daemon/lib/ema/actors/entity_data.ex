defmodule Ema.Actors.EntityData do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  @timestamps_opts [type: :utc_datetime]

  schema "entity_data" do
    field :entity_type, :string, primary_key: true
    field :entity_id, :string, primary_key: true
    field :key, :string, primary_key: true
    field :value, :string

    belongs_to :actor, Ema.Actors.Actor, type: :string, primary_key: true

    field :updated_at, :utc_datetime
    field :inserted_at, :utc_datetime
  end

  def changeset(data, attrs) do
    data
    |> cast(attrs, [:actor_id, :entity_type, :entity_id, :key, :value, :updated_at, :inserted_at])
    |> validate_required([:actor_id, :entity_type, :entity_id, :key])
    |> unique_constraint([:actor_id, :entity_type, :entity_id, :key])
  end
end
