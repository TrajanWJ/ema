defmodule Ema.Chronicle.Event do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "chronicle_events" do
    field :entity_type, :string
    field :entity_id, :string
    field :action, :string
    field :actor_id, :string
    field :prev_state, :map
    field :new_state, :map
    field :metadata, :map, default: %{}

    timestamps(type: :utc_datetime)
  end

  @required ~w(id entity_type entity_id action)a
  @optional ~w(actor_id prev_state new_state metadata)a

  def changeset(event, attrs) do
    event
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_inclusion(:action, ~w(create update delete transition approve kill redirect))
  end
end
