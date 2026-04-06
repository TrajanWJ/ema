defmodule Ema.Actors.Tag do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "tags" do
    field :entity_type, :string
    field :entity_id, :string
    field :tag, :string
    field :namespace, :string, default: "default"

    belongs_to :actor, Ema.Actors.Actor, type: :string

    timestamps()
  end

  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:id, :entity_type, :entity_id, :tag, :actor_id, :namespace])
    |> validate_required([:entity_type, :entity_id, :tag, :actor_id])
    |> validate_length(:tag, min: 1, max: 50)
    |> unique_constraint([:entity_type, :entity_id, :tag, :actor_id])
  end
end
