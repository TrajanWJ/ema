defmodule Ema.Repo.Migrations.CreateClaudeAuditLogs do
  use Ecto.Migration

  def change do
    create table(:claude_audit_logs) do
      add :session_id, :string, null: false
      add :tool_name, :string, null: false
      add :target, :string
      add :timestamp, :naive_datetime, null: false
    end

    create index(:claude_audit_logs, [:session_id])
    create index(:claude_audit_logs, [:tool_name])
    create index(:claude_audit_logs, [:timestamp])
  end
end
