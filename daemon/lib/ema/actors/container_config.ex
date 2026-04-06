defmodule Ema.Actors.ContainerConfig do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  @timestamps_opts [type: :utc_datetime]

  schema "container_config" do
    field :container_type, :string, primary_key: true
    field :container_id, :string, primary_key: true
    field :key, :string, primary_key: true
    field :value, :string

    field :updated_at, :utc_datetime
    field :inserted_at, :utc_datetime
  end

  def changeset(config, attrs) do
    config
    |> cast(attrs, [:container_type, :container_id, :key, :value, :updated_at, :inserted_at])
    |> validate_required([:container_type, :container_id, :key])
    |> unique_constraint([:container_type, :container_id, :key])
  end
end
