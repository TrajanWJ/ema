defmodule Ema.Repo.Migrations.CreateMemoryTables do
  use Ecto.Migration

  def change do
    # User-level memory — persistent preferences and patterns for a user
    create table(:memory_user_facts, primary_key: false) do
      add :id, :string, primary_key: true
      add :user_id, :string, null: false, default: "trajan"
      add :key, :string, null: false
      add :value, :text, null: false
      add :category, :string, null: false, default: "general"
      # EMA weight: 0.0 (forgotten) to 1.0 (core belief)
      add :weight, :float, default: 0.5
      # Source: "manual", "inferred", "cross_pollination"
      add :source, :string, default: "manual"
      add :project_slug, :string
      add :metadata, :text

      timestamps(type: :utc_datetime)
    end

    create index(:memory_user_facts, [:user_id])
    create index(:memory_user_facts, [:category])
    create index(:memory_user_facts, [:project_slug])
    create unique_index(:memory_user_facts, [:user_id, :key])

    # Session-level memory — working context for a session
    create table(:memory_session_entries, primary_key: false) do
      add :id, :string, primary_key: true
      add :session_id, :string, null: false
      add :user_id, :string, null: false, default: "trajan"
      add :project_slug, :string
      add :kind, :string, null: false, default: "context"
      add :content, :text, null: false
      add :weight, :float, default: 0.5
      add :metadata, :text

      timestamps(type: :utc_datetime)
    end

    create index(:memory_session_entries, [:session_id])
    create index(:memory_session_entries, [:user_id])
    create index(:memory_session_entries, [:project_slug])

    # Cross-pollination log — tracks learnings moved from one project to another
    create table(:memory_cross_pollinations, primary_key: false) do
      add :id, :string, primary_key: true
      add :source_project_slug, :string, null: false
      add :target_project_slug, :string, null: false
      add :fact_id, :string, null: false
      add :rationale, :text
      add :applied_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:memory_cross_pollinations, [:source_project_slug])
    create index(:memory_cross_pollinations, [:target_project_slug])
    create index(:memory_cross_pollinations, [:fact_id])
  end
end
