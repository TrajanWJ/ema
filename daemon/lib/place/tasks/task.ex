defmodule Place.Tasks.Task do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "tasks" do
    field :title, :string
    field :description, :string
    field :status, :string, default: "todo"
    field :priority, :integer
    field :due_date, :string

    belongs_to :goal, Place.Goals.Goal, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(todo in_progress done archived)

  def changeset(task, attrs) do
    task
    |> cast(attrs, [:id, :title, :description, :status, :priority, :due_date, :goal_id])
    |> validate_required([:id, :title])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
