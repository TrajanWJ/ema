defmodule Ema.Repo.Migrations.CreateTasks do
  use Ecto.Migration

  def change do
    create table(:tasks, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :status, :string, default: "todo"
      add :priority, :integer
      add :due_date, :string
      add :goal_id, references(:goals, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:tasks, [:status])
    create index(:tasks, [:goal_id])
    create index(:tasks, [:due_date])
  end
end
