import { nanoid } from "nanoid";

import type {
  CreatePromotionReceiptInput,
  CreateReviewItemInput,
  ListReviewItemsFilter,
  PromotionReceipt,
  ReviewDecision,
  ReviewDecisionInput,
  ReviewDecisionKind,
  ReviewItem,
  ReviewItemDetail,
  ReviewItemSummary,
} from "@ema/shared/schemas";
import {
  createPromotionReceiptInputSchema,
  createReviewItemInputSchema,
  promotionReceiptSchema,
  reviewDecisionInputSchema,
  reviewDecisionSchema,
  reviewItemDetailSchema,
  reviewItemSchema,
  reviewItemSummarySchema,
} from "@ema/shared/schemas";

import { getDb } from "../../persistence/db.js";
import { getChronicleSessionDetail, initChronicle } from "../chronicle/service.js";
import { applyReviewDdl } from "./schema.js";

type DbRow = Record<string, unknown>;

export interface ChronicleReviewState {
  review_items: ReviewItem[];
  promotion_receipts: PromotionReceipt[];
}

let initialised = false;

export class ReviewItemNotFoundError extends Error {
  public readonly code = "review_item_not_found";

  constructor(public readonly reviewItemId: string) {
    super(`Review item not found: ${reviewItemId}`);
    this.name = "ReviewItemNotFoundError";
  }
}

export class ReviewDecisionNotFoundError extends Error {
  public readonly code = "review_decision_not_found";

  constructor(public readonly reviewDecisionId: string) {
    super(`Review decision not found: ${reviewDecisionId}`);
    this.name = "ReviewDecisionNotFoundError";
  }
}

export class ReviewStateError extends Error {
  public readonly code = "review_invalid_state";

  constructor(message: string) {
    super(message);
    this.name = "ReviewStateError";
  }
}

export function initReview(): void {
  if (initialised) return;
  initChronicle();
  applyReviewDdl(getDb());
  initialised = true;
}

export function __resetReviewForTests(): void {
  initialised = false;
}

