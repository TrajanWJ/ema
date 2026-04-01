defmodule Ema.Tasks.Task do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "tasks" do
    field :title, :string
    field :description, :string
    field :status, :string, default: "proposed"
    field :priority, :integer, default: 3
    field :source_type, :string
    field :source_id, :string
    field :effort, :string
    field :due_date, :date
    field :recurrence, :string
    field :sort_order, :integer
    field :completed_at, :utc_datetime
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project, type: :string
    belongs_to :goal, Ema.Goals.Goal, type: :string
    belongs_to :parent, __MODULE__, type: :string

    # responsibility_id stored as raw field — Responsibilities context
    # will be created in a later plan
    field :responsibility_id, :string

    has_many :subtasks, __MODULE__, foreign_key: :parent_id
    has_many :comments, Ema.Tasks.Comment

    many_to_many :blocked_by, __MODULE__,
      join_through: "task_dependencies",
      join_keys: [task_id: :id, dependency_id: :id]

    many_to_many :blocks, __MODULE__,
      join_through: "task_dependencies",
      join_keys: [dependency_id: :id, task_id: :id]

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(proposed todo in_progress blocked in_review done archived cancelled)
  @valid_source_types ~w(proposal responsibility brain_dump manual session decomposition)
  @valid_efforts ~w(xs s m l xl)
  @valid_priorities [1, 2, 3, 4, 5]

  @valid_transitions %{
    "proposed" => ~w(todo cancelled),
    "todo" => ~w(in_progress cancelled),
    "in_progress" => ~w(blocked in_review done cancelled),
    "blocked" => ~w(in_progress cancelled),
    "in_review" => ~w(in_progress done cancelled),
    "done" => ~w(archived),
    "archived" => [],
    "cancelled" => ~w(todo)
  }

  def changeset(task, attrs) do
    task
    |> cast(attrs, [
      :id,
      :title,
      :description,
      :status,
      :priority,
      :source_type,
      :source_id,
      :effort,
      :due_date,
      :recurrence,
      :sort_order,
      :completed_at,
      :metadata,
      :project_id,
      :goal_id,
      :responsibility_id,
      :parent_id
    ])
    |> validate_required([:id, :title])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_inclusion(:priority, @valid_priorities)
    |> maybe_validate_inclusion(:source_type, @valid_source_types)
    |> maybe_validate_inclusion(:effort, @valid_efforts)
    |> maybe_set_completed_at()
  end

  def valid_transition?(from, to) do
    to in Map.get(@valid_transitions, from, [])
  end

  defp maybe_validate_inclusion(changeset, field, values) do
    case get_change(changeset, field) do
      nil -> changeset
      _ -> validate_inclusion(changeset, field, values)
    end
  end

  defp maybe_set_completed_at(changeset) do
    case get_change(changeset, :status) do
      "done" ->
        put_change(changeset, :completed_at, DateTime.utc_now() |> DateTime.truncate(:second))

      _ ->
        changeset
    end
  end
end
