import { z } from "zod";

import { calendarEntryKindSchema } from "./calendar.js";
import { baseEntitySchema, idSchema, timestampSchema } from "./common.js";
import { goalOwnerKindSchema, goalTimeframeSchema } from "./goals.js";

const metadataSchema = z.record(z.string(), z.unknown());
const confidenceSchema = z.number().min(0).max(1);

export const reviewSourceKindSchema = z.enum([
  "chronicle_session",
  "chronicle_entry",
  "chronicle_artifact",
]);

export const chronicleExtractionKindSchema = z.enum([
  "intent_candidate",
  "goal_candidate",
  "calendar_candidate",
  "execution_evidence_candidate",
  "follow_up_candidate",
  "project_link_candidate",
]);

export const chronicleExtractionStatusSchema = z.enum([
  "pending",
  "reviewed",
  "promoted",
  "superseded",
]);

export const reviewItemStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "deferred",
  "promoted",
  "superseded",
]);

export const reviewTargetKindSchema = z.enum([
  "intent",
  "goal",
  "calendar_entry",
  "execution",
]);

// Backwards-compatible export name used by older consumers.
export const promotionTargetKindSchema = reviewTargetKindSchema;

export const promotionModeSchema = z.enum([
  "create",
  "link",
  "attach",
  "record",
]);

export const chronicleExtractionSchema = baseEntitySchema.extend({
  chronicle_session_id: idSchema,
  chronicle_entry_id: idSchema.nullable(),
  chronicle_artifact_id: idSchema.nullable(),
  source_kind: reviewSourceKindSchema,
  kind: chronicleExtractionKindSchema,
  status: chronicleExtractionStatusSchema,
  fingerprint: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  source_excerpt: z.string().nullable(),
  confidence: confidenceSchema.nullable(),
  suggested_target_kind: reviewTargetKindSchema.nullable(),
  candidate_payload: metadataSchema,
  metadata: metadataSchema,
});

export const reviewItemSchema = baseEntitySchema.extend({
  extraction_id: idSchema,
  chronicle_session_id: idSchema,
  chronicle_entry_id: idSchema.nullable(),
  chronicle_artifact_id: idSchema.nullable(),
  candidate_kind: chronicleExtractionKindSchema,
  status: reviewItemStatusSchema,
  title: z.string().min(1),
  summary: z.string().nullable(),
  source_excerpt: z.string().nullable(),
  confidence: confidenceSchema.nullable(),
  suggested_target_kind: reviewTargetKindSchema.nullable(),
  target_kind: reviewTargetKindSchema.nullable(),
  target_id: z.string().nullable(),
  decision_actor_id: z.string().nullable(),
  decision_note: z.string().nullable(),
  decided_at: timestampSchema.nullable(),
  metadata: metadataSchema,
});

export const promotionReceiptSchema = baseEntitySchema.extend({
  review_item_id: idSchema,
  extraction_id: idSchema.nullable(),
  chronicle_session_id: idSchema,
  chronicle_entry_id: idSchema.nullable(),
  chronicle_artifact_id: idSchema.nullable(),
  target_kind: reviewTargetKindSchema,
  target_id: z.string().nullable(),
  promotion_mode: promotionModeSchema,
  provenance_summary: z.string().nullable(),
  metadata: metadataSchema,
});

export const reviewItemSummarySchema = reviewItemSchema.extend({
  receipt_count: z.number().int().nonnegative(),
  last_receipt_at: timestampSchema.nullable(),
});

export const reviewChronicleSessionSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  summary: z.string().nullable(),
  status: z.string().min(1),
  imported_at: timestampSchema,
});

export const reviewChronicleEntrySchema = z.object({
  id: idSchema,
  session_id: idSchema,
  ordinal: z.number().int().nonnegative(),
  occurred_at: timestampSchema.nullable(),
  role: z.string().min(1),
  kind: z.string().min(1),
  content: z.string(),
});

export const reviewChronicleArtifactSchema = z.object({
  id: idSchema,
  session_id: idSchema,
  entry_id: idSchema.nullable(),
  kind: z.string().min(1),
  name: z.string().min(1),
  mime_type: z.string().nullable(),
  stored_path: z.string().min(1),
  original_path: z.string().nullable(),
});