function db() {
  initReview();
  return getDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

function encode(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function decode<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function truncate(value: string, max = 120): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function firstNonEmpty(parts: Array<string | null | undefined>): string | null {
  for (const part of parts) {
    if (typeof part === "string" && part.trim().length > 0) return part.trim();
  }
  return null;
}

function coerceNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toSummary(value: string | null): string | null {
  if (!value) return null;
  return truncate(value, 240);
}

function mapReviewItemRow(row: DbRow | undefined): ReviewItem | null {
  if (!row) return null;
  const parsed = reviewItemSchema.safeParse({
    id: String(row.id),
    source_kind: String(row.source_kind),
    source_fingerprint: String(row.source_fingerprint),
    chronicle_session_id: String(row.chronicle_session_id),
    chronicle_entry_id: typeof row.chronicle_entry_id === "string" ? row.chronicle_entry_id : null,
    status: String(row.status),
    title: String(row.title),
    summary: coerceNullableString(row.summary),
    source_excerpt: coerceNullableString(row.source_excerpt),
    suggested_target_kind:
      typeof row.suggested_target_kind === "string" ? row.suggested_target_kind : null,
    latest_decision_id:
      typeof row.latest_decision_id === "string" ? row.latest_decision_id : null,
    created_by_actor_id: String(row.created_by_actor_id),
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapReviewDecisionRow(row: DbRow | undefined): ReviewDecision | null {
  if (!row) return null;
  const parsed = reviewDecisionSchema.safeParse({
    id: String(row.id),
    review_item_id: String(row.review_item_id),
    decision: String(row.decision),
    actor_id: String(row.actor_id),
    rationale: coerceNullableString(row.rationale),
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
    decided_at: String(row.decided_at),
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapPromotionReceiptRow(row: DbRow | undefined): PromotionReceipt | null {
  if (!row) return null;
  const parsed = promotionReceiptSchema.safeParse({
    id: String(row.id),
    review_item_id: String(row.review_item_id),
    review_decision_id:
      typeof row.review_decision_id === "string" ? row.review_decision_id : null,
    chronicle_session_id: String(row.chronicle_session_id),
    chronicle_entry_id: typeof row.chronicle_entry_id === "string" ? row.chronicle_entry_id : null,
    target_kind: String(row.target_kind),
    target_id: typeof row.target_id === "string" ? row.target_id : null,
    status: String(row.status),
    summary: coerceNullableString(row.summary),
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapReviewItemSummaryRow(row: DbRow | undefined): ReviewItemSummary | null {
  const item = mapReviewItemRow(row);
  if (!item || !row) return null;
  const parsed = reviewItemSummarySchema.safeParse({
    ...item,
    latest_decision: typeof row.latest_decision === "string" ? row.latest_decision : null,
    latest_decided_at: typeof row.latest_decided_at === "string" ? row.latest_decided_at : null,
    decision_count:
      typeof row.decision_count === "number"
        ? row.decision_count
        : Number(row.decision_count ?? 0),
    receipt_count:
      typeof row.receipt_count === "number" ? row.receipt_count : Number(row.receipt_count ?? 0),
  });
  return parsed.success ? parsed.data : null;
}

function requireReviewItem(id: string): ReviewItem {
  const row = db().prepare("SELECT * FROM review_items WHERE id = ?").get(id) as DbRow | undefined;
  const item = mapReviewItemRow(row);
  if (!item) throw new ReviewItemNotFoundError(id);
  return item;
}

function requireReviewDecision(reviewDecisionId: string): ReviewDecision {
  const row = db()
    .prepare("SELECT * FROM review_decisions WHERE id = ?")
    .get(reviewDecisionId) as DbRow | undefined;
  const decision = mapReviewDecisionRow(row);
  if (!decision) throw new ReviewDecisionNotFoundError(reviewDecisionId);
  return decision;
}

function listDecisions(reviewItemId: string): ReviewDecision[] {
  return db()
    .prepare(
      `
        SELECT * FROM review_decisions
        WHERE review_item_id = ?
        ORDER BY decided_at DESC, inserted_at DESC, rowid DESC
      `,
    )
    .all(reviewItemId)
    .map((row) => mapReviewDecisionRow(row as DbRow))
    .filter((row): row is ReviewDecision => row !== null);
}

function listReceiptsForReviewItem(reviewItemId: string): PromotionReceipt[] {
  return db()
    .prepare(
      `
        SELECT * FROM promotion_receipts
        WHERE review_item_id = ?
        ORDER BY inserted_at DESC, updated_at DESC
      `,
    )
    .all(reviewItemId)
    .map((row) => mapPromotionReceiptRow(row as DbRow))
    .filter((row): row is PromotionReceipt => row !== null);
}

function listSessionReviewItems(sessionId: string): ReviewItem[] {
  return db()
    .prepare(
      `
        SELECT * FROM review_items
        WHERE chronicle_session_id = ?
        ORDER BY updated_at DESC, inserted_at DESC
      `,
    )
    .all(sessionId)
    .map((row) => mapReviewItemRow(row as DbRow))
    .filter((row): row is ReviewItem => row !== null);
}

function listSessionReceipts(sessionId: string): PromotionReceipt[] {
  return db()
    .prepare(
      `
        SELECT * FROM promotion_receipts
        WHERE chronicle_session_id = ?
        ORDER BY inserted_at DESC, updated_at DESC
      `,
    )
    .all(sessionId)
    .map((row) => mapPromotionReceiptRow(row as DbRow))
    .filter((row): row is PromotionReceipt => row !== null);
}

function buildReviewTitle(
  input: CreateReviewItemInput,
  sessionTitle: string,
  entryContent: string | null,
): string {
  return truncate(
    firstNonEmpty([input.title, entryContent, sessionTitle, "Chronicle review item"])
      ?? "Chronicle review item",
    96,
  );
}

function buildReviewSummary(
  input: CreateReviewItemInput,
  sessionSummary: string | null,
  entryContent: string | null,
): string | null {
  return toSummary(firstNonEmpty([input.summary ?? null, sessionSummary, entryContent]));
}

function buildSourceExcerpt(
  input: CreateReviewItemInput,
  sessionSummary: string | null,
  entryContent: string | null,
  firstEntryContent: string | null,
): string | null {
  return toSummary(
    firstNonEmpty([
      input.source_excerpt ?? null,
      entryContent,
      sessionSummary,
      firstEntryContent,
    ]),
  );
}

function createDecision(
  reviewItemId: string,
  decision: ReviewDecisionKind,
  rawInput: ReviewDecisionInput,
): ReviewDecision {
  const input = reviewDecisionInputSchema.parse(rawInput);
  const timestamp = nowIso();
  const id = nanoid();

  db()
    .prepare(
      `
        INSERT INTO review_decisions (
          id,
          review_item_id,
          decision,
          actor_id,
          rationale,
          metadata,
          decided_at,
          inserted_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      reviewItemId,
      decision,
      input.actor_id,
      input.rationale ?? null,
      encode(input.metadata),
      timestamp,
      timestamp,
      timestamp,
    );

  return requireReviewDecision(id);
}

function nextStatusForDecision(decision: ReviewDecisionKind): ReviewItem["status"] {
  if (decision === "approve") return "approved";
  if (decision === "reject") return "rejected";
  return "deferred";
}

function applyDecision(
  reviewItemId: string,
  decision: ReviewDecisionKind,
  rawInput: ReviewDecisionInput,
): ReviewItem {
  const item = requireReviewItem(reviewItemId);

  if (item.status === "approved" || item.status === "rejected") {
    throw new ReviewStateError(`review_item_terminal ${reviewItemId} ${item.status}`);
  }

  const record = createDecision(reviewItemId, decision, rawInput);
  const nextStatus = nextStatusForDecision(decision);
  const updatedAt = nowIso();

  db()
    .prepare(
      `
        UPDATE review_items
        SET status = ?, latest_decision_id = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .run(nextStatus, record.id, updatedAt, reviewItemId);

  return requireReviewItem(reviewItemId);
}

export function getChronicleReviewState(sessionId: string): ChronicleReviewState {
  return {
    review_items: listSessionReviewItems(sessionId),
    promotion_receipts: listSessionReceipts(sessionId),
  };
}

export function createReviewItem(rawInput: CreateReviewItemInput): ReviewItemDetail {
  const input = createReviewItemInputSchema.parse(rawInput);
  const detail = getChronicleSessionDetail(input.chronicle_session_id);
  const entry = input.chronicle_entry_id
    ? detail.entries.find((candidate) => candidate.id === input.chronicle_entry_id) ?? null
    : null;

  if (input.chronicle_entry_id && !entry) {
    throw new ReviewStateError(
      `chronicle_entry_not_found ${input.chronicle_session_id} ${input.chronicle_entry_id}`,
    );
  }

  const sourceKind = entry ? "chronicle_entry" : "chronicle_session";
  const sourceFingerprint = entry
    ? `chronicle_entry:${entry.id}`
    : `chronicle_session:${detail.session.id}`;

  const existing = db()
    .prepare("SELECT id FROM review_items WHERE source_fingerprint = ?")
    .get(sourceFingerprint) as { id?: string } | undefined;
  if (typeof existing?.id === "string") {
    return getReviewItemDetail(existing.id);
  }

  const title = buildReviewTitle(input, detail.session.title, entry?.content ?? null);
  const summary = buildReviewSummary(input, detail.session.summary, entry?.content ?? null);
  const sourceExcerpt = buildSourceExcerpt(
    input,
    detail.session.summary,
    entry?.content ?? null,
    detail.entries[0]?.content ?? null,
  );
  const id = nanoid();
  const timestamp = nowIso();

  db()
    .prepare(
      `
        INSERT INTO review_items (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      sourceKind,
      sourceFingerprint,
      detail.session.id,
      entry?.id ?? null,
      "pending",
      title,
      summary,
      sourceExcerpt,
      input.suggested_target_kind ?? null,
      null,
      input.created_by_actor_id,
      encode(input.metadata),
      timestamp,
      timestamp,
    );

  return getReviewItemDetail(id);
}

export function listReviewItems(filter: ListReviewItemsFilter = {}): ReviewItemSummary[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.status) {
    clauses.push("ri.status = ?");
    params.push(filter.status);
  }
  if (filter.chronicle_session_id) {
    clauses.push("ri.chronicle_session_id = ?");
    params.push(filter.chronicle_session_id);
  }
  if (filter.chronicle_entry_id) {
    clauses.push("ri.chronicle_entry_id = ?");
    params.push(filter.chronicle_entry_id);
  }
  if (filter.decision) {
    clauses.push("rd.decision = ?");
    params.push(filter.decision);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(filter.limit ?? 50, 200));
  const rows = db()
    .prepare(
      `
        SELECT
          ri.*,
          rd.decision AS latest_decision,
          rd.decided_at AS latest_decided_at,
          (
            SELECT COUNT(*) FROM review_decisions decisions
            WHERE decisions.review_item_id = ri.id
          ) AS decision_count,
          (
            SELECT COUNT(*) FROM promotion_receipts receipts
            WHERE receipts.review_item_id = ri.id
          ) AS receipt_count
        FROM review_items ri
        LEFT JOIN review_decisions rd ON rd.id = ri.latest_decision_id
        ${where}
        ORDER BY ri.updated_at DESC, ri.inserted_at DESC
        LIMIT ${limit}
      `,
    )
    .all(...params) as DbRow[];

  return rows
    .map((row) => mapReviewItemSummaryRow(row))
    .filter((row): row is ReviewItemSummary => row !== null);
}

export function getReviewItemDetail(id: string): ReviewItemDetail {
  const item = requireReviewItem(id);
  const chronicle = getChronicleSessionDetail(item.chronicle_session_id);
  const entry = item.chronicle_entry_id
    ? chronicle.entries.find((candidate) => candidate.id === item.chronicle_entry_id) ?? null
    : null;

  return reviewItemDetailSchema.parse({
    item,
    source: {
      source_kind: item.source_kind,
      source_fingerprint: item.source_fingerprint,
      chronicle_session_id: item.chronicle_session_id,
      chronicle_entry_id: item.chronicle_entry_id,
    },
    chronicle: {
      session: {
        id: chronicle.session.id,
        title: chronicle.session.title,
        summary: chronicle.session.summary,
        status: chronicle.session.status,
        imported_at: chronicle.session.imported_at,
      },
      entry: entry
        ? {
            id: entry.id,
            session_id: entry.session_id,
            ordinal: entry.ordinal,
            occurred_at: entry.occurred_at,
            role: entry.role,
            kind: entry.kind,
            content: entry.content,
          }
        : null,
    },
    decisions: listDecisions(id),
    receipts: listReceiptsForReviewItem(id),
  });
}

export function approveReviewItem(id: string, input: ReviewDecisionInput): ReviewItem {
  return applyDecision(id, "approve", input);
}

export function rejectReviewItem(id: string, input: ReviewDecisionInput): ReviewItem {
  return applyDecision(id, "reject", input);
}

export function deferReviewItem(id: string, input: ReviewDecisionInput): ReviewItem {
  return applyDecision(id, "defer", input);
}

export function recordPromotionReceipt(
  reviewItemId: string,
  rawInput: CreatePromotionReceiptInput,
): ReviewItemDetail {
  const item = requireReviewItem(reviewItemId);
  if (item.status !== "approved") {
    throw new ReviewStateError(`review_item_not_approved ${reviewItemId} ${item.status}`);
  }

  const input = createPromotionReceiptInputSchema.parse(rawInput);
  const decision = input.review_decision_id
    ? requireReviewDecision(input.review_decision_id)
    : item.latest_decision_id
      ? requireReviewDecision(item.latest_decision_id)
      : null;

  if (!decision || decision.review_item_id !== reviewItemId || decision.decision !== "approve") {
    throw new ReviewStateError(`review_receipt_requires_approval_decision ${reviewItemId}`);
  }

  const timestamp = nowIso();
  db()
    .prepare(
      `
        INSERT INTO promotion_receipts (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      nanoid(),
      reviewItemId,
      decision.id,
      item.chronicle_session_id,
      item.chronicle_entry_id,
      input.target_kind,
      input.target_id ?? null,
      input.status,
      input.summary ?? `Recorded promotion receipt for ${item.title}`,
      encode(input.metadata),
      timestamp,
      timestamp,
    );

  return getReviewItemDetail(reviewItemId);
}
