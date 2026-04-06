defmodule Ema.Repo.Migrations.CreateWikiKnowledgeTables do
  use Ecto.Migration

  def change do
    create table(:wiki_sources, primary_key: false) do
      add :id, :string, primary_key: true
      add :path, :string, null: false
      add :title, :string, null: false
      add :source_type, :string, null: false, default: "markdown"
      add :space_key, :string
      add :project_key, :string
      add :checksum, :string
      add :metadata, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create unique_index(:wiki_sources, [:path])
    create index(:wiki_sources, [:project_key])
    create index(:wiki_sources, [:space_key])

    create table(:wiki_sections, primary_key: false) do
      add :id, :string, primary_key: true
      add :source_id, references(:wiki_sources, type: :string, on_delete: :delete_all),
        null: false
      add :heading, :string
      add :section_key, :string, null: false
      add :ordinal, :integer, null: false, default: 0
      add :content, :text

      timestamps(type: :utc_datetime)
    end

    create index(:wiki_sections, [:source_id])
    create unique_index(:wiki_sections, [:source_id, :section_key])

    create table(:knowledge_items, primary_key: false) do
      add :id, :string, primary_key: true
      add :kind, :string, null: false
      add :text, :text, null: false
      add :normalized_key, :string
      add :confidence, :float, default: 0.5
      add :status, :string, null: false, default: "active"

      add :source_section_id,
          references(:wiki_sections, type: :string, on_delete: :nilify_all)

      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:knowledge_items, [:kind])
    create index(:knowledge_items, [:status])
    create index(:knowledge_items, [:project_id])
    create index(:knowledge_items, [:source_section_id])
    create index(:knowledge_items, [:normalized_key])

    create table(:knowledge_edges, primary_key: false) do
      add :id, :string, primary_key: true
      add :from_kind, :string, null: false
      add :from_id, :string, null: false
      add :to_kind, :string, null: false
      add :to_id, :string, null: false
      add :edge_type, :string, null: false
      add :metadata, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create index(:knowledge_edges, [:from_kind, :from_id])
    create index(:knowledge_edges, [:to_kind, :to_id])
    create index(:knowledge_edges, [:edge_type])
  end
end
