import { nanoid } from "nanoid";

import type {
  ChronicleArtifact,
  ChronicleEntry,
  ChronicleExtraction,
  ChronicleExtractionRun,
  ChronicleSessionDetail,
  ListReviewItemsFilter,
  PromoteReviewItemInput,
  PromotionReceipt,
  ReviewDecisionInput,
  ReviewItem,
  ReviewItemDetail,
  ReviewItemSummary,
  ReviewTargetKind,
} from "@ema/shared/schemas";
import {
  chronicleExtractionRunSchema,
  chronicleExtractionSchema,
  listReviewItemsFilterSchema,
  promoteReviewItemInputSchema,
  promotionReceiptSchema,
  reviewDecisionInputSchema,
  reviewItemDetailSchema,
  reviewItemSchema,
  reviewItemSummarySchema,
} from "@ema/shared/schemas";

import { getDb } from "../../persistence/db.js";
import { createCalendarEntry } from "../calendar/calendar.service.js";
import { getChronicleSessionDetail, initChronicle } from "../chronicle/service.js";
import { createGoal } from "../goals/goals.service.js";
import { createIntent, slugify } from "../intents/service.js";
import { applyReviewDdl } from "./schema.js";

type DbRow = Record<string, unknown>;

export interface ChronicleReviewState {
  extractions: ChronicleExtraction[];
  review_items: ReviewItem[];
  promotion_receipts: PromotionReceipt[];
}

interface ExtractionDraft {
  chronicle_session_id: string;
  chronicle_entry_id: string | null;
  chronicle_artifact_id: string | null;
  source_kind: "chronicle_session" | "chronicle_entry" | "chronicle_artifact";
  kind: ChronicleExtraction["kind"];
  title: string;
  summary: string | null;
  source_excerpt: string | null;
  confidence: number | null;
  suggested_target_kind: ReviewTargetKind | null;
  candidate_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

let initialised = false;

const ACTION_RE =
  /\b(build|implement|create|fix|ship|wire|add|finish|complete|draft|write|review|plan|need to|next step|should)\b/i;
const GOAL_RE = /\b(goal|objective|target|aim|milestone)\b/i;
const FOLLOW_UP_RE = /\b(follow[- ]?up|check back|circle back|remind(?: me)?|schedule)\b/i;
const RESULT_RE = /\b(done|shipped|finished|completed|result|artifact|generated|exported|wrote)\b/i;
const ISO_DATE_RE = /\b(20\d{2}-\d{2}-\d{2})(?:[ tT]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z)?)?\b/;

export class ReviewItemNotFoundError extends Error {
  public readonly code = "review_item_not_found";

  constructor(public readonly reviewItemId: string) {
    super(`Review item not found: ${reviewItemId}`);
    this.name = "ReviewItemNotFoundError";
  }
}

export class ChronicleExtractionNotFoundError extends Error {
  public readonly code = "chronicle_extraction_not_found";

