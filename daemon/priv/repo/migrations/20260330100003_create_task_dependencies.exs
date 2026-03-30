defmodule Ema.Repo.Migrations.CreateTaskDependencies do
  use Ecto.Migration

  def change do
    create table(:task_dependencies, primary_key: false) do
      add :task_id, references(:tasks, type: :string, on_delete: :delete_all), null: false
      add :dependency_id, references(:tasks, type: :string, on_delete: :delete_all), null: false
    end

    create unique_index(:task_dependencies, [:task_id, :dependency_id])
    create index(:task_dependencies, [:dependency_id])
  end
end
