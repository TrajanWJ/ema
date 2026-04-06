defmodule Ema.Repo.Migrations.CreatePhaseTransitions do
  use Ecto.Migration

  def change do
    create table(:phase_transitions, primary_key: false) do
      add :id, :string, primary_key: true
      add :actor_id, references(:actors, type: :string, on_delete: :delete_all), null: false
      add :from_phase, :string
      add :to_phase, :string, null: false
      add :reason, :string
      add :metadata, :map, default: %{}

      add :inserted_at, :utc_datetime, null: false
    end

    create index(:phase_transitions, [:actor_id])
    create index(:phase_transitions, [:inserted_at])
  end
end
