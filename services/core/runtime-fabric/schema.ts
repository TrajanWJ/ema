import type Database from "better-sqlite3";

export const RUNTIME_FABRIC_DDL = `
  CREATE TABLE IF NOT EXISTS runtime_fabric_tools (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    binary_path TEXT,
    version TEXT,
    config_dir TEXT,
    auth_state TEXT NOT NULL,
    available INTEGER NOT NULL DEFAULT 0,
    launch_command TEXT NOT NULL,
    source TEXT NOT NULL,
    detected_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS runtime_fabric_sessions (
    id TEXT PRIMARY KEY,
    session_name TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    tool_kind TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    status TEXT NOT NULL,
    runtime_state TEXT,
    cwd TEXT,
    command TEXT NOT NULL,
    pane_id TEXT,
    pid INTEGER,
    started_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_output_at TEXT,
    last_transition_at TEXT,
    tail_preview TEXT,
    tail_hash TEXT,
    summary TEXT
  );

  CREATE TABLE IF NOT EXISTS runtime_fabric_session_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload_json TEXT,
    inserted_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES runtime_fabric_sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS runtime_fabric_tools_kind_idx
    ON runtime_fabric_tools(kind);

  CREATE INDEX IF NOT EXISTS runtime_fabric_sessions_name_idx
    ON runtime_fabric_sessions(session_name);

  CREATE INDEX IF NOT EXISTS runtime_fabric_sessions_status_idx
    ON runtime_fabric_sessions(status);

  CREATE INDEX IF NOT EXISTS runtime_fabric_session_events_session_idx
    ON runtime_fabric_session_events(session_id, inserted_at DESC);
`;

export function applyRuntimeFabricDdl(db: Database.Database): void {
  db.exec(RUNTIME_FABRIC_DDL);
  for (const statement of [
    "ALTER TABLE runtime_fabric_sessions ADD COLUMN runtime_state TEXT",
    "ALTER TABLE runtime_fabric_sessions ADD COLUMN last_transition_at TEXT",
    "ALTER TABLE runtime_fabric_sessions ADD COLUMN tail_preview TEXT",
    "ALTER TABLE runtime_fabric_sessions ADD COLUMN tail_hash TEXT",
  ]) {
    try {
      db.exec(statement);
    } catch {
      // Column already exists.
    }
  }
}
