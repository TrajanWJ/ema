defmodule Ema.Repo.Migrations.CreatePipes do
  use Ecto.Migration

  def change do
    create table(:pipes, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :system, :boolean, default: false
      add :active, :boolean, default: true
      add :trigger_pattern, :string
      add :description, :text
      add :metadata, :text, default: "{}"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:pipes, [:project_id])
    create index(:pipes, [:active])

    create table(:pipe_actions, primary_key: false) do
      add :id, :string, primary_key: true
      add :action_id, :string, null: false
      add :config, :text, default: "{}"
      add :sort_order, :integer, default: 0
      add :pipe_id, references(:pipes, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:pipe_actions, [:pipe_id])

    create table(:pipe_transforms, primary_key: false) do
      add :id, :string, primary_key: true
      add :transform_type, :string, null: false
      add :config, :text, default: "{}"
      add :sort_order, :integer, default: 0
      add :pipe_id, references(:pipes, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:pipe_transforms, [:pipe_id])

    create table(:pipe_runs, primary_key: false) do
      add :id, :string, primary_key: true
      add :trigger_event, :text, default: "{}"
      add :status, :string
      add :started_at, :utc_datetime
      add :completed_at, :utc_datetime
      add :error, :text
      add :pipe_id, references(:pipes, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:pipe_runs, [:pipe_id])
    create index(:pipe_runs, [:status])
  end
end
