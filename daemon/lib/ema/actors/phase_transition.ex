defmodule Ema.Actors.PhaseTransition do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "phase_transitions" do
    field :space_id, :string
    field :project_id, :string
    field :intent_id, :string
    field :from_phase, :string
    field :to_phase, :string
    field :week_number, :integer
    field :reason, :string
    field :summary, :string
    field :metadata, :map, default: %{}
    field :transitioned_at, :utc_datetime

    belongs_to :actor, Ema.Actors.Actor, type: :string, define_field: false
    field :actor_id, :string
  end

  def changeset(transition, attrs) do
    transition
    |> cast(attrs, [:id, :actor_id, :space_id, :project_id, :intent_id, :from_phase, :to_phase, :week_number, :reason, :summary, :metadata, :transitioned_at])
    |> validate_required([:actor_id, :to_phase])
  end
end
