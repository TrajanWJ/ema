defmodule Ema.Repo.Migrations.AddActorIdToCoreTables do
  use Ecto.Migration

  def change do
    # Add actor_id to tasks (nullable — zero breakage)
    alter table(:tasks) do
      add :actor_id, references(:actors, type: :string, on_delete: :nilify_all)
    end

    # Add actor_id to goals
    alter table(:goals) do
      add :actor_id, references(:actors, type: :string, on_delete: :nilify_all)
    end

    # Add actor_id to executions
    execute(
      "ALTER TABLE executions ADD COLUMN actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL",
      "SELECT 1"
    )

    # Add actor_id to proposals
    execute(
      "ALTER TABLE proposals ADD COLUMN actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL",
      "SELECT 1"
    )

    # Add container scoping to inbox_items (brain dump)
    alter table(:inbox_items) do
      add :container_type, :string
      add :container_id, :string
    end

    create index(:tasks, [:actor_id])
    create index(:goals, [:actor_id])
    create index(:inbox_items, [:container_type, :container_id])
  end
end
