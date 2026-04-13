defmodule Ema.Repo.Migrations.RecreateTasks do
  use Ecto.Migration

  def change do
    drop_if_exists index(:tasks, [:status])
    drop_if_exists index(:tasks, [:goal_id])
    drop_if_exists index(:tasks, [:due_date])
    drop_if_exists table(:tasks)

    create table(:tasks, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :status, :string, default: "proposed"
      add :priority, :integer, default: 3
      add :source_type, :string
      add :source_id, :string
      add :effort, :string
      add :due_date, :date
      add :recurrence, :string
      add :sort_order, :integer
      add :completed_at, :utc_datetime
      add :metadata, :text, default: "{}"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
      add :goal_id, references(:goals, type: :string, on_delete: :nilify_all)
      add :responsibility_id, :string
      add :parent_id, :string

      timestamps(type: :utc_datetime)
    end

    create index(:tasks, [:status])
    create index(:tasks, [:project_id])
    create index(:tasks, [:goal_id])
    create index(:tasks, [:parent_id])
    create index(:tasks, [:due_date])
    create index(:tasks, [:responsibility_id])
  end
end
