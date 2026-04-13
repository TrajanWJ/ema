/**
 * Drizzle table definitions for the Blueprint subservice.
 *
 * Implements the SQLite entity side of DEC-004. The filesystem layer
 * (`.superman/gac/<NNN>/card.md` and `ema-genesis/intents/GAC-NNN/README.md`)
 * remains the source of truth; these tables are the queryable index mirror.
 *
 * Indexed per DEC-004 on (status, category, priority, created_at).
 * Transitions are append-only — no UPDATE, no DELETE.
 */

import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gacCards = sqliteTable(
  "gac_cards",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull().default("gac_card"),
    layer: text("layer").notNull().default("intents"),
    title: text("title").notNull(),
    status: text("status").notNull(),
    category: text("category").notNull(),
    priority: text("priority").notNull(),
    author: text("author").notNull(),
    question: text("question").notNull(),

    // JSON-encoded blobs for the structured sub-objects. Kept as TEXT columns
    // because better-sqlite3 does not natively encode JSON on write.
    options: text("options").notNull(), // JSON array
    answer: text("answer"), // JSON object | null
    resultAction: text("result_action"), // JSON object | null
    connections: text("connections").notNull().default("[]"), // JSON array
    context: text("context"), // JSON object | null
    tags: text("tags").notNull().default("[]"), // JSON array

    // Provenance / origin
    sourcePath: text("source_path"), // absolute path the card was loaded from
    deletedAt: text("deleted_at"), // soft-delete marker

    // Lifecycle timestamps (ISO8601 strings for parity with existing tables)
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    answeredAt: text("answered_at"),
    answeredBy: text("answered_by"),
  },
  (table) => ({
    statusIdx: index("gac_cards_status_idx").on(table.status),
    categoryIdx: index("gac_cards_category_idx").on(table.category),
    priorityIdx: index("gac_cards_priority_idx").on(table.priority),
    createdAtIdx: index("gac_cards_created_at_idx").on(table.createdAt),
  }),
);

export const gacTransitions = sqliteTable(
  "gac_transitions",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actor: text("actor").notNull(),
    reason: text("reason"),
    happenedAt: text("happened_at").notNull(),
  },
  (table) => ({
    cardIdIdx: index("gac_transitions_card_id_idx").on(table.cardId),
    happenedAtIdx: index("gac_transitions_happened_at_idx").on(
      table.happenedAt,
    ),
  }),
);

/**
 * DDL applied on blueprint service bootstrap.
 *
 * Kept as a raw string because the existing EMA persistence layer uses
 * better-sqlite3's `.exec()` for schema setup (see `services/persistence/db.ts`),
 * not drizzle-kit migrations. When migrations land, this moves into a numbered
 * migration file and this constant is deleted.
 */
export const BLUEPRINT_DDL = `
  CREATE TABLE IF NOT EXISTS gac_cards (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'gac_card',
    layer TEXT NOT NULL DEFAULT 'intents',
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    author TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    answer TEXT,
    result_action TEXT,
    connections TEXT NOT NULL DEFAULT '[]',
    context TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    source_path TEXT,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    answered_at TEXT,
    answered_by TEXT
  );

  CREATE INDEX IF NOT EXISTS gac_cards_status_idx ON gac_cards(status);
  CREATE INDEX IF NOT EXISTS gac_cards_category_idx ON gac_cards(category);
  CREATE INDEX IF NOT EXISTS gac_cards_priority_idx ON gac_cards(priority);
  CREATE INDEX IF NOT EXISTS gac_cards_created_at_idx ON gac_cards(created_at);

  CREATE TABLE IF NOT EXISTS gac_transitions (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    actor TEXT NOT NULL,
    reason TEXT,
    happened_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS gac_transitions_card_id_idx ON gac_transitions(card_id);
  CREATE INDEX IF NOT EXISTS gac_transitions_happened_at_idx ON gac_transitions(happened_at);
`;

/**
 * Apply blueprint DDL to a better-sqlite3 Database handle.
 * Idempotent — safe to call on every boot.
 */
export function applyBlueprintDdl(db: {
  exec: (sql: string) => unknown;
}): void {
  db.exec(BLUEPRINT_DDL);
}
