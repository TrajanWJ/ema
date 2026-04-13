import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chronicleSources = sqliteTable(
  "chronicle_sources",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    machineId: text("machine_id"),
    provenanceRoot: text("provenance_root"),
    insertedAt: text("inserted_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    kindIdx: index("chronicle_sources_kind_idx").on(table.kind),
  }),
);

export const chronicleSessions = sqliteTable(
  "chronicle_sessions",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    summary: text("summary"),
    projectHint: text("project_hint"),
    status: text("status").notNull().default("imported"),
    importedAt: text("imported_at").notNull(),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    provenancePath: text("provenance_path"),
    rawPath: text("raw_path").notNull(),
    entryCount: integer("entry_count").notNull().default(0),
    artifactCount: integer("artifact_count").notNull().default(0),
    metadata: text("metadata").notNull().default("{}"),
    insertedAt: text("inserted_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    sourceIdx: index("chronicle_sessions_source_idx").on(table.sourceId),
    importedIdx: index("chronicle_sessions_imported_idx").on(table.importedAt),
    startedIdx: index("chronicle_sessions_started_idx").on(table.startedAt),
  }),
);

export const chronicleEntries = sqliteTable(
  "chronicle_entries",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    externalId: text("external_id"),
    ordinal: integer("ordinal").notNull(),
    occurredAt: text("occurred_at"),
    role: text("role").notNull(),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    insertedAt: text("inserted_at").notNull(),
  },
  (table) => ({
    sessionOrdinalIdx: index("chronicle_entries_session_ordinal_idx").on(
      table.sessionId,
      table.ordinal,
    ),
  }),
);

export const chronicleArtifacts = sqliteTable(
  "chronicle_artifacts",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    entryId: text("entry_id"),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type"),
    storedPath: text("stored_path").notNull(),
    originalPath: text("original_path"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    metadata: text("metadata").notNull().default("{}"),
    insertedAt: text("inserted_at").notNull(),
  },
  (table) => ({
    sessionIdx: index("chronicle_artifacts_session_idx").on(table.sessionId),
  }),
);

export const CHRONICLE_DDL = `
  CREATE TABLE IF NOT EXISTS chronicle_sources (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    machine_id TEXT,
    provenance_root TEXT,
    inserted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS chronicle_sources_kind_idx ON chronicle_sources(kind);

  CREATE TABLE IF NOT EXISTS chronicle_sessions (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES chronicle_sources(id) ON DELETE CASCADE,
    external_id TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    project_hint TEXT,
    status TEXT NOT NULL DEFAULT 'imported',
    imported_at TEXT NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    provenance_path TEXT,
    raw_path TEXT NOT NULL,
    entry_count INTEGER NOT NULL DEFAULT 0,
    artifact_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT NOT NULL DEFAULT '{}',
    inserted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS chronicle_sessions_source_idx ON chronicle_sessions(source_id);
  CREATE INDEX IF NOT EXISTS chronicle_sessions_imported_idx ON chronicle_sessions(imported_at);
  CREATE INDEX IF NOT EXISTS chronicle_sessions_started_idx ON chronicle_sessions(started_at);

  CREATE TABLE IF NOT EXISTS chronicle_entries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
    external_id TEXT,
    ordinal INTEGER NOT NULL,
    occurred_at TEXT,
    role TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    inserted_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS chronicle_entries_session_ordinal_idx
    ON chronicle_entries(session_id, ordinal);

  CREATE TABLE IF NOT EXISTS chronicle_artifacts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
    entry_id TEXT REFERENCES chronicle_entries(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT,
    stored_path TEXT NOT NULL,
    original_path TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    metadata TEXT NOT NULL DEFAULT '{}',
    inserted_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS chronicle_artifacts_session_idx ON chronicle_artifacts(session_id);
`;

export function applyChronicleDdl(db: { exec: (sql: string) => unknown }): void {
  db.exec(CHRONICLE_DDL);
}
