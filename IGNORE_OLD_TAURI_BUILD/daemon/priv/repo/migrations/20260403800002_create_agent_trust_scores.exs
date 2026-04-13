defmodule Ema.Repo.Migrations.CreateAgentTrustScores do
  use Ecto.Migration

  def change do
    create table(:agent_trust_scores, primary_key: false) do
      add :id, :string, primary_key: true
      add :agent_id, references(:agents, type: :string, on_delete: :delete_all), null: false
      add :score, :integer, null: false, default: 50
      add :completion_rate, :float, default: 0.0
      add :avg_latency_ms, :integer, default: 0
      add :error_count, :integer, default: 0
      add :session_count, :integer, default: 0
      add :days_active, :integer, default: 0
      add :calculated_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:agent_trust_scores, [:agent_id])
    create index(:agent_trust_scores, [:calculated_at])
  end
end
