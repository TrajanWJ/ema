defmodule Ema.Repo.Migrations.CreateHarvestedSessionsAndIntents do
  use Ecto.Migration

  def change do
    create table(:harvested_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :session_id, :string
      add :source_type, :string, null: false
      add :raw_path, :string, null: false
      add :project_path, :string
      add :model, :string
      add :model_provider, :string
      add :started_at, :utc_datetime
      add :ended_at, :utc_datetime
      add :status, :string, default: "pending"
      add :quality_score, :float
      add :message_count, :integer, default: 0
      add :tool_call_count, :integer, default: 0
      add :token_count, :integer, default: 0
      add :files_touched, :text, default: "[]"
      add :source_fingerprint, :string
      add :metadata, :text, default: "{}"
      add :claude_session_id, :string
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:harvested_sessions, [:source_fingerprint])
    create index(:harvested_sessions, [:session_id])
    create index(:harvested_sessions, [:source_type])
    create index(:harvested_sessions, [:status])
    create index(:harvested_sessions, [:project_id])
    create index(:harvested_sessions, [:project_path])

    create table(:harvested_intents, primary_key: false) do
      add :id, :string, primary_key: true
      add :content, :text, null: false
      add :intent_type, :string
      add :source_type, :string, null: false
      add :source_fingerprint, :string
      add :quality_score, :float, default: 0.0
      add :loaded, :boolean, default: false
      add :brain_dump_item_id, :string
      add :metadata, :text, default: "{}"
      add :harvested_session_id, references(:harvested_sessions, type: :string, on_delete: :nothing)
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:harvested_intents, [:source_fingerprint])
    create index(:harvested_intents, [:intent_type])
    create index(:harvested_intents, [:source_type])
    create index(:harvested_intents, [:loaded])
    create index(:harvested_intents, [:harvested_session_id])
    create index(:harvested_intents, [:project_id])
  end
end
