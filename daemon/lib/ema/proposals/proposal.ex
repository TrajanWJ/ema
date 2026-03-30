defmodule Ema.Proposals.Proposal do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "proposals" do
    field :title, :string
    field :summary, :string
    field :body, :string
    field :status, :string, default: "queued"
    field :confidence, :float
    field :risks, {:array, :string}, default: []
    field :benefits, {:array, :string}, default: []
    field :estimated_scope, :string
    field :generation_log, :map, default: %{}
    field :steelman, :string
    field :red_team, :string
    field :synthesis, :string

    belongs_to :project, Ema.Projects.Project, type: :string
    belongs_to :seed, Ema.Proposals.Seed, type: :string
    belongs_to :parent_proposal, __MODULE__, type: :string

    has_many :tags, Ema.Proposals.ProposalTag
    has_many :children, __MODULE__, foreign_key: :parent_proposal_id

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(queued reviewing approved redirected killed)
  @valid_scopes ~w(xs s m l xl)

  def changeset(proposal, attrs) do
    proposal
    |> cast(attrs, [
      :id, :title, :summary, :body, :status, :confidence,
      :risks, :benefits, :estimated_scope, :generation_log,
      :steelman, :red_team, :synthesis,
      :project_id, :seed_id, :parent_proposal_id
    ])
    |> validate_required([:id, :title])
    |> validate_inclusion(:status, @valid_statuses)
    |> maybe_validate_inclusion(:estimated_scope, @valid_scopes)
    |> validate_number(:confidence, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0)
  end

  defp maybe_validate_inclusion(changeset, field, values) do
    case get_change(changeset, field) do
      nil -> changeset
      _ -> validate_inclusion(changeset, field, values)
    end
  end
end