export const reviewSourceLinkSchema = z.object({
  source_kind: reviewSourceKindSchema,
  chronicle_session_id: idSchema,
  chronicle_entry_id: idSchema.nullable(),
  chronicle_artifact_id: idSchema.nullable(),
});

export const reviewItemDetailSchema = z.object({
  item: reviewItemSchema,
  extraction: chronicleExtractionSchema,
  source: reviewSourceLinkSchema,
  chronicle: z.object({
    session: reviewChronicleSessionSchema,
    entry: reviewChronicleEntrySchema.nullable(),
    artifact: reviewChronicleArtifactSchema.nullable(),
  }),
  receipts: z.array(promotionReceiptSchema),
});

export const listReviewItemsFilterSchema = z.object({
  status: reviewItemStatusSchema.optional(),
  session_id: idSchema.optional(),
  entry_id: idSchema.optional(),
  candidate_kind: chronicleExtractionKindSchema.optional(),
  suggested_target_kind: reviewTargetKindSchema.optional(),
  target_kind: reviewTargetKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const reviewDecisionInputSchema = z.object({
  actor_id: z.string().min(1),
  rationale: z.string().min(1).nullable().optional(),
  metadata: metadataSchema.optional().default({}),
});

export const promoteReviewItemInputSchema = z.object({
  to: reviewTargetKindSchema,
  actor_id: z.string().min(1),
  note: z.string().min(1).nullable().optional(),
  mode: promotionModeSchema.optional().default("create"),
  existing_target_id: z.string().min(1).nullable().optional(),
  owner_kind: goalOwnerKindSchema.optional(),
  owner_id: z.string().min(1).optional(),
  timeframe: goalTimeframeSchema.optional(),
  target_date: timestampSchema.nullable().optional(),
  starts_at: timestampSchema.optional(),
  ends_at: timestampSchema.nullable().optional(),
  entry_kind: calendarEntryKindSchema.optional(),
  project_id: z.string().min(1).nullable().optional(),
  space_id: z.string().min(1).nullable().optional(),
  intent_slug: z.string().min(1).nullable().optional(),
  execution_id: z.string().min(1).nullable().optional(),
  metadata: metadataSchema.optional().default({}),
});

export const chronicleExtractionRunSchema = z.object({
  session_id: idSchema,
  generated_at: timestampSchema,
  extractions: z.array(chronicleExtractionSchema),
  review_items: z.array(reviewItemSchema),
});

export type ReviewSourceKind = z.infer<typeof reviewSourceKindSchema>;
export type ChronicleExtractionKind = z.infer<typeof chronicleExtractionKindSchema>;
export type ChronicleExtractionStatus = z.infer<typeof chronicleExtractionStatusSchema>;
export type ReviewItemStatus = z.infer<typeof reviewItemStatusSchema>;
export type ReviewTargetKind = z.infer<typeof reviewTargetKindSchema>;
export type PromotionTargetKind = ReviewTargetKind;
export type PromotionMode = z.infer<typeof promotionModeSchema>;
export type ChronicleExtraction = z.infer<typeof chronicleExtractionSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type PromotionReceipt = z.infer<typeof promotionReceiptSchema>;
export type ReviewItemSummary = z.infer<typeof reviewItemSummarySchema>;
export type ReviewChronicleSession = z.infer<typeof reviewChronicleSessionSchema>;
export type ReviewChronicleEntry = z.infer<typeof reviewChronicleEntrySchema>;
export type ReviewChronicleArtifact = z.infer<typeof reviewChronicleArtifactSchema>;
export type ReviewSourceLink = z.infer<typeof reviewSourceLinkSchema>;
export type ReviewItemDetail = z.infer<typeof reviewItemDetailSchema>;
export type ListReviewItemsFilter = z.input<typeof listReviewItemsFilterSchema>;
export type ReviewDecisionInput = z.input<typeof reviewDecisionInputSchema>;
export type PromoteReviewItemInput = z.input<typeof promoteReviewItemInputSchema>;
export type ChronicleExtractionRun = z.infer<typeof chronicleExtractionRunSchema>;
