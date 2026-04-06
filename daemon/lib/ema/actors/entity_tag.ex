defmodule Ema.Actors.EntityTag do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "entity_tags" do
    field :entity_type, :string
    field :entity_id, :string

    belongs_to :tag, Ema.Actors.Tag, type: :string
    belongs_to :actor, Ema.Actors.Actor, type: :string

    timestamps()
  end

  def changeset(entity_tag, attrs) do
    entity_tag
    |> cast(attrs, [:id, :tag_id, :entity_type, :entity_id, :actor_id])
    |> validate_required([:tag_id, :entity_type, :entity_id])
    |> unique_constraint([:tag_id, :entity_type, :entity_id])
  end
end
