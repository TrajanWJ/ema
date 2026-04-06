import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
export const DATA_DIR = process.env.DATA_DIR || path.join(cwd, ".hq-data");
mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "hq.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    color TEXT DEFAULT '#38bdf8',
    path TEXT,
    superman_url TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS project_resources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    url TEXT,
    config TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    instruction TEXT,
    status TEXT DEFAULT 'pending',
    agent_model TEXT,
    summary TEXT,
    tool_calls TEXT DEFAULT '[]',
    events TEXT DEFAULT '[]',
    started_at INTEGER,
    ended_at INTEGER,
    ms INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS brain_dump (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unprocessed',
    tags TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_executions_project_id ON executions(project_id);
  CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
  CREATE INDEX IF NOT EXISTS idx_notes_project_id ON notes(project_id);
  CREATE INDEX IF NOT EXISTS idx_brain_dump_project_id ON brain_dump(project_id);
  CREATE INDEX IF NOT EXISTS idx_brain_dump_status ON brain_dump(status);
`);
