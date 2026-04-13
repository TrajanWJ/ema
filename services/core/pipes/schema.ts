/**
 * Drizzle table definitions for the Pipes subservice.
 *
 * `pipes` — user-defined trigger→transforms→action wiring, enabled flag.
 * `pipe_runs` — append-only execution log.
 *
 * Like `services/core/blueprint/schema.ts`, DDL ships as a raw string applied
 * via better-sqlite3 `.exec()` on bootstrap until drizzle-kit migrations land.
 */

import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pipes = sqliteTable(
  "pipes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    trigger: text("trigger").notNull(),
    action: text("action").notNull(),
    transforms: text("transforms").notNull().default("[]"), // JSON array
    enabled: text("enabled").notNull().default("1"), // "0" | "1"
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    triggerIdx: index("pipes_trigger_idx").on(table.trigger),
    enabledIdx: index("pipes_enabled_idx").on(table.enabled),
  }),
);

export const pipeRuns = sqliteTable(
  "pipe_runs",
  {
    id: text("id").primaryKey(),
    pipeId: text("pipe_id").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull(),
    input: text("input").notNull(), // JSON
    output: text("output"), // JSON
    error: text("error"),
    haltedReason: text("halted_reason"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    durationMs: text("duration_ms"),
  },
  (table) => ({
    pipeIdIdx: index("pipe_runs_pipe_id_idx").on(table.pipeId),
    startedAtIdx: index("pipe_runs_started_at_idx").on(table.startedAt),
  }),
);

export const PIPES_DDL = `
  CREATE TABLE IF NOT EXISTS pipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    action TEXT NOT NULL,
    transforms TEXT NOT NULL DEFAULT '[]',
    enabled TEXT NOT NULL DEFAULT '1',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS pipes_trigger_idx ON pipes(trigger);
  CREATE INDEX IF NOT EXISTS pipes_enabled_idx ON pipes(enabled);

  CREATE TABLE IF NOT EXISTS pipe_runs (
    id TEXT PRIMARY KEY,
    pipe_id TEXT NOT NULL,
    trigger TEXT NOT NULL,
    status TEXT NOT NULL,
    input TEXT NOT NULL,
    output TEXT,
    error TEXT,
    halted_reason TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    duration_ms TEXT
  );

  CREATE INDEX IF NOT EXISTS pipe_runs_pipe_id_idx ON pipe_runs(pipe_id);
  CREATE INDEX IF NOT EXISTS pipe_runs_started_at_idx ON pipe_runs(started_at);
`;

export function applyPipesDdl(db: { exec: (sql: string) => unknown }): void {
  db.exec(PIPES_DDL);
}
