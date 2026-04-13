defmodule Ema.Goals.KeyResult do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "goal_key_results" do
    field :description, :string
    field :metric_type, :string, default: "number"
    field :target_value, :decimal, default: Decimal.new(100)
    field :current_value, :decimal, default: Decimal.new(0)
    field :unit, :string
    field :due_date, :string

    belongs_to :goal, Ema.Goals.Goal, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_metric_types ~w(number percentage boolean)

  def changeset(kr, attrs) do
    kr
    |> cast(attrs, [
      :id,
      :goal_id,
      :description,
      :metric_type,
      :target_value,
      :current_value,
      :unit,
      :due_date
    ])
    |> validate_required([:id, :goal_id, :description, :metric_type, :target_value])
    |> validate_inclusion(:metric_type, @valid_metric_types)
  end

  def progress_percent(%__MODULE__{current_value: current, target_value: target}) do
    if Decimal.compare(target, Decimal.new(0)) == :gt do
      current
      |> Decimal.div(target)
      |> Decimal.mult(Decimal.new(100))
      |> Decimal.round(1)
      |> Decimal.to_float()
      |> min(100.0)
    else
      0.0
    end
  end
end
