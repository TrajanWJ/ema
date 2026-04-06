defmodule Ema.Repo.Migrations.CreateIntentNodes do
  use Ecto.Migration

  def change do
    create table(:intent_nodes, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :level, :integer, null: false, default: 0
      add :parent_id, references(:intent_nodes, type: :string, on_delete: :nilify_all)
      add :status, :string, null: false, default: "planned"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
      add :linked_task_ids, :text, default: "[]"
      add :linked_wiki_path, :string

      timestamps(type: :utc_datetime)
    end

    create index(:intent_nodes, [:parent_id])
    create index(:intent_nodes, [:project_id])
    create index(:intent_nodes, [:level])
    create index(:intent_nodes, [:status])

    create table(:intent_edges, primary_key: false) do
      add :id, :string, primary_key: true

      add :source_id, references(:intent_nodes, type: :string, on_delete: :delete_all),
        null: false

      add :target_id, references(:intent_nodes, type: :string, on_delete: :delete_all),
        null: false

      add :edge_type, :string, default: "hierarchy"

      timestamps(type: :utc_datetime)
    end

    create index(:intent_edges, [:source_id])
    create index(:intent_edges, [:target_id])
  end
end
