defmodule Ema.Repo.Migrations.CreateAgentSessions do
  use Ecto.Migration

  def change do
    create table(:agent_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :execution_id, references(:executions, type: :string, on_delete: :nilify_all)
      add :agent_role, :string, null: false, default: "implementer"
      add :status, :string, null: false, default: "pending"
      add :transcript_ref, :string
      add :prompt_sent, :text
      add :result_summary, :text
      add :started_at, :utc_datetime
      add :ended_at, :utc_datetime
      add :metadata, :map, default: %{}
      timestamps(type: :utc_datetime)
    end

    create index(:agent_sessions, [:execution_id])
    create index(:agent_sessions, [:status])
  end
end