  constructor(public readonly extractionId: string) {
    super(`Chronicle extraction not found: ${extractionId}`);
    this.name = "ChronicleExtractionNotFoundError";
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

function coerceNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function coerceNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function truncate(value: string, max = 120): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function normaliseText(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 0 ? clean : null;
}

function stableFingerprint(draft: ExtractionDraft): string {
  return [
    draft.kind,
    draft.chronicle_session_id,
    draft.chronicle_entry_id ?? "",
    draft.chronicle_artifact_id ?? "",
    draft.title.toLowerCase(),
    JSON.stringify(draft.candidate_payload),
  ].join("|");
}

function buildTargetSummary(kind: ReviewTargetKind, id: string | null): string {
  return id ? `${kind}:${id}` : kind;
}

function parseIsoDateFromText(content: string): string | null {
  const match = content.match(ISO_DATE_RE);
  if (!match?.[1]) return null;
  return `${match[1]}T09:00:00.000Z`;
}

function inferGoalTimeframe(targetDate: string | null): "weekly" | "monthly" | "quarterly" | "yearly" | "3year" {
  if (!targetDate) return "weekly";
  const deltaMs = new Date(targetDate).getTime() - Date.now();
  const deltaDays = deltaMs / (1000 * 60 * 60 * 24);
  if (deltaDays <= 14) return "weekly";
  if (deltaDays <= 60) return "monthly";
  if (deltaDays <= 180) return "quarterly";
  if (deltaDays <= 730) return "yearly";
  return "3year";
}

function mapChronicleExtractionRow(row: DbRow | undefined): ChronicleExtraction | null {
  if (!row) return null;
  const parsed = chronicleExtractionSchema.safeParse({
    id: String(row.id),
    chronicle_session_id: String(row.chronicle_session_id),
    chronicle_entry_id: typeof row.chronicle_entry_id === "string" ? row.chronicle_entry_id : null,
    chronicle_artifact_id:
      typeof row.chronicle_artifact_id === "string" ? row.chronicle_artifact_id : null,
    source_kind: String(row.source_kind),
    kind: String(row.kind),
    status: String(row.status),
    fingerprint: String(row.fingerprint),
    title: String(row.title),
    summary: coerceNullableString(row.summary),
    source_excerpt: coerceNullableString(row.source_excerpt),
    confidence: coerceNullableNumber(row.confidence),
    suggested_target_kind:
      typeof row.suggested_target_kind === "string" ? row.suggested_target_kind : null,
    candidate_payload: decode<Record<string, unknown>>(row.candidate_payload, {}),
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapReviewItemRow(row: DbRow | undefined): ReviewItem | null {
  if (!row) return null;
  const parsed = reviewItemSchema.safeParse({
    id: String(row.id),
    extraction_id: String(row.extraction_id),
    chronicle_session_id: String(row.chronicle_session_id),
    chronicle_entry_id: typeof row.chronicle_entry_id === "string" ? row.chronicle_entry_id : null,
    chronicle_artifact_id:
      typeof row.chronicle_artifact_id === "string" ? row.chronicle_artifact_id : null,
    candidate_kind: String(row.candidate_kind),
    status: String(row.status),
    title: String(row.title),
    summary: coerceNullableString(row.summary),
    source_excerpt: coerceNullableString(row.source_excerpt),
    confidence: coerceNullableNumber(row.confidence),
    suggested_target_kind:
      typeof row.suggested_target_kind === "string" ? row.suggested_target_kind : null,
    target_kind: typeof row.target_kind === "string" ? row.target_kind : null,
    target_id: typeof row.target_id === "string" ? row.target_id : null,
    decision_actor_id: typeof row.decision_actor_id === "string" ? row.decision_actor_id : null,
    decision_note: coerceNullableString(row.decision_note),
    decided_at: typeof row.decided_at === "string" ? row.decided_at : null,
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
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
    extraction_id: typeof row.extraction_id === "string" ? row.extraction_id : null,
    chronicle_session_id: String(row.chronicle_session_id),
    chronicle_entry_id: typeof row.chronicle_entry_id === "string" ? row.chronicle_entry_id : null,
    chronicle_artifact_id:
      typeof row.chronicle_artifact_id === "string" ? row.chronicle_artifact_id : null,
    target_kind: String(row.target_kind),
    target_id: typeof row.target_id === "string" ? row.target_id : null,
    promotion_mode: String(row.promotion_mode),
    provenance_summary: coerceNullableString(row.provenance_summary),
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
    receipt_count:
      typeof row.receipt_count === "number" ? row.receipt_count : Number(row.receipt_count ?? 0),
    last_receipt_at: typeof row.last_receipt_at === "string" ? row.last_receipt_at : null,
  });
  return parsed.success ? parsed.data : null;
}

function requireExtraction(id: string): ChronicleExtraction {
  const row = db()
    .prepare("SELECT * FROM chronicle_extractions WHERE id = ?")
    .get(id) as DbRow | undefined;
  const extraction = mapChronicleExtractionRow(row);
  if (!extraction) throw new ChronicleExtractionNotFoundError(id);
  return extraction;
}

function requireReviewItem(id: string): ReviewItem {
  const row = db().prepare("SELECT * FROM review_items WHERE id = ?").get(id) as DbRow | undefined;
  const item = mapReviewItemRow(row);
  if (!item) throw new ReviewItemNotFoundError(id);
  return item;
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

function listSessionExtractions(sessionId: string): ChronicleExtraction[] {
  return db()
    .prepare(
      `
        SELECT * FROM chronicle_extractions
        WHERE chronicle_session_id = ?
        ORDER BY updated_at DESC, inserted_at DESC
      `,
    )
    .all(sessionId)
    .map((row) => mapChronicleExtractionRow(row as DbRow))
    .filter((row): row is ChronicleExtraction => row !== null);
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

function createExtraction(draft: ExtractionDraft): ChronicleExtraction {
  const fingerprint = stableFingerprint(draft);
  const existing = db()
    .prepare("SELECT * FROM chronicle_extractions WHERE fingerprint = ?")
    .get(fingerprint) as DbRow | undefined;
  const existingExtraction = mapChronicleExtractionRow(existing);
  if (existingExtraction) return existingExtraction;

  const timestamp = nowIso();
  const id = nanoid();

  db()
    .prepare(
      `
        INSERT INTO chronicle_extractions (
          id,
          chronicle_session_id,
          chronicle_entry_id,
          chronicle_artifact_id,
          source_kind,
          kind,
          status,
          fingerprint,
          title,
          summary,
          source_excerpt,
          confidence,
          suggested_target_kind,
          candidate_payload,
          metadata,
          inserted_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      draft.chronicle_session_id,
      draft.chronicle_entry_id,
      draft.chronicle_artifact_id,
      draft.source_kind,
      draft.kind,
      "pending",
      fingerprint,
      draft.title,
      draft.summary,
      draft.source_excerpt,
      draft.confidence,
      draft.suggested_target_kind,
      encode(draft.candidate_payload),
      encode(draft.metadata),
      timestamp,
      timestamp,
    );

  return requireExtraction(id);
}

function ensureReviewItem(extraction: ChronicleExtraction): ReviewItem {
  const existing = db()
    .prepare("SELECT * FROM review_items WHERE extraction_id = ?")
    .get(extraction.id) as DbRow | undefined;
  const existingItem = mapReviewItemRow(existing);
  if (existingItem) return existingItem;

  const timestamp = nowIso();
  const id = nanoid();

  db()
    .prepare(
      `
        INSERT INTO review_items (
          id,
          extraction_id,
          chronicle_session_id,
          chronicle_entry_id,
          chronicle_artifact_id,
          candidate_kind,
          status,
          title,
          summary,
          source_excerpt,
          confidence,
          suggested_target_kind,
          target_kind,
          target_id,
          decision_actor_id,
          decision_note,
          decided_at,
          metadata,
          inserted_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      extraction.id,
      extraction.chronicle_session_id,
      extraction.chronicle_entry_id,
      extraction.chronicle_artifact_id,
      extraction.kind,
      "pending",
      extraction.title,
      extraction.summary,
      extraction.source_excerpt,
      extraction.confidence,
      extraction.suggested_target_kind,
      null,
      null,
      null,
      null,
      null,
      encode({
        extraction_metadata: extraction.metadata,
      }),
      timestamp,
      timestamp,
    );

  return requireReviewItem(id);
}

function updateExtractionStatus(
  extractionId: string,
  status: ChronicleExtraction["status"],
  metadata?: Record<string, unknown>,
): void {
  const extraction = requireExtraction(extractionId);
  const nextMetadata = metadata ? { ...extraction.metadata, ...metadata } : extraction.metadata;
  db()
    .prepare(
      `
        UPDATE chronicle_extractions
        SET status = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .run(status, encode(nextMetadata), nowIso(), extractionId);
}

function applyDecision(
  id: string,
  status: ReviewItem["status"],
  rawInput: ReviewDecisionInput,
): ReviewItem {
  const item = requireReviewItem(id);
  if (item.status === "promoted" || item.status === "superseded") {
    throw new ReviewStateError(`review_item_terminal ${id} ${item.status}`);
  }

  const input = reviewDecisionInputSchema.parse(rawInput);
  const decidedAt = nowIso();

  db()
    .prepare(
      `
        UPDATE review_items
        SET status = ?, decision_actor_id = ?, decision_note = ?, decided_at = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .run(
      status,
      input.actor_id,
      input.rationale ?? null,
      decidedAt,
      decidedAt,
      id,
    );

  updateExtractionStatus(item.extraction_id, "reviewed", {
    decision_actor_id: input.actor_id,
    decision_status: status,
  });

  return requireReviewItem(id);
}

function sentenceSummary(value: string | null, fallback: string): string {
  return truncate(normaliseText(value) ?? fallback, 96);
}

function buildIntentExtraction(entry: ChronicleEntry): ExtractionDraft {
  return {
    chronicle_session_id: entry.session_id,
    chronicle_entry_id: entry.id,
    chronicle_artifact_id: null,
    source_kind: "chronicle_entry",
    kind: "intent_candidate",
    title: sentenceSummary(entry.content, "Intent candidate"),
    summary: truncate(entry.content, 240),
    source_excerpt: truncate(entry.content, 240),
    confidence: 0.74,
    suggested_target_kind: "intent",
    candidate_payload: {
      title: sentenceSummary(entry.content, "Intent candidate"),
      description: truncate(entry.content, 240),
      intent_kind: "planning",
      level: "task",
    },
    metadata: {
      matched_rule: "action_language",
      role: entry.role,
    },
  };
}

function buildGoalExtraction(entry: ChronicleEntry, targetDate: string | null): ExtractionDraft {
  return {
    chronicle_session_id: entry.session_id,
    chronicle_entry_id: entry.id,
    chronicle_artifact_id: null,
    source_kind: "chronicle_entry",
    kind: "goal_candidate",
    title: sentenceSummary(entry.content, "Goal candidate"),
    summary: truncate(entry.content, 240),
    source_excerpt: truncate(entry.content, 240),
    confidence: 0.68,
    suggested_target_kind: "goal",
    candidate_payload: {
      title: sentenceSummary(entry.content, "Goal candidate"),
      description: truncate(entry.content, 240),
      target_date: targetDate,
      timeframe: inferGoalTimeframe(targetDate),
    },
    metadata: {
      matched_rule: "goal_language",
      role: entry.role,
    },
  };
}

function buildCalendarExtraction(entry: ChronicleEntry, startsAt: string): ExtractionDraft {
  const withoutDate = entry.content.replace(ISO_DATE_RE, "").replace(/\s+/g, " ").trim();
  const title = withoutDate.length > 0 ? withoutDate : entry.content;
  return {
    chronicle_session_id: entry.session_id,
    chronicle_entry_id: entry.id,
    chronicle_artifact_id: null,
    source_kind: "chronicle_entry",
    kind: "calendar_candidate",
    title: sentenceSummary(title, "Calendar candidate"),
    summary: truncate(entry.content, 240),
    source_excerpt: truncate(entry.content, 240),
    confidence: 0.86,
    suggested_target_kind: "calendar_entry",
    candidate_payload: {
      title: sentenceSummary(title, "Calendar candidate"),
      starts_at: startsAt,
      entry_kind: "human_commitment",
      description: truncate(entry.content, 240),
    },
    metadata: {
      matched_rule: "dated_commitment",
      role: entry.role,
    },
  };
}

function buildFollowUpExtraction(entry: ChronicleEntry, targetDate: string | null): ExtractionDraft {
  return {
    chronicle_session_id: entry.session_id,
    chronicle_entry_id: entry.id,
    chronicle_artifact_id: null,
    source_kind: "chronicle_entry",
    kind: "follow_up_candidate",
    title: sentenceSummary(entry.content, "Follow-up candidate"),
    summary: truncate(entry.content, 240),
    source_excerpt: truncate(entry.content, 240),
    confidence: targetDate ? 0.79 : 0.65,
    suggested_target_kind: targetDate ? "calendar_entry" : "goal",
    candidate_payload: {
      title: sentenceSummary(entry.content, "Follow-up candidate"),
      description: truncate(entry.content, 240),
      target_date: targetDate,
    },
    metadata: {
      matched_rule: "follow_up_language",
      role: entry.role,
    },
  };
}

function buildEvidenceExtraction(
  sessionId: string,
  artifact: ChronicleArtifact,
  excerpt: string | null,
): ExtractionDraft {
  return {
    chronicle_session_id: sessionId,
    chronicle_entry_id: artifact.entry_id,
    chronicle_artifact_id: artifact.id,
    source_kind: "chronicle_artifact",
    kind: "execution_evidence_candidate",
    title: `Execution evidence: ${artifact.name}`,
    summary: excerpt ? truncate(excerpt, 240) : `Artifact captured: ${artifact.name}`,
    source_excerpt: excerpt ? truncate(excerpt, 240) : null,
    confidence: 0.9,
    suggested_target_kind: "execution",
    candidate_payload: {
      artifact_name: artifact.name,
      artifact_kind: artifact.kind,
      stored_path: artifact.stored_path,
      mime_type: artifact.mime_type,
    },
    metadata: {
      matched_rule: "artifact_presence",
    },
  };
}

function buildProjectLinkExtraction(detail: ChronicleSessionDetail): ExtractionDraft {
  const projectHint = normaliseText(detail.session.project_hint) ?? "unknown-project";
  return {
    chronicle_session_id: detail.session.id,
    chronicle_entry_id: null,
    chronicle_artifact_id: null,
    source_kind: "chronicle_session",
    kind: "project_link_candidate",
    title: `Link session to project ${projectHint}`,
    summary: detail.session.summary,
    source_excerpt: detail.entries[0] ? truncate(detail.entries[0].content, 240) : detail.session.summary,
    confidence: 0.73,
    suggested_target_kind: null,
    candidate_payload: {
      project_hint: projectHint,
      session_title: detail.session.title,
    },
    metadata: {
      matched_rule: "session_project_hint",
    },
  };
}

function collectExtractionDrafts(detail: ChronicleSessionDetail): ExtractionDraft[] {
  const drafts: ExtractionDraft[] = [];

  if (detail.session.project_hint) {
    drafts.push(buildProjectLinkExtraction(detail));
  }

  for (const entry of detail.entries) {
    const content = normaliseText(entry.content);
    if (!content) continue;
    const targetDate = parseIsoDateFromText(content);

    if (ACTION_RE.test(content)) {
      drafts.push(buildIntentExtraction(entry));
    }
    if (GOAL_RE.test(content)) {
      drafts.push(buildGoalExtraction(entry, targetDate));
    }
    if (targetDate && FOLLOW_UP_RE.test(content)) {
      drafts.push(buildCalendarExtraction(entry, targetDate));
    } else if (targetDate && /\b(book|schedule|meet|call|review|appointment|for)\b/i.test(content)) {
      drafts.push(buildCalendarExtraction(entry, targetDate));
    }
    if (FOLLOW_UP_RE.test(content)) {
      drafts.push(buildFollowUpExtraction(entry, targetDate));
    }
    if (RESULT_RE.test(content) && !detail.artifacts.some((artifact) => artifact.entry_id === entry.id)) {
      drafts.push({
        chronicle_session_id: entry.session_id,
        chronicle_entry_id: entry.id,
        chronicle_artifact_id: null,
        source_kind: "chronicle_entry",
        kind: "execution_evidence_candidate",
        title: sentenceSummary(content, "Execution evidence candidate"),
        summary: truncate(content, 240),
        source_excerpt: truncate(content, 240),
        confidence: 0.61,
        suggested_target_kind: "execution",
        candidate_payload: {
          evidence_text: truncate(content, 240),
        },
        metadata: {
          matched_rule: "result_language",
          role: entry.role,
        },
      });
    }
  }

  for (const artifact of detail.artifacts) {
    const entry = artifact.entry_id
      ? detail.entries.find((candidate) => candidate.id === artifact.entry_id) ?? null
      : null;
    drafts.push(buildEvidenceExtraction(detail.session.id, artifact, entry?.content ?? null));
  }

  return drafts;
}

export function getChronicleReviewState(sessionId: string): ChronicleReviewState {
  return {
    extractions: listSessionExtractions(sessionId),
    review_items: listSessionReviewItems(sessionId),
    promotion_receipts: listSessionReceipts(sessionId),
  };
}

export function extractChronicleSession(sessionId: string): ChronicleExtractionRun {
  const detail = getChronicleSessionDetail(sessionId);
  const generatedAt = nowIso();
  const extractions = collectExtractionDrafts(detail).map((draft) => createExtraction(draft));
  const reviewItems = extractions.map((extraction) => ensureReviewItem(extraction));

  return chronicleExtractionRunSchema.parse({
    session_id: sessionId,
    generated_at: generatedAt,
    extractions,
    review_items: reviewItems,
  });
}

export function listReviewItems(filter: ListReviewItemsFilter = {}): ReviewItemSummary[] {
  const parsed = listReviewItemsFilterSchema.parse(filter);
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (parsed.status) {
    clauses.push("ri.status = ?");
    params.push(parsed.status);
  }
  if (parsed.session_id) {
    clauses.push("ri.chronicle_session_id = ?");
    params.push(parsed.session_id);
  }
  if (parsed.entry_id) {
    clauses.push("ri.chronicle_entry_id = ?");
    params.push(parsed.entry_id);
  }
  if (parsed.candidate_kind) {
    clauses.push("ri.candidate_kind = ?");
    params.push(parsed.candidate_kind);
  }
  if (parsed.suggested_target_kind) {
    clauses.push("ri.suggested_target_kind = ?");
    params.push(parsed.suggested_target_kind);
  }
  if (parsed.target_kind) {
    clauses.push("ri.target_kind = ?");
    params.push(parsed.target_kind);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(parsed.limit ?? 50, 200));

  const rows = db()
    .prepare(
      `
        SELECT
          ri.*,
          (
            SELECT COUNT(*) FROM promotion_receipts pr
            WHERE pr.review_item_id = ri.id
          ) AS receipt_count,
          (
            SELECT MAX(pr.inserted_at) FROM promotion_receipts pr
            WHERE pr.review_item_id = ri.id
          ) AS last_receipt_at
        FROM review_items ri
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
  const extraction = requireExtraction(item.extraction_id);
  const chronicle = getChronicleSessionDetail(item.chronicle_session_id);
  const entry = item.chronicle_entry_id
    ? chronicle.entries.find((candidate) => candidate.id === item.chronicle_entry_id) ?? null
    : null;
  const artifact = item.chronicle_artifact_id
    ? chronicle.artifacts.find((candidate) => candidate.id === item.chronicle_artifact_id) ?? null
    : null;

  return reviewItemDetailSchema.parse({
    item,
    extraction,
    source: {
      source_kind: extraction.source_kind,
      chronicle_session_id: item.chronicle_session_id,
      chronicle_entry_id: item.chronicle_entry_id,
      chronicle_artifact_id: item.chronicle_artifact_id,
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
      artifact: artifact
        ? {
            id: artifact.id,
            session_id: artifact.session_id,
            entry_id: artifact.entry_id,
            kind: artifact.kind,
            name: artifact.name,
            mime_type: artifact.mime_type,
            stored_path: artifact.stored_path,
            original_path: artifact.original_path,
          }
        : null,
    },
    receipts: listReceiptsForReviewItem(id),
  });
}

export function approveReviewItem(id: string, input: ReviewDecisionInput): ReviewItem {
  return applyDecision(id, "approved", input);
}

export function rejectReviewItem(id: string, input: ReviewDecisionInput): ReviewItem {
  return applyDecision(id, "rejected", input);
}

export function deferReviewItem(id: string, input: ReviewDecisionInput): ReviewItem {
  return applyDecision(id, "deferred", input);
}

function buildReceiptSummary(
  detail: ReviewItemDetail,
  targetKind: ReviewTargetKind,
  targetId: string | null,
  note: string | null,
): string {
  const parts = [
    `Promoted Chronicle review item ${detail.item.id}`,
    `(${detail.item.title})`,
    `to ${buildTargetSummary(targetKind, targetId)}`,
  ];
  if (note) parts.push(`note: ${note}`);
  return truncate(parts.join(" "), 240);
}

function createIntentFromReview(detail: ReviewItemDetail, input: PromoteReviewItemInput): { id: string } {
  const payload = detail.extraction.candidate_payload;
  const title = typeof payload.title === "string" ? payload.title : detail.item.title;
  const suffix = detail.item.id.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6) || "review";
  const intent = createIntent({
    slug: `${slugify(title)}-${suffix}`,
    title,
    description:
      typeof payload.description === "string"
        ? payload.description
        : detail.item.summary ?? detail.item.source_excerpt,
    level: "task",
    status: "draft",
    kind: "planning",
    actor_id: input.actor_id,
    ...(input.project_id ? { project_id: input.project_id } : {}),
    ...(input.space_id ? { space_id: input.space_id } : {}),
    metadata: {
      chronicle_session_id: detail.item.chronicle_session_id,
      chronicle_entry_id: detail.item.chronicle_entry_id,
      chronicle_artifact_id: detail.item.chronicle_artifact_id,
      chronicle_extraction_id: detail.item.extraction_id,
      chronicle_review_item_id: detail.item.id,
    },
  });
  return { id: intent.id };
}

function createGoalFromReview(detail: ReviewItemDetail, input: PromoteReviewItemInput): { id: string } {
  const payload = detail.extraction.candidate_payload;
  const targetDate =
    input.target_date
    ?? (typeof payload.target_date === "string" ? payload.target_date : null)
    ?? null;
  const goal = createGoal({
    title: typeof payload.title === "string" ? payload.title : detail.item.title,
    description:
      typeof payload.description === "string"
        ? payload.description
        : detail.item.summary ?? detail.item.source_excerpt,
    timeframe:
      input.timeframe
      ?? (typeof payload.timeframe === "string" ? payload.timeframe as "weekly" | "monthly" | "quarterly" | "yearly" | "3year" : inferGoalTimeframe(targetDate)),
    owner_kind: input.owner_kind ?? "human",
    owner_id: input.owner_id ?? "owner",
    target_date: targetDate,
    ...(input.project_id ? { project_id: input.project_id } : {}),
    ...(input.space_id ? { space_id: input.space_id } : {}),
    ...(input.intent_slug ? { intent_slug: input.intent_slug } : {}),
    success_criteria: detail.item.summary ?? null,
  });
  return { id: goal.id };
}

function createCalendarEntryFromReview(
  detail: ReviewItemDetail,
  input: PromoteReviewItemInput,
): { id: string } {
  const payload = detail.extraction.candidate_payload;
  const startsAt =
    input.starts_at
    ?? (typeof payload.starts_at === "string" ? payload.starts_at : null)
    ?? (typeof payload.target_date === "string" ? payload.target_date : null);

  if (!startsAt) {
    throw new ReviewStateError(`calendar_promotion_requires_starts_at ${detail.item.id}`);
  }

  const entry = createCalendarEntry({
    title: typeof payload.title === "string" ? payload.title : detail.item.title,
    description:
      typeof payload.description === "string"
        ? payload.description
        : detail.item.summary ?? detail.item.source_excerpt,
    entry_kind: input.entry_kind ?? "human_commitment",
    owner_kind: input.owner_kind ?? "human",
    owner_id: input.owner_id ?? "owner",
    starts_at: startsAt,
    ...(input.ends_at ? { ends_at: input.ends_at } : {}),
    ...(input.project_id ? { project_id: input.project_id } : {}),
    ...(input.space_id ? { space_id: input.space_id } : {}),
    ...(input.intent_slug ? { intent_slug: input.intent_slug } : {}),
    ...(input.execution_id ? { execution_id: input.execution_id } : {}),
  });
  return { id: entry.id };
}

function resolvePromotionTarget(
  detail: ReviewItemDetail,
  rawInput: PromoteReviewItemInput,
): { kind: ReviewTargetKind; id: string | null; mode: PromoteReviewItemInput["mode"] } {
  const input = promoteReviewItemInputSchema.parse(rawInput);

  if (input.to === "intent") {
    if (input.mode !== "create") {
      throw new ReviewStateError(`intent_promotion_requires_create_mode ${detail.item.id}`);
    }
    return { kind: "intent", id: createIntentFromReview(detail, input).id, mode: input.mode };
  }

  if (input.to === "goal") {
    if (input.mode !== "create") {
      throw new ReviewStateError(`goal_promotion_requires_create_mode ${detail.item.id}`);
    }
    return { kind: "goal", id: createGoalFromReview(detail, input).id, mode: input.mode };
  }

  if (input.to === "calendar_entry") {
    if (input.mode !== "create") {
      throw new ReviewStateError(`calendar_promotion_requires_create_mode ${detail.item.id}`);
    }
    return {
      kind: "calendar_entry",
      id: createCalendarEntryFromReview(detail, input).id,
      mode: input.mode,
    };
  }

  if (!input.existing_target_id) {
    throw new ReviewStateError(`execution_promotion_requires_existing_target_id ${detail.item.id}`);
  }

  return {
    kind: "execution",
    id: input.existing_target_id,
    mode: input.mode ?? "attach",
  };
}

export function promoteReviewItem(id: string, rawInput: PromoteReviewItemInput): ReviewItemDetail {
  const item = requireReviewItem(id);
  if (item.status !== "approved") {
    throw new ReviewStateError(`review_item_not_approved ${id} ${item.status}`);
  }

  const detail = getReviewItemDetail(id);
  const input = promoteReviewItemInputSchema.parse(rawInput);
  const target = resolvePromotionTarget(detail, input);
  const timestamp = nowIso();

  const receiptId = nanoid();
  db()
    .prepare(
      `
        INSERT INTO promotion_receipts (
          id,
          review_item_id,
          extraction_id,
          chronicle_session_id,
          chronicle_entry_id,
          chronicle_artifact_id,
          target_kind,
          target_id,
          promotion_mode,
          provenance_summary,
          metadata,
          inserted_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      receiptId,
      item.id,
      item.extraction_id,
      item.chronicle_session_id,
      item.chronicle_entry_id,
      item.chronicle_artifact_id,
      target.kind,
      target.id,
      target.mode,
      buildReceiptSummary(detail, target.kind, target.id, input.note ?? null),
      encode({
        requested_target_kind: input.to,
        promotion_actor_id: input.actor_id,
        review_candidate_kind: item.candidate_kind,
        ...input.metadata,
      }),
      timestamp,
      timestamp,
    );

  db()
    .prepare(
      `
        UPDATE review_items
        SET status = ?, target_kind = ?, target_id = ?, decision_actor_id = ?, decision_note = ?, decided_at = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .run(
      "promoted",
      target.kind,
      target.id,
      input.actor_id,
      input.note ?? item.decision_note,
      timestamp,
      timestamp,
      id,
    );

  updateExtractionStatus(item.extraction_id, "promoted", {
    promoted_to: buildTargetSummary(target.kind, target.id),
    promotion_receipt_id: receiptId,
  });

  return getReviewItemDetail(id);
}
