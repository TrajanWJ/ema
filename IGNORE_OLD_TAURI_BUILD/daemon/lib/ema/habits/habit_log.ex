defmodule Ema.Habits.HabitLog do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "habit_logs" do
    field :date, :string
    field :completed, :boolean, default: false
    field :notes, :string

    belongs_to :habit, Ema.Habits.Habit, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(log, attrs) do
    log
    |> cast(attrs, [:id, :habit_id, :date, :completed, :notes])
    |> validate_required([:id, :habit_id, :date])
    |> unique_constraint([:habit_id, :date])
  end
end
