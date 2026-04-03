defmodule Ema.Temporal.EnergyLog do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "temporal_energy_logs" do
    field :energy_level, :float
    field :focus_quality, :float
    field :activity_type, :string
    field :source, :string, default: "manual"
    field :logged_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @sources ~w(manual journal_mood task_completion focus_session habit_completion system_inferred)

  def sources, do: @sources

  def changeset(log, attrs) do
    log
    |> cast(attrs, [:id, :energy_level, :focus_quality, :activity_type, :source, :logged_at])
    |> validate_required([:id, :energy_level, :logged_at])
    |> validate_number(:energy_level, greater_than_or_equal_to: 1.0, less_than_or_equal_to: 10.0)
    |> validate_inclusion(:source, @sources)
  end
end
