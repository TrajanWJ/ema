defmodule Ema.Repo.Migrations.CreateIntentsEngine do
  use Ecto.Migration

  def change do
    # ── Canonical: intents ──────────────────────────────────────────
    create_if_not_exists table(:intents, primary_key: false) do
      # Durable identity
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :slug, :string, null: false
      add :description, :text
      add :level, :integer, null: false, default: 4
      add :kind, :string, null: false, default: "task"
      add :parent_id, references(:intents, type: :string, on_delete: :nilify_all)
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
      add :source_fingerprint, :string
      add :source_type, :string, null: false, default: "manual"

      # Mutable state
      add :status, :string, null: false, default: "planned"
      add :phase, :integer, default: 1
      add :completion_pct, :integer, default: 0
      add :clarity, :float, default: 0.0
      add :energy, :float, default: 0.0
      add :priority, :integer, default: 3
      add :confidence, :float, default: 1.0
      add :provenance_class, :string, default: "high"
      add :confirmed_at, :utc_datetime
      add :tags, :text
      add :metadata, :text

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists unique_index(:intents, [:slug])

    create_if_not_exists unique_index(:intents, [:source_fingerprint],
                           where: "source_fingerprint IS NOT NULL"
                         )

    create_if_not_exists index(:intents, [:parent_id])
    create_if_not_exists index(:intents, [:project_id])
    create_if_not_exists index(:intents, [:level])
    create_if_not_exists index(:intents, [:status])
    create_if_not_exists index(:intents, [:kind])
    create_if_not_exists index(:intents, [:priority])
    create_if_not_exists index(:intents, [:source_type])

    # ── Canonical: intent_links (semantic ↔ operational bridge) ────
    create_if_not_exists table(:intent_links, primary_key: false) do
      add :id, :string, primary_key: true
      add :intent_id, references(:intents, type: :string, on_delete: :delete_all), null: false
      add :linkable_type, :string, null: false
      add :linkable_id, :string, null: false
      add :role, :string, null: false, default: "related"
      add :provenance, :string, default: "manual"

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:intent_links, [:intent_id])
    create_if_not_exists index(:intent_links, [:linkable_type, :linkable_id])

    create_if_not_exists unique_index(:intent_links, [:intent_id, :linkable_type, :linkable_id],
                           name: :intent_links_unique_triple
                         )

    # ── Canonical: intent_events (lineage spine) ──────────────────
    create_if_not_exists table(:intent_events, primary_key: false) do
      add :id, :string, primary_key: true
      add :intent_id, references(:intents, type: :string, on_delete: :delete_all), null: false
      add :event_type, :string, null: false
      add :payload, :text
      add :actor, :string, null: false, default: "system"

      add :inserted_at, :utc_datetime, null: false
    end

    create_if_not_exists index(:intent_events, [:intent_id])
    create_if_not_exists index(:intent_events, [:event_type])
    create_if_not_exists index(:intent_events, [:inserted_at])
  end
end
