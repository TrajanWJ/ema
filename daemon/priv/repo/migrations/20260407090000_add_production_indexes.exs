defmodule Ema.Repo.Migrations.AddProductionIndexes do
  use Ecto.Migration

  def change do
    create_if_not_exists index(:executions, [:task_id])
    create_if_not_exists index(:tasks, [:status, :due_date])
    create_if_not_exists index(:proposals, [:status, :inserted_at])
    create_if_not_exists index(:executions, [:status, :completed_at])
  end
end
