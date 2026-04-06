defmodule Ema.Repo.Migrations.FixPhaseTransitionColumns do
  use Ecto.Migration

  def change do
    # Columns already exist in the live DB — this migration is a no-op marker.
    # Original intent: add space_id, project_id, week_number, summary, transitioned_at
    # to phase_transitions table. Already applied via earlier migration or manual alter.
    create_if_not_exists index(:phase_transitions, [:space_id])
    create_if_not_exists index(:phase_transitions, [:project_id])
  end
end
