import type Database from "better-sqlite3";

export function applyCalendarDdl(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      entry_kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      owner_kind TEXT NOT NULL DEFAULT 'human',
      owner_id TEXT NOT NULL DEFAULT 'owner',
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      phase TEXT,
      buildout_id TEXT,
      goal_id TEXT,
      task_id TEXT,
      project_id TEXT,
      space_id TEXT,
      intent_slug TEXT,
      execution_id TEXT,
      location TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS calendar_entries_time_idx ON calendar_entries(starts_at, ends_at);
    CREATE INDEX IF NOT EXISTS calendar_entries_owner_idx ON calendar_entries(owner_kind, owner_id);
    CREATE INDEX IF NOT EXISTS calendar_entries_status_idx ON calendar_entries(status);
    CREATE INDEX IF NOT EXISTS calendar_entries_kind_idx ON calendar_entries(entry_kind);
    CREATE INDEX IF NOT EXISTS calendar_entries_goal_idx ON calendar_entries(goal_id);
    CREATE INDEX IF NOT EXISTS calendar_entries_task_idx ON calendar_entries(task_id);
    CREATE INDEX IF NOT EXISTS calendar_entries_buildout_idx ON calendar_entries(buildout_id);
  `);
}
