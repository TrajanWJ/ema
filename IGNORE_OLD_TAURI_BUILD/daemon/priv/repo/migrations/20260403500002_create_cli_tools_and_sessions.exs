defmodule Ema.Repo.Migrations.CreateCliToolsAndSessions do
  use Ecto.Migration

  def change do
    create table(:cli_tools, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :binary_path, :string, null: false
      add :version, :string
      add :capabilities, :text, default: "[]"
      add :session_dir, :string
      add :detected_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:cli_tools, [:name])

    create table(:cli_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :cli_tool_id, references(:cli_tools, type: :string, on_delete: :nilify_all)
      add :project_path, :string
      add :status, :string, default: "running"
      add :pid, :integer
      add :prompt, :text
      add :started_at, :utc_datetime
      add :ended_at, :utc_datetime
      add :linked_task_id, :string
      add :linked_proposal_id, :string
      add :output_summary, :text
      add :exit_code, :integer

      timestamps(type: :utc_datetime)
    end

    create index(:cli_sessions, [:cli_tool_id])
    create index(:cli_sessions, [:status])
    create index(:cli_sessions, [:linked_task_id])
    create index(:cli_sessions, [:linked_proposal_id])
  end
end
