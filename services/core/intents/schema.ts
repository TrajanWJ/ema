/**
 * Drizzle + DDL definitions for the Intents subservice.
 *
 * Ports `Ema.Intents` (old Elixir build) to a two-layer TypeScript service:
 * the filesystem at .superman/intents/<slug>/intent.md + status.json and
 * ema-genesis/intents/INT-<SLUG>/README.md is the source of truth; this SQLite
 * index mirrors it for query. Primary key is the kebab slug (`id`) —
 * matching the old build's convention and Self-Pollination Appendix A.6.
 *
 * `intent_phase_transitions` is append-only (no UPDATE, no DELETE) so the
 * lifecycle of every intent is durable. Phase is the DEC-005 work phase
 * (`idle|plan|execute|review|retro`) reused from `@ema/shared/schemas`.
 */

import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { PHASE_TRANSITION_DDL } from "@ema/shared/schemas";

export const intents = sqliteTable(
  "intents",
  {
    id: text("id").primaryKey(), // kebab slug — e.g. "int-recovery-wave-1"
    title: text("title").notNull(),
    description: text("description"),
    level: text("level").notNull(),
    status: text("status").notNull(),
    kind: text("kind"),
    phase: text("phase"), // current work phase (idle|plan|execute|review|retro)

    parentId: text("parent_id"),
    projectId: text("project_id"),
    actorId: text("actor_id"),
    spaceId: text("space_id"),

    exitCondition: text("exit_condition"),
    scope: text("scope"), // JSON array of globs
    emaLinks: text("ema_links"), // JSON array of { type, target }
    metadata: text("metadata"), // JSON object
    tags: text("tags").notNull().default("[]"), // JSON array

    sourcePath: text("source_path"),
    deletedAt: text("deleted_at"),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    statusIdx: index("intents_status_idx").on(table.status),
    levelIdx: index("intents_level_idx").on(table.level),
    kindIdx: index("intents_kind_idx").on(table.kind),
    phaseIdx: index("intents_phase_idx").on(table.phase),
    projectIdx: index("intents_project_id_idx").on(table.projectId),
    parentIdx: index("intents_parent_id_idx").on(table.parentId),
    createdAtIdx: index("intents_created_at_idx").on(table.createdAt),
  }),
);

export const intentPhaseTransitions = sqliteTable(
  "intent_phase_transitions",
  {
    id: text("id").primaryKey(),
    intentSlug: text("intent_slug").notNull(),
    fromPhase: text("from_phase"),
    toPhase: text("to_phase").notNull(),
    reason: text("reason").notNull(),
    summary: text("summary"),
    metadata: text("metadata"),
    transitionedAt: text("transitioned_at").notNull(),
  },
  (table) => ({
    intentSlugIdx: index("intent_phase_transitions_slug_idx").on(
      table.intentSlug,
    ),
    transitionedAtIdx: index("intent_phase_transitions_at_idx").on(
      table.transitionedAt,
    ),
  }),
);

/**
 * `intent_links` — semantic-to-operational edges per DEC-007 (Unified
 * Intents Schema + Three Truths). Bridges intents to executions, tasks,
 * proposals, sessions, actors, and to other intents. `relation` matches
 * `emaLinkTypeSchema` plus the attachment verbs (`runtime`, `origin`,
 * `owner`, etc.) from the old Elixir `intent_links` table.
 *
 * Many-to-many. A single intent may carry dozens of links; a single
 * target may be linked by multiple intents.
 */
export const intentLinks = sqliteTable(
  "intent_links",
  {
    id: text("id").primaryKey(),
    sourceSlug: text("source_slug").notNull(),
    targetType: text("target_type").notNull(), // intent|execution|proposal|task|session|actor|canon
    targetId: text("target_id").notNull(),
    relation: text("relation").notNull(),
    provenance: text("provenance").notNull().default("manual"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    sourceIdx: index("intent_links_source_idx").on(table.sourceSlug),
    targetIdx: index("intent_links_target_idx").on(
      table.targetType,
      table.targetId,
    ),
    relationIdx: index("intent_links_relation_idx").on(table.relation),
  }),
);

