import type Database from "better-sqlite3";

export function applyGoalsDdl(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      timeframe TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      owner_kind TEXT NOT NULL DEFAULT 'human',
      owner_id TEXT NOT NULL DEFAULT 'owner',
      parent_id TEXT,
      project_id TEXT,
      space_id TEXT,
      intent_slug TEXT,
      target_date TEXT,
      success_criteria TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(parent_id) REFERENCES goals(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS goals_status_idx ON goals(status);
    CREATE INDEX IF NOT EXISTS goals_timeframe_idx ON goals(timeframe);
    CREATE INDEX IF NOT EXISTS goals_owner_idx ON goals(owner_kind, owner_id);
    CREATE INDEX IF NOT EXISTS goals_parent_idx ON goals(parent_id);
    CREATE INDEX IF NOT EXISTS goals_project_idx ON goals(project_id);
    CREATE INDEX IF NOT EXISTS goals_intent_idx ON goals(intent_slug);
  `);
}
