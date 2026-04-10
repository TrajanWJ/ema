defmodule Ema.Repo.Migrations.CreateSchematicEngine do
  use Ecto.Migration

  def change do
    # ── schematic_feed_items: clarifications + hard answers ─────────
    create table(:schematic_feed_items, primary_key: false) do
      add :id, :string, primary_key: true
      add :feed_type, :string, null: false
      add :scope_path, :string
      add :target_intent_id, references(:intents, type: :string, on_delete: :nilify_all)
      add :title, :string
      add :context, :text
      add :options, :map, default: %{}
      add :status, :string, default: "open"
      add :selected, {:array, :string}, default: []
      add :user_response, :text
      add :chat_session_id, :string
      add :resolution, :text
      add :resolved_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:schematic_feed_items, [:feed_type, :status])
    create index(:schematic_feed_items, [:target_intent_id])

    # ── schematic_contradictions: detected conflicts queue ──────────
    create table(:schematic_contradictions, primary_key: false) do
      add :id, :string, primary_key: true
      add :scope_path, :string
      add :intent_a_id, references(:intents, type: :string, on_delete: :delete_all), null: false
      add :intent_b_id, references(:intents, type: :string, on_delete: :nilify_all)
      add :description, :text, null: false
      add :severity, :string, default: "medium"
      add :detected_by, :string
      add :status, :string, default: "open"
      add :resolution_notes, :text
      add :resolved_at, :utc_datetime
      add :resolution_actor, :string

      timestamps(type: :utc_datetime)
    end

    create index(:schematic_contradictions, [:status, :scope_path])

    # ── schematic_aspirations: idealistic goals stack ───────────────
    create table(:schematic_aspirations, primary_key: false) do
      add :id, :string, primary_key: true
      add :scope_path, :string
      add :title, :string, null: false
      add :description, :text
      add :horizon, :string, default: "long"
      add :status, :string, default: "stacked"
      add :promoted_intent_id, references(:intents, type: :string, on_delete: :nilify_all)
      add :weight, :integer, default: 0
      add :tags, {:array, :string}, default: []

      timestamps(type: :utc_datetime)
    end

    create index(:schematic_aspirations, [:scope_path, :status])

    # ── schematic_modification_state: per-scope toggle ──────────────
    create table(:schematic_modification_state, primary_key: false) do
      add :id, :string, primary_key: true
      add :scope_path, :string
      add :enabled, :boolean, default: true
      add :disabled_reason, :text
      add :disabled_until, :utc_datetime
      add :updated_by, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:schematic_modification_state, [:scope_path])

    # ── schematic_update_log: NL update history ─────────────────────
    create table(:schematic_update_log, primary_key: false) do
      add :id, :string, primary_key: true
      add :scope_path, :string
      add :input_text, :text, null: false
      add :parsed_mutations, :map, default: %{}
      add :applied, :boolean, default: false
      add :affected_intent_ids, {:array, :string}, default: []
      add :contradictions_raised, {:array, :string}, default: []
      add :clarifications_raised, {:array, :string}, default: []
      add :actor_id, :string
      add :error, :text

      timestamps(type: :utc_datetime)
    end

    create index(:schematic_update_log, [:scope_path, :inserted_at])
  end
end
