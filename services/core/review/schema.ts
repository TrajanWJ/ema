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

function createReviewItemsTable(db: MinimalDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_items (
      id TEXT PRIMARY KEY,
      source_kind TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL UNIQUE,
      chronicle_session_id TEXT NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
      chronicle_entry_id TEXT REFERENCES chronicle_entries(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      title TEXT NOT NULL,
      summary TEXT,
      source_excerpt TEXT,
      suggested_target_kind TEXT,
      latest_decision_id TEXT,
      created_by_actor_id TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS review_items_session_idx
      ON review_items(chronicle_session_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS review_items_entry_idx
      ON review_items(chronicle_entry_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS review_items_status_idx
      ON review_items(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS review_items_latest_decision_idx
      ON review_items(latest_decision_id);
  `);
}

function createReviewDecisionsTable(db: MinimalDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_decisions (
      id TEXT PRIMARY KEY,
      review_item_id TEXT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
      decision TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      rationale TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      decided_at TEXT NOT NULL,
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS review_decisions_item_idx
      ON review_decisions(review_item_id, decided_at DESC);
    CREATE INDEX IF NOT EXISTS review_decisions_kind_idx
      ON review_decisions(decision, decided_at DESC);
  `);
}

function createPromotionReceiptsTable(db: MinimalDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promotion_receipts (
      id TEXT PRIMARY KEY,
      review_item_id TEXT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
      review_decision_id TEXT REFERENCES review_decisions(id) ON DELETE SET NULL,
      chronicle_session_id TEXT NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
      chronicle_entry_id TEXT REFERENCES chronicle_entries(id) ON DELETE SET NULL,
      target_kind TEXT NOT NULL,
      target_id TEXT,
      status TEXT NOT NULL DEFAULT 'recorded',
      summary TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS promotion_receipts_item_idx
      ON promotion_receipts(review_item_id, inserted_at DESC);
    CREATE INDEX IF NOT EXISTS promotion_receipts_session_idx
      ON promotion_receipts(chronicle_session_id, inserted_at DESC);
    CREATE INDEX IF NOT EXISTS promotion_receipts_decision_idx
      ON promotion_receipts(review_decision_id);
  `);
}

function migrateLegacyReviewItems(db: MinimalDb): void {
  if (!tableExists(db, "review_items") || hasColumn(db, "review_items", "source_fingerprint")) {
    return;
  }

  if (!tableExists(db, "review_items_legacy")) {
    db.exec("ALTER TABLE review_items RENAME TO review_items_legacy");
  }

  createReviewItemsTable(db);

  db.exec(`
    INSERT OR IGNORE INTO review_items (
      id,
      source_kind,
      source_fingerprint,
      chronicle_session_id,
      chronicle_entry_id,
      status,
      title,
      summary,
      source_excerpt,
      suggested_target_kind,
      latest_decision_id,
      created_by_actor_id,
      metadata,
      inserted_at,
      updated_at
    )
    SELECT
      id,
      'chronicle_session',
      'legacy:review_item:' || id,
      session_id,
      NULL,
      CASE status
        WHEN 'approved' THEN 'approved'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'deferred' THEN 'deferred'
        WHEN 'promoted' THEN 'approved'
        ELSE 'pending'
      END,
      title,
      summary,
      NULL,
      CASE
        WHEN target_kind IN ('intent', 'proposal', 'execution') THEN target_kind
        WHEN target_kind = 'follow_up' THEN 'task'
        WHEN target_kind = 'canon_suggestion' THEN 'canon'
        WHEN target_kind = 'vault_suggestion' THEN 'note'
        ELSE 'other'
      END,
      NULL,
      COALESCE(decision_actor_id, 'legacy_review'),
      payload,
      inserted_at,
      updated_at
    FROM review_items_legacy
  `);
}

function migrateLegacyPromotionReceipts(db: MinimalDb): void {
  if (
    !tableExists(db, "promotion_receipts")
    || hasColumn(db, "promotion_receipts", "review_decision_id")
  ) {
    return;
  }

  if (!tableExists(db, "promotion_receipts_legacy")) {
    db.exec("ALTER TABLE promotion_receipts RENAME TO promotion_receipts_legacy");
  }

  createPromotionReceiptsTable(db);

  db.exec(`
    INSERT OR IGNORE INTO promotion_receipts (
      id,
      review_item_id,
      review_decision_id,
      chronicle_session_id,
      chronicle_entry_id,
      target_kind,
      target_id,
      status,
      summary,
      metadata,
      inserted_at,
      updated_at
    )
    SELECT
      pr.id,
      pr.review_item_id,
      NULL,
      COALESCE(ri.chronicle_session_id, pr.session_id),
      ri.chronicle_entry_id,
      CASE
        WHEN pr.target_kind IN ('intent', 'proposal', 'execution') THEN pr.target_kind
        WHEN pr.target_kind = 'follow_up' THEN 'task'
        WHEN pr.target_kind = 'canon_suggestion' THEN 'canon'
        WHEN pr.target_kind = 'vault_suggestion' THEN 'note'
        ELSE 'other'
      END,
      NULLIF(pr.target_id, ''),
      CASE pr.promotion_mode
        WHEN 'link' THEN 'linked'
        ELSE 'recorded'
      END,
      pr.provenance_summary,
      pr.metadata,
      pr.inserted_at,
      pr.inserted_at
    FROM promotion_receipts_legacy pr
    LEFT JOIN review_items ri ON ri.id = pr.review_item_id
  `);
}

export function applyReviewDdl(db: MinimalDb): void {
  createReviewItemsTable(db);
  createReviewDecisionsTable(db);
  createPromotionReceiptsTable(db);
  migrateLegacyReviewItems(db);
  migrateLegacyPromotionReceipts(db);
}
