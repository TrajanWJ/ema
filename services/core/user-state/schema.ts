/**
 * UserState subservice — SQLite persistence.
 *
 * Two tables:
 *   - `user_state_current` — singleton row (id = 'self'). The personal OS has
 *     exactly one operator; multi-user is explicitly out of scope for v1.
 *   - `user_state_snapshots` — append-only ring buffer of every mutation.
 *     Mirrors VisibilityHub's in-memory ring but persisted so a crash doesn't
 *     lose research signal. Pruned to `SNAPSHOT_RING_SIZE` at write time.
 *
 * Mirrors `services/core/blueprint/schema.ts`: raw DDL string applied on
 * bootstrap via better-sqlite3's `.exec()`. Idempotent.
 */

import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const SNAPSHOT_RING_SIZE = 500;

export const userStateCurrent = sqliteTable("user_state_current", {
  id: text("id").primaryKey(), // always 'self'
  mode: text("mode").notNull(),
  focusScore: text("focus_score"), // nullable numeric stored as TEXT
  energyScore: text("energy_score"),
  distressFlag: integer("distress_flag").notNull(), // 0 | 1
  driftScore: text("drift_score"),
  currentIntentSlug: text("current_intent_slug"),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const userStateSnapshots = sqliteTable(
  "user_state_snapshots",
  {
    id: text("id").primaryKey(),
    mode: text("mode").notNull(),
    focusScore: text("focus_score"),
    energyScore: text("energy_score"),
    distressFlag: integer("distress_flag").notNull(),
    driftScore: text("drift_score"),
    currentIntentSlug: text("current_intent_slug"),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by").notNull(),
    reason: text("reason"),
  },
  (table) => ({
    updatedAtIdx: index("user_state_snapshots_updated_at_idx").on(
      table.updatedAt,
    ),
  }),
);

export const USER_STATE_DDL = `
  CREATE TABLE IF NOT EXISTS user_state_current (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    focus_score TEXT,
    energy_score TEXT,
    distress_flag INTEGER NOT NULL,
    drift_score TEXT,
    current_intent_slug TEXT,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_state_snapshots (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    focus_score TEXT,
    energy_score TEXT,
    distress_flag INTEGER NOT NULL,
    drift_score TEXT,
    current_intent_slug TEXT,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    reason TEXT
  );

  CREATE INDEX IF NOT EXISTS user_state_snapshots_updated_at_idx
    ON user_state_snapshots(updated_at);
`;

export function applyUserStateDdl(db: {
  exec: (sql: string) => unknown;
}): void {
  db.exec(USER_STATE_DDL);
}
