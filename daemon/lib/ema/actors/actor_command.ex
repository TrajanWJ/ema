defmodule Ema.Actors.ActorCommand do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "actor_commands" do
    field :command, :string
    field :description, :string
    field :handler, :string
    field :args_schema, :map, default: %{}

    belongs_to :actor, Ema.Actors.Actor, type: :string

    timestamps()
  end

  def changeset(command, attrs) do
    command
    |> cast(attrs, [:id, :actor_id, :command, :description, :handler, :args_schema])
    |> validate_required([:actor_id, :command, :handler])
    |> validate_format(:command, ~r/^[a-z][a-z0-9 _:-]*$/)
    |> unique_constraint([:actor_id, :command])
  end
end
