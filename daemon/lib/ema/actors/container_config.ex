defmodule Ema.Actors.ContainerConfig do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "container_config" do
    field :container_type, :string
    field :container_id, :string
    field :key, :string
    field :value, :map, default: %{}

    timestamps()
  end

  def changeset(config, attrs) do
    config
    |> cast(attrs, [:id, :container_type, :container_id, :key, :value])
    |> validate_required([:id, :container_type, :container_id, :key])
    |> unique_constraint([:container_type, :container_id, :key])
  end
end
