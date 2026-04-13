defmodule Ema.Repo.Migrations.AddIntentIdToPhaseTransitions do
  use Ecto.Migration

  def change do
    alter table(:phase_transitions) do
      add :intent_id, references(:intents, type: :string, on_delete: :nilify_all)
    end

    create index(:phase_transitions, [:intent_id])
  end
end
