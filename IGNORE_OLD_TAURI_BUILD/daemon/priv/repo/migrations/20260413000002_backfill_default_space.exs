defmodule Ema.Repo.Migrations.BackfillDefaultSpace do
  use Ecto.Migration

  def up do
    now = DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

    # Create default personal space
    execute("""
    INSERT OR IGNORE INTO spaces (id, name, space_type, ai_privacy, portable, settings, inserted_at, updated_at)
    VALUES ('sp_default', 'Personal', 'personal', 'isolated', 0, '{}', '#{now}', '#{now}')
    """)

    # Create default human actor
    execute("""
    INSERT OR IGNORE INTO actors (id, space_id, type, name, slug, capabilities, config, phase, status, inserted_at, updated_at)
    VALUES ('human', 'sp_default', 'human', 'Trajan', 'trajan', '[]', '{}', 'idle', 'active', '#{now}', '#{now}')
    """)

    # Backfill space_id on entities that don't have one
    execute("UPDATE projects SET space_id = 'sp_default' WHERE space_id IS NULL")
    execute("UPDATE tasks SET space_id = 'sp_default' WHERE space_id IS NULL")
    execute("UPDATE goals SET space_id = 'sp_default' WHERE space_id IS NULL")
    execute("UPDATE executions SET space_id = 'sp_default' WHERE space_id IS NULL")
    execute("UPDATE proposals SET space_id = 'sp_default' WHERE space_id IS NULL")

    # Backfill actor_id
    execute("UPDATE tasks SET actor_id = 'human' WHERE actor_id IS NULL")
    execute("UPDATE executions SET actor_id = 'human' WHERE actor_id IS NULL")

    # Backfill brain dump containers
    execute("""
    UPDATE inbox_items SET container_type = 'project', container_id = project_id
    WHERE project_id IS NOT NULL AND container_type IS NULL
    """)

    execute("""
    UPDATE inbox_items SET container_type = 'space', container_id = 'sp_default'
    WHERE container_type IS NULL
    """)
  end

  def down do
    execute("UPDATE projects SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("UPDATE tasks SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("UPDATE goals SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("UPDATE executions SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("UPDATE proposals SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("DELETE FROM actors WHERE id = 'human'")
    execute("DELETE FROM spaces WHERE id = 'sp_default'")
  end
end
