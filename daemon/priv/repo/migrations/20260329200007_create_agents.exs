defmodule Ema.Repo.Migrations.CreateAgents do
  use Ecto.Migration

  def change do
    create table(:agent_templates, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :command, :string, null: false
      add :description, :text
      add :icon, :string

      timestamps(type: :utc_datetime)
    end

    create table(:agent_runs, primary_key: false) do
      add :id, :string, primary_key: true
      add :project_path, :string
      add :status, :string, default: "pending"
      add :started_at, :utc_datetime
      add :output_path, :string
      add :exit_code, :integer
      add :template_id, references(:agent_templates, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:agent_runs, [:template_id])
    create index(:agent_runs, [:status])
  end
end
