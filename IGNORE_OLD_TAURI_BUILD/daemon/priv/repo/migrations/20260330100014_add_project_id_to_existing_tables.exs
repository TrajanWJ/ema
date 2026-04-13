defmodule Ema.Repo.Migrations.AddProjectIdToExistingTables do
  use Ecto.Migration

  def change do
    alter table(:inbox_items) do
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
    end

    alter table(:goals) do
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
    end

    create index(:inbox_items, [:project_id])
    create index(:goals, [:project_id])
  end
end
