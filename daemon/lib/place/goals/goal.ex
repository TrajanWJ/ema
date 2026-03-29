defmodule Place.Goals.Goal do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "goals" do
    field :title, :string
    field :description, :string
    field :timeframe, :string
    field :status, :string, default: "active"

    belongs_to :parent, __MODULE__, type: :string
    has_many :children, __MODULE__, foreign_key: :parent_id

    timestamps(type: :utc_datetime)
  end

  @valid_timeframes ~w(weekly monthly quarterly yearly 3year)
  @valid_statuses ~w(active completed archived)

  def changeset(goal, attrs) do
    goal
    |> cast(attrs, [:id, :title, :description, :timeframe, :status, :parent_id])
    |> validate_required([:id, :title, :timeframe])
    |> validate_inclusion(:timeframe, @valid_timeframes)
    |> validate_inclusion(:status, @valid_statuses)
  end
end
