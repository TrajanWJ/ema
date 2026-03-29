defmodule Ema.Repo.Migrations.CreateClaudeSessions do
  use Ecto.Migration

  def change do
    create table(:claude_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :project_path, :string
      add :started_at, :utc_datetime
      add :last_active, :utc_datetime
      add :summary, :text
      add :token_count, :integer
      add :status, :string, default: "active"

      timestamps(type: :utc_datetime)
    end

    create index(:claude_sessions, [:status])
    create index(:claude_sessions, [:project_path])
  end
end
