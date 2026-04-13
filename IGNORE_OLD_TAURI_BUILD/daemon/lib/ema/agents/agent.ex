defmodule Ema.Agents.Agent do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "agents" do
    field :slug, :string
    field :name, :string
    field :description, :string
    field :avatar, :string
    field :status, :string, default: "inactive"
    field :model, :string, default: "sonnet"
    field :temperature, :float, default: 0.7
    field :max_tokens, :integer, default: 4096
    field :script_path, :string
    field :tools, {:array, :string}, default: []
    field :settings, :map, default: %{}

    belongs_to :project, Ema.Projects.Project, type: :string
    belongs_to :actor, Ema.Actors.Actor, type: :string

    has_many :channels, Ema.Agents.Channel
    has_many :conversations, Ema.Agents.Conversation
    has_many :runs, Ema.Agents.Run

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(inactive active error)
  @valid_models ~w(opus sonnet haiku)
  @required_fields ~w(id slug name)a
  @optional_fields ~w(description avatar status model temperature max_tokens script_path tools settings project_id actor_id)a

  def changeset(agent, attrs) do
    agent
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_inclusion(:model, @valid_models)
    |> validate_number(:temperature, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 2.0)
    |> validate_number(:max_tokens, greater_than: 0, less_than_or_equal_to: 200_000)
    |> validate_format(:slug, ~r/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      message: "must be lowercase alphanumeric with hyphens"
    )
    |> unique_constraint(:slug)
  end
end
