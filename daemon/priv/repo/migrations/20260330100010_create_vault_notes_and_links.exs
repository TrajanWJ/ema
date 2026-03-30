defmodule Ema.Repo.Migrations.CreateVaultNotesAndLinks do
  use Ecto.Migration

  def change do
    create table(:vault_notes, primary_key: false) do
      add :id, :string, primary_key: true
      add :file_path, :string, null: false
      add :title, :string
      add :space, :string
      add :content_hash, :string
      add :source_type, :string
      add :source_id, :string
      add :tags, :text, default: "[]"
      add :word_count, :integer
      add :metadata, :text, default: "{}"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:vault_notes, [:file_path])
    create index(:vault_notes, [:project_id])
    create index(:vault_notes, [:space])

    create table(:vault_links, primary_key: false) do
      add :id, :string, primary_key: true
      add :link_text, :string, null: false
      add :link_type, :string
      add :context, :text
      add :source_note_id, references(:vault_notes, type: :string, on_delete: :delete_all), null: false
      add :target_note_id, references(:vault_notes, type: :string, on_delete: :delete_all)

      timestamps(type: :utc_datetime)
    end

    create index(:vault_links, [:source_note_id])
    create index(:vault_links, [:target_note_id])
  end
end
