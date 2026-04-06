defmodule Ema.Actors.Tag do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  @valid_entity_types ~w(space project task execution proposal goal brain_dump)
  @valid_namespaces ~w(default priority domain phase status custom)

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
    |> validate_required([:id, :entity_type, :entity_id, :tag, :actor_id])
    |> validate_inclusion(:entity_type, @valid_entity_types)
    |> validate_inclusion(:namespace, @valid_namespaces)
    |> unique_constraint([:entity_type, :entity_id, :tag, :actor_id])
  end

  def valid_entity_types, do: @valid_entity_types
  def valid_namespaces, do: @valid_namespaces
end
