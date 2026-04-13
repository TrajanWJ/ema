/**
 * Drizzle table definition + DDL for cross-pollination entries.
 *
 * Ported from the old Elixir `Ema.Memory.CrossPollination` schema
 * (IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/memory/cross_pollination.ex).
 *
 * The table is append-only: every row represents a distinct "I noticed X
 * applies here" moment. No UPDATE, no DELETE. Filterable by source/target
 * project and ordered by `applied_at`.
 *
 * DDL is applied on memory service bootstrap via `applyCrossPollinationDdl`,
 * following the same `.exec()`-at-boot pattern as the blueprint subservice.
 */

import { index, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

export const crossPollinationEntries = sqliteTable(
  "memory_cross_pollinations",
  {
    id: text("id").primaryKey(),
    fact: text("fact").notNull(),
    sourceProject: text("source_project").notNull(),
    targetProject: text("target_project").notNull(),
    rationale: text("rationale").notNull(),
    appliedAt: text("applied_at").notNull(),
    actorId: text("actor_id"),
    confidence: real("confidence"),
    tags: text("tags").notNull().default("[]"), // JSON array
  },
  (table) => ({
    sourceIdx: index("memory_cross_pollinations_source_idx").on(
      table.sourceProject,
    ),
    targetIdx: index("memory_cross_pollinations_target_idx").on(
      table.targetProject,
    ),
    appliedAtIdx: index("memory_cross_pollinations_applied_at_idx").on(
      table.appliedAt,
    ),
  }),
);

export const CROSS_POLLINATION_DDL = `
  CREATE TABLE IF NOT EXISTS memory_cross_pollinations (
    id TEXT PRIMARY KEY,
    fact TEXT NOT NULL,
    source_project TEXT NOT NULL,
    target_project TEXT NOT NULL,
    rationale TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    actor_id TEXT,
    confidence REAL,
    tags TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX IF NOT EXISTS memory_cross_pollinations_source_idx
    ON memory_cross_pollinations(source_project);
  CREATE INDEX IF NOT EXISTS memory_cross_pollinations_target_idx
    ON memory_cross_pollinations(target_project);
  CREATE INDEX IF NOT EXISTS memory_cross_pollinations_applied_at_idx
    ON memory_cross_pollinations(applied_at);
`;

/**
 * Apply cross-pollination DDL to a better-sqlite3 Database handle.
 * Idempotent — safe to call on every boot.
 */
export function applyCrossPollinationDdl(db: {
  exec: (sql: string) => unknown;
}): void {
  db.exec(CROSS_POLLINATION_DDL);
}
