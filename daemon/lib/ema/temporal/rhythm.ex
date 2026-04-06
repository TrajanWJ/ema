defmodule Ema.Temporal.Rhythm do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "temporal_rhythms" do
    field :day_of_week, :integer
    field :hour, :integer
    field :energy_level, :float, default: 5.0
    field :focus_quality, :float, default: 5.0
    field :preferred_task_types, {:array, :string}, default: []
    field :sample_count, :integer, default: 0

    timestamps(type: :utc_datetime)
  end

  @task_types ~w(deep_work meetings admin creative shallow_work social rest)

  def task_types, do: @task_types

  def changeset(rhythm, attrs) do
    rhythm
    |> cast(attrs, [
      :id,
      :day_of_week,
      :hour,
      :energy_level,
      :focus_quality,
      :preferred_task_types,
      :sample_count
    ])
    |> validate_required([:id, :day_of_week, :hour])
    |> validate_number(:day_of_week, greater_than_or_equal_to: 0, less_than_or_equal_to: 6)
    |> validate_number(:hour, greater_than_or_equal_to: 0, less_than_or_equal_to: 23)
    |> validate_number(:energy_level, greater_than_or_equal_to: 1.0, less_than_or_equal_to: 10.0)
    |> validate_number(:focus_quality, greater_than_or_equal_to: 1.0, less_than_or_equal_to: 10.0)
    |> unique_constraint([:day_of_week, :hour])
  end
end
