defmodule Ema.Repo.Migrations.CreateIntentClusters do
  use Ecto.Migration

  def change do
    create table(:intent_clusters, primary_key: false) do
      add :id, :string, primary_key: true
      add :label, :string, null: false
      add :description, :string
      add :readiness_score, :float, default: 0.0
      add :item_count, :integer, default: 0
      add :promoted, :boolean, default: false
      add :seed_id, :string
      add :status, :string, default: "forming"
      add :project_id, :string, references(:projects, type: :string, on_delete: :nothing)
      add :space_id, :string, references(:spaces, type: :string, on_delete: :nothing)
      add :intent_node_id, :string, references(:intent_nodes, type: :string, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create index(:intent_clusters, [:project_id])
    create index(:intent_clusters, [:status])
  end
end
