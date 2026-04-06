defmodule Ema.Actors.Actor do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  @actor_types ~w(human agent)
  @phases ~w(idle plan execute review retro)
  @statuses ~w(active paused archived)

  schema "actors" do
    field :actor_type, :string, source: :type
    field :name, :string
    field :slug, :string
    field :capabilities, {:array, :string}, default: []
    field :config, :map, default: %{}
    field :phase, :string, default: "idle"
    field :phase_started_at, :utc_datetime
    field :status, :string, default: "active"

    belongs_to :space, Ema.Spaces.Space, type: :string

    has_many :tags, Ema.Actors.Tag, foreign_key: :actor_id
    has_many :entity_data, Ema.Actors.EntityData, foreign_key: :actor_id
    has_many :phase_transitions, Ema.Actors.PhaseTransition, foreign_key: :actor_id
    has_many :commands, Ema.Actors.ActorCommand, foreign_key: :actor_id

    timestamps()
  end

  def changeset(actor, attrs) do
    actor
    |> cast(attrs, [:id, :space_id, :actor_type, :name, :slug, :capabilities, :config, :phase, :phase_started_at, :status])
    |> validate_required([:actor_type, :name, :slug])
    |> validate_inclusion(:actor_type, @actor_types)
    |> validate_inclusion(:phase, @phases)
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:name, min: 1, max: 100)
    |> validate_format(:slug, ~r/^[a-z0-9][a-z0-9-]*$/)
    |> unique_constraint([:space_id, :slug])
  end

  def actor_types, do: @actor_types
  def phases, do: @phases
  def statuses, do: @statuses
end
