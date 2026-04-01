defmodule Ema.Responsibilities.Responsibility do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "responsibilities" do
    field :title, :string
    field :description, :string
    field :role, :string
    field :cadence, :string
    field :health, :float, default: 1.0
    field :active, :boolean, default: true
    field :last_checked_at, :utc_datetime
    field :recurrence_rule, :string
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project, type: :string

    has_many :tasks, Ema.Tasks.Task, foreign_key: :responsibility_id
    has_many :check_ins, Ema.Responsibilities.CheckIn

    timestamps(type: :utc_datetime)
  end

  @valid_roles ~w(developer self maintainer learner custom)
  @valid_cadences ~w(daily weekly biweekly monthly quarterly ongoing)

  def changeset(responsibility, attrs) do
    responsibility
    |> cast(attrs, [
      :id,
      :title,
      :description,
      :role,
      :cadence,
      :health,
      :active,
      :last_checked_at,
      :recurrence_rule,
      :metadata,
      :project_id
    ])
    |> validate_required([:id, :title])
    |> maybe_validate_inclusion(:role, @valid_roles)
    |> maybe_validate_inclusion(:cadence, @valid_cadences)
    |> validate_number(:health, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0)
  end

  defp maybe_validate_inclusion(changeset, field, values) do
    case get_change(changeset, field) do
      nil -> changeset
      _ -> validate_inclusion(changeset, field, values)
    end
  end
end
