import type Database from "better-sqlite3";

import { getDb } from "../../persistence/db.js";

interface Migration {
  name: string;
  statements: string[];
}

const MIGRATIONS: Migration[] = [
  {
    name: "001-core-loop-foundation",
    statements: [
      `CREATE TABLE IF NOT EXISTS service_migrations (
         name TEXT PRIMARY KEY,
         applied_at TEXT NOT NULL
       )`,
      `CREATE TABLE IF NOT EXISTS loop_intents (
         id TEXT PRIMARY KEY,
         title TEXT NOT NULL,
         description TEXT NOT NULL,
         source TEXT NOT NULL,
         status TEXT NOT NULL,
         priority TEXT NOT NULL,
         requested_by_actor_id TEXT NOT NULL,
         scope_json TEXT NOT NULL,
         constraints_json TEXT NOT NULL,
         search_text TEXT NOT NULL,
         metadata_json TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS loop_intents_status_idx ON loop_intents(status)`,
      `CREATE INDEX IF NOT EXISTS loop_intents_priority_idx ON loop_intents(priority)`,
      `CREATE INDEX IF NOT EXISTS loop_intents_requested_by_idx ON loop_intents(requested_by_actor_id)`,
      `CREATE TABLE IF NOT EXISTS loop_proposals (
         id TEXT PRIMARY KEY,
         intent_id TEXT NOT NULL,
         title TEXT NOT NULL,
         summary TEXT NOT NULL,
         rationale TEXT NOT NULL,
         plan_steps_json TEXT NOT NULL,
         status TEXT NOT NULL,
         revision INTEGER NOT NULL,
         parent_proposal_id TEXT,
         generated_by_actor_id TEXT NOT NULL,
         approved_by_actor_id TEXT,
         rejected_by_actor_id TEXT,
         rejection_reason TEXT,
         metadata_json TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         FOREIGN KEY(intent_id) REFERENCES loop_intents(id) ON DELETE CASCADE,
         FOREIGN KEY(parent_proposal_id) REFERENCES loop_proposals(id) ON DELETE SET NULL
       )`,
      `CREATE INDEX IF NOT EXISTS loop_proposals_intent_idx ON loop_proposals(intent_id)`,
      `CREATE INDEX IF NOT EXISTS loop_proposals_status_idx ON loop_proposals(status)`,
      `CREATE TABLE IF NOT EXISTS loop_executions (
         id TEXT PRIMARY KEY,
         proposal_id TEXT NOT NULL,
         intent_id TEXT NOT NULL,
         title TEXT NOT NULL,
         status TEXT NOT NULL,
         started_by_actor_id TEXT NOT NULL,
         started_at TEXT NOT NULL,
         completed_at TEXT,
         result_summary TEXT,
         error_message TEXT,
         metadata_json TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         FOREIGN KEY(proposal_id) REFERENCES loop_proposals(id) ON DELETE CASCADE,
         FOREIGN KEY(intent_id) REFERENCES loop_intents(id) ON DELETE CASCADE
       )`,
      `CREATE INDEX IF NOT EXISTS loop_executions_proposal_idx ON loop_executions(proposal_id)`,
      `CREATE INDEX IF NOT EXISTS loop_executions_status_idx ON loop_executions(status)`,
      `CREATE TABLE IF NOT EXISTS loop_artifacts (
         id TEXT PRIMARY KEY,
         execution_id TEXT NOT NULL,
         type TEXT NOT NULL,
         label TEXT NOT NULL,
         path TEXT,
         mime_type TEXT,
         content TEXT NOT NULL,
         created_by_actor_id TEXT NOT NULL,
         metadata_json TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         FOREIGN KEY(execution_id) REFERENCES loop_executions(id) ON DELETE CASCADE
       )`,
      `CREATE INDEX IF NOT EXISTS loop_artifacts_execution_idx ON loop_artifacts(execution_id)`,
      `CREATE TABLE IF NOT EXISTS loop_events (
         id TEXT PRIMARY KEY,
         event_type TEXT NOT NULL,
         entity_id TEXT NOT NULL,
         entity_type TEXT NOT NULL,
         occurred_at TEXT NOT NULL,
         payload_json TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS loop_events_entity_idx ON loop_events(entity_type, entity_id)`,
      `CREATE INDEX IF NOT EXISTS loop_events_type_idx ON loop_events(event_type)`,
      `CREATE INDEX IF NOT EXISTS loop_events_occurred_at_idx ON loop_events(occurred_at)` ,
    ],
  },
];

let migrationsApplied = false;

function nowIso(): string {
  return new Date().toISOString();
}

function ensureMigrationTable(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS service_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
}

export function runLoopMigrations(db: Database.Database = getDb()): void {
  if (migrationsApplied) return;

  ensureMigrationTable(db);

  const applied = new Set(
    (db.prepare("SELECT name FROM service_migrations").all() as Array<{ name: string }>).map(
      (row) => row.name,
    ),
  );

  const apply = db.transaction((migration: Migration) => {
    for (const statement of migration.statements) {
      db.exec(statement);
    }
    db.prepare(
      "INSERT OR REPLACE INTO service_migrations (name, applied_at) VALUES (?, ?)",
    ).run(migration.name, nowIso());
  });

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    apply(migration);
  }

  migrationsApplied = true;
}

export function resetLoopMigrationsForTests(): void {
  migrationsApplied = false;
}
