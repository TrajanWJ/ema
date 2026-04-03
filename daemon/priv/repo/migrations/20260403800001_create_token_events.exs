defmodule Ema.Repo.Migrations.CreateTokenEvents do
  use Ecto.Migration

  def change do
    create table(:token_events, primary_key: false) do
      add :id, :string, primary_key: true
      add :session_id, :string
      add :agent_id, :string
      add :model, :string, null: false
      add :input_tokens, :integer, null: false, default: 0
      add :output_tokens, :integer, null: false, default: 0
      add :cost_usd, :float, null: false, default: 0.0
      add :source, :string, default: "unknown"

      timestamps(type: :utc_datetime)
    end

    create index(:token_events, [:session_id])
    create index(:token_events, [:agent_id])
    create index(:token_events, [:model])
    create index(:token_events, [:inserted_at])

    create table(:token_budgets, primary_key: false) do
      add :id, :string, primary_key: true
      add :monthly_budget_usd, :float, null: false, default: 100.0
      add :alert_threshold_pct, :integer, null: false, default: 80

      timestamps(type: :utc_datetime)
    end
  end
end
