defmodule Ema.Projects.Project do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "projects" do
    field :slug, :string
    field :name, :string
    field :description, :string
    field :status, :string, default: "incubating"
    field :icon, :string
    field :color, :string
    field :linked_path, :string
    field :context_hash, :string
    field :settings, :map, default: %{}

    belongs_to :parent, __MODULE__, type: :string

    # source_proposal_id stored as raw field — Proposals context
    # will be created in a later plan
    field :source_proposal_id, :string

    has_many :children, __MODULE__, foreign_key: :parent_id
    has_many :tasks, Ema.Tasks.Task

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(incubating active paused completed archived)
  @valid_transitions %{
    "incubating" => ~w(active archived),
    "active" => ~w(paused completed archived),
    "paused" => ~w(active archived),
    "completed" => ~w(archived),
    "archived" => ~w(incubating active)
  }

  def changeset(project, attrs) do
    project
    |> cast(attrs, [
      :id, :slug, :name, :description, :status, :icon, :color,
      :linked_path, :context_hash, :settings, :parent_id, :source_proposal_id
    ])
    |> validate_required([:id, :slug, :name])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_format(:slug, ~r/^[a-z0-9][a-z0-9-]*$/, message: "must be lowercase alphanumeric with hyphens")
    |> unique_constraint(:slug)
  end

  def valid_transition?(from, to) do
    to in Map.get(@valid_transitions, from, [])
  end

  def valid_transitions(status) do
    Map.get(@valid_transitions, status, [])
  end
end
