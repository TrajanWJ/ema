defmodule Ema.Repo.Migrations.CreateAuditLogs do
  use Ecto.Migration

  def change do
    create table(:audit_logs, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :action, :string, null: false
      add :actor, :string, null: false
      add :resource, :string
      add :details, :map

      timestamps()
    end

    create index(:audit_logs, [:actor])
    create index(:audit_logs, [:action])
    create index(:audit_logs, [:inserted_at])
  end
end
