defmodule Ema.Repo.Migrations.CreateExternalVaultSyncEntries do
  use Ecto.Migration

  def change do
    create table(:external_vault_sync_entries, primary_key: false) do
      add :id, :string, primary_key: true
      add :integration, :string, null: false
      add :intent_node_id, :string, null: false
      add :source_host, :string, null: false
      add :source_root, :string, null: false
      add :relative_path, :string, null: false
      add :source_checksum, :string
      add :source_mtime, :utc_datetime
      add :last_seen_at, :utc_datetime
      add :last_synced_at, :utc_datetime
      add :status, :string, null: false, default: "pending"
      add :last_error, :text
      add :vault_note_id, references(:vault_notes, type: :string, on_delete: :nilify_all)
      add :missing_count, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create unique_index(
             :external_vault_sync_entries,
             [:integration, :intent_node_id, :source_host, :source_root, :relative_path],
             name: :external_vault_sync_entries_unique_path
           )

    create index(:external_vault_sync_entries, [:integration, :intent_node_id])
    create index(:external_vault_sync_entries, [:status])
    create index(:external_vault_sync_entries, [:vault_note_id])
  end
end
