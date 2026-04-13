/**
 * Executions subservice — SQLite schema.
 *
 * The base `executions` table is seeded by `services/persistence/db.ts` with
 * a minimal column set (id, title, mode, status, brain_dump_item_id,
 * requires_approval, result_summary, created_at, updated_at). This module
 * layers on:
 *
 *   1. ALTER-TABLE columns required by the `Execution` contract in
 *      `@ema/shared/schemas/executions` and by the research port inventory in
 *      `ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md` (§Data Models):
 *        - objective, project_slug, intent_slug, intent_path, result_path,
 *          proposal_id, completed_at, space_id, ema_links,
 *          progress_log_path, step_journal, reflexion_context, archived_at.
 *
 *   2. A dedicated append-only `execution_phase_transitions` table, shaped
 *      like the `PHASE_TRANSITION_DDL` helper in `@ema/shared/schemas/actor-phase`
 *      but scoped to the execution id (rather than the generic actor id) so
 *      that phase history is discoverable from a single execution row without
 *      a cross-join through the actors table.
 *
 * Every column add is wrapped in a try/catch so repeated boots are idempotent
 * on a schema that already has the column — SQLite has no `ADD COLUMN IF NOT
 * EXISTS`. The persistence layer uses `better-sqlite3` with `.exec()` for
 * bootstrap; drizzle-kit migrations land later.
 */

import type Database from "better-sqlite3";

const ADDITIVE_COLUMNS: ReadonlyArray<{ name: string; ddl: string }> = [
  { name: "objective", ddl: "ALTER TABLE executions ADD COLUMN objective TEXT" },
  { name: "project_slug", ddl: "ALTER TABLE executions ADD COLUMN project_slug TEXT" },
  { name: "intent_slug", ddl: "ALTER TABLE executions ADD COLUMN intent_slug TEXT" },
  { name: "intent_path", ddl: "ALTER TABLE executions ADD COLUMN intent_path TEXT" },
  { name: "result_path", ddl: "ALTER TABLE executions ADD COLUMN result_path TEXT" },
  { name: "proposal_id", ddl: "ALTER TABLE executions ADD COLUMN proposal_id TEXT" },
  { name: "completed_at", ddl: "ALTER TABLE executions ADD COLUMN completed_at TEXT" },
  { name: "space_id", ddl: "ALTER TABLE executions ADD COLUMN space_id TEXT" },
  { name: "ema_links", ddl: "ALTER TABLE executions ADD COLUMN ema_links TEXT" },
  {
    name: "progress_log_path",
    ddl: "ALTER TABLE executions ADD COLUMN progress_log_path TEXT",
  },
  {
    name: "step_journal",
    ddl: "ALTER TABLE executions ADD COLUMN step_journal TEXT NOT NULL DEFAULT '[]'",
  },
  {
    name: "reflexion_context",
    ddl: "ALTER TABLE executions ADD COLUMN reflexion_context TEXT",
  },
  { name: "current_phase", ddl: "ALTER TABLE executions ADD COLUMN current_phase TEXT" },
  { name: "archived_at", ddl: "ALTER TABLE executions ADD COLUMN archived_at TEXT" },
];

const PHASE_TRANSITIONS_DDL = `
  CREATE TABLE IF NOT EXISTS execution_phase_transitions (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    from_phase TEXT,
    to_phase TEXT NOT NULL,
    reason TEXT NOT NULL,
    summary TEXT,
    metadata TEXT,
    transitioned_at TEXT NOT NULL,
    CHECK (to_phase IN ('idle','plan','execute','review','retro'))
  );
  CREATE INDEX IF NOT EXISTS idx_execution_phase_transitions_exec
    ON execution_phase_transitions(execution_id, transitioned_at);
`;

const INDEXES_DDL = `
  CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
  CREATE INDEX IF NOT EXISTS idx_executions_intent_slug ON executions(intent_slug);
  CREATE INDEX IF NOT EXISTS idx_executions_project_slug ON executions(project_slug);
  CREATE INDEX IF NOT EXISTS idx_executions_mode ON executions(mode);
`;

export interface MinimalDb {
  exec: (sql: string) => unknown;
  prepare: Database.Database["prepare"];
}

/**
 * Apply additive executions DDL to the database handle. Idempotent.
 * Expects the base `executions` table to already exist (seeded by
 * `services/persistence/db.ts`).
 */
export function applyExecutionsDdl(db: MinimalDb): void {
  // Ensure the base table exists — the persistence bootstrap normally handles
  // this, but hermetic tests can mount an empty :memory: database.
  db.exec(`
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

  for (const { ddl } of ADDITIVE_COLUMNS) {
    try {
      db.exec(ddl);
    } catch {
      // Column already exists — expected on warm boots.
    }
  }

  db.exec(PHASE_TRANSITIONS_DDL);
  db.exec(INDEXES_DDL);
}
