defmodule Ema.Repo.Migrations.AddSpaceIdToCoreTablesMig do
  use Ecto.Migration

  def change do
    alter table(:projects) do
      add :space_id, references(:spaces, type: :string, on_delete: :nilify_all), null: true
    end

    alter table(:tasks) do
      add :space_id, references(:spaces, type: :string, on_delete: :nilify_all), null: true
    end

    # Only add to proposals/executions if those tables exist
    # (they may be in a later migration — safe to add here if present)
    execute(
      """
      ALTER TABLE proposals ADD COLUMN space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL
      """,
      "SELECT 1"
    )

    execute(
      """
      ALTER TABLE executions ADD COLUMN space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL
      """,
      "SELECT 1"
    )

    create index(:projects, [:space_id])
    create index(:tasks, [:space_id])
  end
end
