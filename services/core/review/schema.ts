import type Database from "better-sqlite3";

export interface MinimalDb {
  exec: (sql: string) => unknown;
  prepare: Database.Database["prepare"];
}

function tableExists(db: MinimalDb, tableName: string): boolean {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(tableName) as { name?: string } | undefined;
  return typeof row?.name === "string";
}

function hasColumn(db: MinimalDb, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>;
  return rows.some((row) => row.name === columnName);
}

function renameLegacyTable(db: MinimalDb, tableName: string): void {
  const legacyName = `${tableName}_legacy`;
  if (!tableExists(db, tableName) || tableExists(db, legacyName)) return;
  db.exec(`ALTER TABLE ${tableName} RENAME TO ${legacyName}`);
}

function ensureChronicleExtractionsTable(db: MinimalDb): void {
  if (tableExists(db, "chronicle_extractions") && !hasColumn(db, "chronicle_extractions", "candidate_payload")) {
    renameLegacyTable(db, "chronicle_extractions");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS chronicle_extractions (
      id TEXT PRIMARY KEY,
      chronicle_session_id TEXT NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
      chronicle_entry_id TEXT REFERENCES chronicle_entries(id) ON DELETE SET NULL,
      chronicle_artifact_id TEXT REFERENCES chronicle_artifacts(id) ON DELETE SET NULL,
      source_kind TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      fingerprint TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT,
      source_excerpt TEXT,
      confidence REAL,
      suggested_target_kind TEXT,
      candidate_payload TEXT NOT NULL DEFAULT '{}',
      metadata TEXT NOT NULL DEFAULT '{}',
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS chronicle_extractions_session_idx
      ON chronicle_extractions(chronicle_session_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS chronicle_extractions_entry_idx
      ON chronicle_extractions(chronicle_entry_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS chronicle_extractions_artifact_idx
      ON chronicle_extractions(chronicle_artifact_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS chronicle_extractions_status_idx
      ON chronicle_extractions(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS chronicle_extractions_kind_idx
      ON chronicle_extractions(kind, updated_at DESC);
  `);
}

function ensureReviewItemsTable(db: MinimalDb): void {
  if (tableExists(db, "review_items") && !hasColumn(db, "review_items", "extraction_id")) {
    renameLegacyTable(db, "review_items");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS review_items (
      id TEXT PRIMARY KEY,
      extraction_id TEXT NOT NULL UNIQUE REFERENCES chronicle_extractions(id) ON DELETE CASCADE,
      chronicle_session_id TEXT NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
      chronicle_entry_id TEXT REFERENCES chronicle_entries(id) ON DELETE SET NULL,
      chronicle_artifact_id TEXT REFERENCES chronicle_artifacts(id) ON DELETE SET NULL,
      candidate_kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      title TEXT NOT NULL,
      summary TEXT,
      source_excerpt TEXT,
      confidence REAL,
      suggested_target_kind TEXT,
      target_kind TEXT,
      target_id TEXT,
      decision_actor_id TEXT,
      decision_note TEXT,
      decided_at TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS review_items_session_idx
      ON review_items(chronicle_session_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS review_items_entry_idx
      ON review_items(chronicle_entry_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS review_items_artifact_idx
      ON review_items(chronicle_artifact_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS review_items_status_idx
      ON review_items(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS review_items_target_idx
      ON review_items(target_kind, target_id);
  `);
}

function ensurePromotionReceiptsTable(db: MinimalDb): void {
  if (tableExists(db, "promotion_receipts") && !hasColumn(db, "promotion_receipts", "extraction_id")) {
    renameLegacyTable(db, "promotion_receipts");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS promotion_receipts (
      id TEXT PRIMARY KEY,
      review_item_id TEXT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
      extraction_id TEXT REFERENCES chronicle_extractions(id) ON DELETE SET NULL,
      chronicle_session_id TEXT NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
      chronicle_entry_id TEXT REFERENCES chronicle_entries(id) ON DELETE SET NULL,
      chronicle_artifact_id TEXT REFERENCES chronicle_artifacts(id) ON DELETE SET NULL,
      target_kind TEXT NOT NULL,
      target_id TEXT,
      promotion_mode TEXT NOT NULL DEFAULT 'create',
      provenance_summary TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS promotion_receipts_item_idx
      ON promotion_receipts(review_item_id, inserted_at DESC);
    CREATE INDEX IF NOT EXISTS promotion_receipts_extraction_idx
      ON promotion_receipts(extraction_id, inserted_at DESC);
    CREATE INDEX IF NOT EXISTS promotion_receipts_session_idx
      ON promotion_receipts(chronicle_session_id, inserted_at DESC);
    CREATE INDEX IF NOT EXISTS promotion_receipts_target_idx
      ON promotion_receipts(target_kind, target_id);
  `);
}

export function applyReviewDdl(db: MinimalDb): void {
  ensureChronicleExtractionsTable(db);
  ensureReviewItemsTable(db);
  ensurePromotionReceiptsTable(db);
}
