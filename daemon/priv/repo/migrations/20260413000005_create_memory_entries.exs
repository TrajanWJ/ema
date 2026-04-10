defmodule Ema.Repo.Migrations.CreateMemoryEntries do
  use Ecto.Migration

  @moduledoc """
  Sugar-style typed memory store for EMA agents.

  Creates `memory_entries` plus an FTS5 virtual table and triggers so
  Claude calls can recall typed knowledge (decisions, preferences, file
  context, error patterns, research, outcomes, guidelines) across sessions.
  """

  def change do
    create table(:memory_entries, primary_key: false) do
      add :id, :string, primary_key: true
      add :memory_type, :string, null: false
      add :scope, :string, null: false, default: "project"
      add :actor_id, references(:actors, type: :string, on_delete: :nilify_all)
      add :space_id, references(:spaces, type: :string, on_delete: :nilify_all)
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
      add :source_id, :string
      add :content, :text, null: false
      add :summary, :text
      add :metadata, :map, default: %{}
      add :importance, :float, default: 1.0
      add :access_count, :integer, default: 0
      add :last_accessed_at, :utc_datetime
      add :expires_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:memory_entries, [:memory_type])
    create index(:memory_entries, [:scope, :actor_id])
    create index(:memory_entries, [:scope, :project_id])
    create index(:memory_entries, [:importance])
    create index(:memory_entries, [:expires_at])

    # FTS5 virtual table mirrors content + summary, keyed by rowid
    execute(
      """
      CREATE VIRTUAL TABLE memory_fts USING fts5(
        id UNINDEXED,
        content,
        summary,
        content='memory_entries',
        content_rowid='rowid'
      )
      """,
      "DROP TABLE memory_fts"
    )

    execute(
      """
      CREATE TRIGGER memory_ai AFTER INSERT ON memory_entries BEGIN
        INSERT INTO memory_fts(rowid, id, content, summary)
        VALUES (new.rowid, new.id, new.content, new.summary);
      END
      """,
      "DROP TRIGGER memory_ai"
    )

    execute(
      """
      CREATE TRIGGER memory_ad AFTER DELETE ON memory_entries BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, id, content, summary)
        VALUES ('delete', old.rowid, old.id, old.content, old.summary);
      END
      """,
      "DROP TRIGGER memory_ad"
    )

    execute(
      """
      CREATE TRIGGER memory_au AFTER UPDATE ON memory_entries BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, id, content, summary)
        VALUES ('delete', old.rowid, old.id, old.content, old.summary);
        INSERT INTO memory_fts(rowid, id, content, summary)
        VALUES (new.rowid, new.id, new.content, new.summary);
      END
      """,
      "DROP TRIGGER memory_au"
    )
  end
end
