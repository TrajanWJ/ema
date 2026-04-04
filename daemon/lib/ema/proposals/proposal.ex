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
    field :embedding, :binary
    field :idea_score, :float
    field :prompt_quality_score, :float
    field :score_breakdown, :map, default: %{}
    field :source_fingerprint, :string

    # Batch 3: Pipeline fields
    field :quality_score, :float
    field :pipeline_stage, :string
    field :pipeline_iteration, :integer, default: 1
    field :cost_display, :string

    belongs_to :project, Ema.Projects.Project, type: :string
    belongs_to :seed, Ema.Proposals.Seed, type: :string
    # Genealogy fields
    field :generation, :integer, default: 0
    field :genealogy_path, :string
    field :validation_score, :float
    field :validation_gates_passed, :string
    field :validation_gates_failed, :string

    belongs_to :parent_proposal, __MODULE__, type: :string

    has_many :tags, Ema.Proposals.ProposalTag
    has_many :children, __MODULE__, foreign_key: :parent_proposal_id

    timestamps(type: :utc_datetime)
  end

  # Added "generating" and "failed" for Batch 3 orchestrator pipeline
  @valid_statuses ~w(queued reviewing approved redirected killed generating failed)
  @valid_scopes ~w(xs s m l xl)

  def changeset(proposal, attrs) do
    proposal
    |> cast(attrs, [
      :id,
      :title,
      :summary,
      :body,
      :status,
      :confidence,
      :risks,
      :benefits,
      :estimated_scope,
      :generation_log,
      :steelman,
      :red_team,
      :synthesis,
      :embedding,
      :idea_score,
      :prompt_quality_score,
      :score_breakdown,
      :source_fingerprint,
      # Batch 3 fields
      :quality_score,
      :pipeline_stage,
      :pipeline_iteration,
      :cost_display,
      :project_id,
      :seed_id,
      :parent_proposal_id,
      # Genealogy fields
      :generation,
      :genealogy_path,
      :validation_score,
      :validation_gates_passed,
      :validation_gates_failed
    ])
    |> validate_required([:id, :title])
    |> validate_inclusion(:status, @valid_statuses)
    |> maybe_validate_inclusion(:estimated_scope, @valid_scopes)
    |> validate_number(:confidence,
      greater_than_or_equal_to: 0.0,
      less_than_or_equal_to: 1.0
    )
    |> maybe_validate_number(:quality_score,
      greater_than_or_equal_to: 0.0,
      less_than_or_equal_to: 1.0
    )
    |> maybe_validate_number(:pipeline_iteration, greater_than_or_equal_to: 1)
    |> unique_constraint(:source_fingerprint)
  end

  defp maybe_validate_inclusion(changeset, field, values) do
    case get_change(changeset, field) do
      nil -> changeset
      _ -> validate_inclusion(changeset, field, values)
    end
  end

  defp maybe_validate_number(changeset, field, opts) do
    case get_change(changeset, field) do
      nil -> changeset
      _ -> validate_number(changeset, field, opts)
    end
  end
end
