defmodule Ema.Repo.Migrations.CreateClaudeFailureEvents do
  use Ecto.Migration

  def change do
    create table(:claude_failure_events) do
      add :class, :string, null: false
      add :code, :string, null: false
      add :domain, :string, null: false
      add :component, :string, null: false
      add :operation, :string, null: false
      add :stage, :string
      add :retryable, :boolean, default: false, null: false
      add :fingerprint, :string
      add :raw_reason, :text
      add :metadata, :map, default: %{}
      add :artifact_id, :string
      add :artifact_type, :string
      add :recorded_at, :utc_datetime, null: false
    end

    create index(:claude_failure_events, [:class])
    create index(:claude_failure_events, [:fingerprint, :recorded_at])
    create index(:claude_failure_events, [:recorded_at])
    create index(:claude_failure_events, [:domain])
    create index(:claude_failure_events, [:artifact_type, :artifact_id])
  end
end
