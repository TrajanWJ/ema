defmodule Ema.Evolution.BehaviorRule do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "behavior_rules" do
    field :source, :string
    field :content, :string
    field :status, :string, default: "proposed"
    field :version, :integer, default: 1
    field :diff, :string
    field :signal_metadata, :map, default: %{}

    belongs_to :previous_rule, __MODULE__, type: :string
    belongs_to :proposal, Ema.Proposals.Proposal, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(proposed active rolled_back)
  @valid_sources ~w(signal correction approval_pattern task_outcome manual)

  def changeset(rule, attrs) do
    rule
    |> cast(attrs, [
      :id,
      :source,
      :content,
      :status,
      :version,
      :diff,
      :signal_metadata,
      :previous_rule_id,
      :proposal_id
    ])
    |> validate_required([:id, :source, :content])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_inclusion(:source, @valid_sources)
    |> validate_number(:version, greater_than: 0)
  end
end