/**
 * `intent_events` — append-only lineage log at the intent level. Sits
 * alongside `intent_phase_transitions` (which is phase-specific). Events
 * here are status changes, attachment creations, attachment removals,
 * upsert events, scope-rejection events, etc.
 */
export const intentEvents = sqliteTable(
  "intent_events",
  {
    id: text("id").primaryKey(),
    intentSlug: text("intent_slug").notNull(),
    eventType: text("event_type").notNull(),
    payload: text("payload").notNull().default("{}"), // JSON
    actor: text("actor").notNull().default("system"),
    happenedAt: text("happened_at").notNull(),
  },
  (table) => ({
    intentIdx: index("intent_events_intent_idx").on(table.intentSlug),
    eventTypeIdx: index("intent_events_type_idx").on(table.eventType),
    happenedAtIdx: index("intent_events_happened_at_idx").on(table.happenedAt),
  }),
);

/**
 * DDL applied on intents service bootstrap. Raw string to match the existing
 * better-sqlite3 `.exec()` bootstrap pattern used by `services/persistence/db.ts`
 * and the sibling Blueprint subservice.
 */
export const INTENTS_DDL = `
  CREATE TABLE IF NOT EXISTS intents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL,
    status TEXT NOT NULL,
    kind TEXT,
    phase TEXT,
    parent_id TEXT,
    project_id TEXT,
    actor_id TEXT,
    space_id TEXT,
    exit_condition TEXT,
    scope TEXT,
    ema_links TEXT,
    metadata TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    source_path TEXT,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS intents_status_idx ON intents(status);
  CREATE INDEX IF NOT EXISTS intents_level_idx ON intents(level);
  CREATE INDEX IF NOT EXISTS intents_kind_idx ON intents(kind);
  CREATE INDEX IF NOT EXISTS intents_phase_idx ON intents(phase);
  CREATE INDEX IF NOT EXISTS intents_project_id_idx ON intents(project_id);
  CREATE INDEX IF NOT EXISTS intents_parent_id_idx ON intents(parent_id);
  CREATE INDEX IF NOT EXISTS intents_created_at_idx ON intents(created_at);

  CREATE TABLE IF NOT EXISTS intent_phase_transitions (
    id TEXT PRIMARY KEY,
    intent_slug TEXT NOT NULL,
    from_phase TEXT,
    to_phase TEXT NOT NULL,
    reason TEXT NOT NULL,
    summary TEXT,
    metadata TEXT,
    transitioned_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS intent_phase_transitions_slug_idx
    ON intent_phase_transitions(intent_slug);
  CREATE INDEX IF NOT EXISTS intent_phase_transitions_at_idx
    ON intent_phase_transitions(transitioned_at);

  CREATE TABLE IF NOT EXISTS intent_links (
    id TEXT PRIMARY KEY,
    source_slug TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    provenance TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS intent_links_source_idx ON intent_links(source_slug);
  CREATE INDEX IF NOT EXISTS intent_links_target_idx ON intent_links(target_type, target_id);
  CREATE INDEX IF NOT EXISTS intent_links_relation_idx ON intent_links(relation);

  CREATE TABLE IF NOT EXISTS intent_events (
    id TEXT PRIMARY KEY,
    intent_slug TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    actor TEXT NOT NULL DEFAULT 'system',
    happened_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS intent_events_intent_idx ON intent_events(intent_slug);
  CREATE INDEX IF NOT EXISTS intent_events_type_idx ON intent_events(event_type);
  CREATE INDEX IF NOT EXISTS intent_events_happened_at_idx ON intent_events(happened_at);
`;

/**
 * Apply intents DDL to a better-sqlite3 handle. Idempotent.
 *
 * Also applies `PHASE_TRANSITION_DDL` from `@ema/shared/schemas` — the
 * actor-keyed `phase_transitions` table from DEC-005. It has been exported
 * as a raw SQL string since actor-phase.ts landed but never applied by any
 * caller. The intents service owns it because intents are the only
 * subsystem that attaches to actors in this rebuild phase, and DEC-005
 * lives one hop away in the canon graph.
 */
export function applyIntentsDdl(db: {
  exec: (sql: string) => unknown;
}): void {
  db.exec(INTENTS_DDL);
  db.exec(PHASE_TRANSITION_DDL);
}
