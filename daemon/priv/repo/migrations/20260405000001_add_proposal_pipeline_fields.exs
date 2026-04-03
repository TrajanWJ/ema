defmodule Ema.Repo.Migrations.AddProposalPipelineFields do
  @moduledoc """
  Adds fields required by the Proposal Orchestrator pipeline (Batch 3).

  New fields on proposals table:
    - `quality_score`    (float) — QualityGate score, 0.0-1.0
    - `pipeline_stage`   (string) — Current pipeline stage for in-progress proposals
    - `pipeline_iteration` (int)  — Which iteration (1-3) the pipeline is on
    - `cost_display`     (string) — Formatted cost string like "$0.08 (4 stages, 2 iter)"
    - Extended `status`  to include "generating" and "failed"

  These fields enable:
    - Quality gate pass/warning/fail visibility in the UI
    - Cost tracking per-proposal
    - Pipeline progress tracking in ProposalCard and ProposalDetail
  """

  use Ecto.Migration

  def change do
    # SQLite doesn't support add_if_not_exists in ALTER TABLE.
    # Use raw SQL with IF NOT EXISTS pattern via execute.
    execute(
      "ALTER TABLE proposals ADD COLUMN quality_score REAL",
      "SELECT 1"
    )

    execute(
      "ALTER TABLE proposals ADD COLUMN pipeline_stage TEXT",
      "SELECT 1"
    )

    execute(
      "ALTER TABLE proposals ADD COLUMN pipeline_iteration INTEGER DEFAULT 1",
      "SELECT 1"
    )

    execute(
      "ALTER TABLE proposals ADD COLUMN cost_display TEXT",
      "SELECT 1"
    )

    create_if_not_exists index(:proposals, [:status])
    create_if_not_exists index(:proposals, [:pipeline_stage])
  end
end
