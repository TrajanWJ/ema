defmodule Ema.Harvesters.Run do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "harvester_runs" do
    field :harvester, :string
    field :status, :string, default: "running"
    field :items_found, :integer, default: 0
    field :seeds_created, :integer, default: 0
    field :entities_created, :integer, default: 0
    field :error, :string
    field :metadata, :map, default: %{}
    field :started_at, :utc_datetime
    field :completed_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(running success failed)
  @valid_harvesters ~w(git session vault usage brain_dump)

  def changeset(run, attrs) do
    run
    |> cast(attrs, [
      :id,
      :harvester,
      :status,
      :items_found,
      :seeds_created,
      :entities_created,
      :error,
      :metadata,
      :started_at,
      :completed_at
    ])
    |> validate_required([:id, :harvester, :status, :started_at])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_inclusion(:harvester, @valid_harvesters)
  end
end
