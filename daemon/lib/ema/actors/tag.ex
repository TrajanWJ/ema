defmodule Ema.Actors.Tag do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "tags" do
    field :name, :string
    field :slug, :string
    field :color, :string

    belongs_to :actor, Ema.Actors.Actor, type: :string
    belongs_to :space, Ema.Spaces.Space, type: :string

    timestamps()
  end

  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:id, :name, :slug, :color, :actor_id, :space_id])
    |> validate_required([:name, :slug])
    |> unique_constraint([:space_id, :slug])
  end
end
