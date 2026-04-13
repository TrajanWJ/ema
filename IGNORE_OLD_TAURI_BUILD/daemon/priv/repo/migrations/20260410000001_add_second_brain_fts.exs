defmodule Ema.Repo.Migrations.AddSecondBrainFts do
  use Ecto.Migration

  def up do
    # FTS5 virtual table for full-text search over vault notes
    # Stores title, tags (joined), content, and metadata for ranking/snippet generation
    execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS vault_notes_fts USING fts5(
      note_id UNINDEXED,
      title,
      tags,
      file_path UNINDEXED,
      content,
      tokenize = "porter unicode61"
    )
    """)
  end

  def down do
    execute("DROP TABLE IF EXISTS vault_notes_fts")
  end
end
