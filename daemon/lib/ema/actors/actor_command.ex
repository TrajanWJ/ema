defmodule Ema.Actors.ActorCommand do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "actor_commands" do
    field :command_name, :string, source: :command
    field :description, :string
    field :handler, :string
    field :args_spec, :map, source: :args_schema, default: %{}

    belongs_to :actor, Ema.Actors.Actor, type: :string

    timestamps()
  end

  def changeset(command, attrs) do
    command
    |> cast(attrs, [:id, :actor_id, :command_name, :description, :handler, :args_spec])
    |> validate_required([:actor_id, :command_name, :handler])
    |> unique_constraint([:actor_id, :command_name])
  end
end
