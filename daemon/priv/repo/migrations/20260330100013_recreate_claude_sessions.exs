defmodule Ema.Repo.Migrations.RecreateClaudeSessions do
  use Ecto.Migration

  def change do
    drop_if_exists index(:claude_sessions, [:status])
    drop_if_exists index(:claude_sessions, [:project_path])
    drop_if_exists table(:claude_sessions)

    create table(:claude_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :session_id, :string
      add :project_path, :string
      add :started_at, :utc_datetime
      add :ended_at, :utc_datetime
      add :last_active, :utc_datetime
      add :status, :string, default: "active"
      add :token_count, :integer
      add :tool_calls, :integer
      add :files_touched, :text, default: "[]"
      add :summary, :text
      add :raw_path, :string
      add :metadata, :text, default: "{}"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:claude_sessions, [:status])
    create index(:claude_sessions, [:project_path])
    create index(:claude_sessions, [:project_id])
    create index(:claude_sessions, [:session_id])
  end
end
