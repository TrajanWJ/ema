defmodule Ema.Actors.ActorCommand do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "actor_commands" do
    field :command_name, :string
    field :description, :string
    field :handler_module, :string
    field :handler_function, :string
    field :args_spec, :map, default: %{}

    belongs_to :actor, Ema.Actors.Actor, type: :string

    timestamps()
  end

  def changeset(command, attrs) do
    command
    |> cast(attrs, [:id, :actor_id, :command_name, :description, :handler_module, :handler_function, :args_spec])
    |> validate_required([:actor_id, :command_name, :handler_module, :handler_function])
    |> unique_constraint([:actor_id, :command_name])
  end
end
