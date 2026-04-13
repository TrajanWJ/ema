defmodule Ema.Projects.Milestone do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "project_milestones" do
    field :project_id, :string
    field :name, :string
    field :target_date, :date
    field :status, :string, default: "pending"
    field :deliverables, :map, default: %{"items" => []}

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(pending in_progress completed)

  def changeset(milestone, attrs) do
    milestone
    |> cast(attrs, [:id, :project_id, :name, :target_date, :status, :deliverables])
    |> validate_required([:id, :project_id, :name])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
