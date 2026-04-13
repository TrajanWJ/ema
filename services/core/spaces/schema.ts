/**
 * Drizzle table definitions for the Spaces subservice.
 *
 * A Space is a flat namespaced scope for actors, intents, executions, and
 * vApps. Per `shared/schemas/spaces.ts` and GAC-007 resolution [D], v1 ships
 * FLAT — there is no `parent_space_id` column. Members are stored as JSON on
 * the spaces row to mirror the `Space` type verbatim (members live on the
 * entity, not in a separate join table). Lifecycle rows live in
 * `space_transitions`, append-only.
 *
 * Indexed on (status, slug) for the two hot paths: listing active spaces and
 * slug lookup. Slugs are unique across the flat namespace.
 */

import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const spaces = sqliteTable(
  "spaces",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),

    // JSON blobs — same rationale as blueprint: better-sqlite3 doesn't
    // natively encode JSON on write, so these are TEXT columns.
    members: text("members").notNull().default("[]"), // JSON array of SpaceMember
    settings: text("settings").notNull().default("{}"), // JSON object

    archivedAt: text("archived_at"),
    insertedAt: text("inserted_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("spaces_slug_idx").on(table.slug),
    statusIdx: index("spaces_status_idx").on(table.status),
  }),
);

export const spaceTransitions = sqliteTable(
  "space_transitions",
  {
    id: text("id").primaryKey(),
    spaceId: text("space_id").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actor: text("actor").notNull(),
    reason: text("reason"),
    happenedAt: text("happened_at").notNull(),
  },
  (table) => ({
    spaceIdIdx: index("space_transitions_space_id_idx").on(table.spaceId),
    happenedAtIdx: index("space_transitions_happened_at_idx").on(
      table.happenedAt,
    ),
  }),
);

/**
 * DDL applied on spaces service bootstrap. Idempotent.
 */
export const SPACES_DDL = `
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    members TEXT NOT NULL DEFAULT '[]',
    settings TEXT NOT NULL DEFAULT '{}',
    archived_at TEXT,
    inserted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS spaces_slug_idx ON spaces(slug);
  CREATE INDEX IF NOT EXISTS spaces_status_idx ON spaces(status);

  CREATE TABLE IF NOT EXISTS space_transitions (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    actor TEXT NOT NULL,
    reason TEXT,
    happened_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS space_transitions_space_id_idx ON space_transitions(space_id);
  CREATE INDEX IF NOT EXISTS space_transitions_happened_at_idx ON space_transitions(happened_at);
`;

export function applySpacesDdl(db: { exec: (sql: string) => unknown }): void {
  db.exec(SPACES_DDL);
}
