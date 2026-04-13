defmodule Ema.Routines.Routine do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "routines" do
    field :name, :string
    field :description, :string
    field :steps, :map, default: %{}
    field :cadence, :string, default: "daily"
    field :active, :boolean, default: true
    field :last_run_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @valid_cadences ~w(daily weekly)

  def changeset(routine, attrs) do
    routine
    |> cast(attrs, [:id, :name, :description, :steps, :cadence, :active, :last_run_at])
    |> validate_required([:id, :name])
    |> validate_inclusion(:cadence, @valid_cadences)
  end
end
