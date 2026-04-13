import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const DB_DIR = join(homedir(), '.local', 'share', 'ema');
const DB_PATH = join(DB_DIR, 'ema.db');

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;

  mkdirSync(DB_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_windows (
      app_id TEXT PRIMARY KEY,
      is_open INTEGER NOT NULL DEFAULT 0,
      x INTEGER,
      y INTEGER,
      width INTEGER,
      height INTEGER,
      is_maximized INTEGER NOT NULL DEFAULT 0,
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      icon TEXT,
      color TEXT,
      linked_path TEXT,
      parent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority INTEGER NOT NULL DEFAULT 2,
      source_type TEXT,
      source_id TEXT,
      effort TEXT,
      due_date TEXT,
      project_id TEXT,
      parent_id TEXT,
      completed_at TEXT,
      agent TEXT,
      intent TEXT,
      intent_confidence TEXT,
      intent_overridden INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      body TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'text',
      processed INTEGER NOT NULL DEFAULT 0,
      action TEXT,
      processed_at TEXT,
      created_at TEXT NOT NULL,
      project_id TEXT
    );

    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'research',
      status TEXT NOT NULL DEFAULT 'created',
      brain_dump_item_id TEXT,
      requires_approval INTEGER NOT NULL DEFAULT 1,
      result_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Note: additive columns for the executions table (objective, intent_slug,
  // proposal_id, step_journal, reflexion_context, etc.) are owned by
  // `services/core/executions/executions.schema.ts` and applied lazily the
  // first time the executions service is used. Don't duplicate them here —
  // that module uses per-column try/catch for idempotent ALTER TABLE ADD
  // COLUMN which this baseline should not interfere with.

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined;
  }
}
