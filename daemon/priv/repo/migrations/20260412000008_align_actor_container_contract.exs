defmodule Ema.Repo.Migrations.AlignActorContainerContract do
  use Ecto.Migration

  def up do
    rebuild_spaces_with_portable_and_nullable_org()

    alter table(:goals) do
      add :space_id, references(:spaces, type: :string, on_delete: :nilify_all)
    end

    alter table(:inbox_items) do
      add :actor_id, references(:actors, type: :string, on_delete: :nilify_all)
    end

    create index(:goals, [:space_id])
    create index(:inbox_items, [:actor_id])

    execute("DROP TABLE IF EXISTS entity_tags")
    execute("DROP TABLE IF EXISTS tags")
    execute("DROP TABLE IF EXISTS entity_data")
    execute("DROP TABLE IF EXISTS container_config")
    execute("DROP TABLE IF EXISTS phase_transitions")
    execute("DROP TABLE IF EXISTS actor_commands")

    execute("""
    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      namespace TEXT DEFAULT 'default',
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(entity_type, entity_id, tag, actor_id)
    )
    """)

    execute("CREATE INDEX tags_entity_type_entity_id_index ON tags (entity_type, entity_id)")
    execute("CREATE INDEX tags_actor_id_index ON tags (actor_id)")

    execute("""
    CREATE TABLE entity_data (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT NOT NULL,
      inserted_at TEXT NOT NULL,
      PRIMARY KEY (entity_type, entity_id, actor_id, key)
    )
    """)

    execute("CREATE INDEX entity_data_actor_id_index ON entity_data (actor_id)")

    execute("""
    CREATE TABLE container_config (
      container_type TEXT NOT NULL,
      container_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT NOT NULL,
      inserted_at TEXT NOT NULL,
      PRIMARY KEY (container_type, container_id, key)
    )
    """)

    execute("""
    CREATE TABLE phase_transitions (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      from_phase TEXT,
      to_phase TEXT NOT NULL,
      week_number INTEGER,
      reason TEXT,
      summary TEXT,
      metadata TEXT DEFAULT '{}',
      transitioned_at TEXT NOT NULL
    )
    """)

    execute("CREATE INDEX phase_transitions_actor_id_index ON phase_transitions (actor_id)")
    execute("CREATE INDEX phase_transitions_week_number_index ON phase_transitions (week_number)")

    execute("""
    CREATE TABLE actor_commands (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      command TEXT NOT NULL,
      description TEXT,
      handler TEXT NOT NULL,
      args_schema TEXT DEFAULT '{}',
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(actor_id, command)
    )
    """)
  end

  def down do
    raise "irreversible"
  end

  defp rebuild_spaces_with_portable_and_nullable_org do
    execute("PRAGMA foreign_keys=OFF")

    execute("""
    CREATE TABLE spaces_new (
      id TEXT PRIMARY KEY,
      org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      space_type TEXT DEFAULT 'personal' NOT NULL,
      ai_privacy TEXT DEFAULT 'isolated' NOT NULL,
      icon TEXT,
      color TEXT,
      settings TEXT DEFAULT '{}',
      archived_at TEXT,
      portable INTEGER DEFAULT 0 NOT NULL,
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
    """)

    execute("""
    INSERT INTO spaces_new (
      id, org_id, name, space_type, ai_privacy, icon, color, settings,
      archived_at, portable, inserted_at, updated_at
    )
    SELECT
      id, org_id, name, space_type, ai_privacy, icon, color, settings,
      archived_at, 0, inserted_at, updated_at
    FROM spaces
    """)

    execute("DROP TABLE spaces")
    execute("ALTER TABLE spaces_new RENAME TO spaces")
    execute("CREATE INDEX spaces_org_id_index ON spaces (org_id)")
    execute("CREATE INDEX spaces_space_type_index ON spaces (space_type)")
    execute("PRAGMA foreign_keys=ON")
  end
end
