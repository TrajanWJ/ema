defmodule Place.Habits.Habit do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "habits" do
    field :name, :string
    field :frequency, :string, default: "daily"
    field :target, :string
    field :active, :boolean, default: true
    field :sort_order, :integer, default: 0
    field :color, :string

    has_many :logs, Place.Habits.HabitLog

    timestamps(type: :utc_datetime)
  end

  @colors ~w(#5b9cf5 #38c97a #e8a84c #ef6b6b #a78bfa #f472b6 #34d399)

  def colors, do: @colors

  def changeset(habit, attrs) do
    habit
    |> cast(attrs, [:id, :name, :frequency, :target, :active, :sort_order, :color])
    |> validate_required([:id, :name, :frequency])
    |> validate_inclusion(:frequency, ~w(daily weekly))
  end
end
