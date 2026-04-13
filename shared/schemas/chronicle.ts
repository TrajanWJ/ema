import { z } from "zod";

import { baseEntitySchema, idSchema, timestampSchema } from "./common.js";
import {
  chronicleExtractionSchema,
  promotionReceiptSchema,
  reviewItemSchema,
} from "./review.js";

const metadataSchema = z.record(z.string(), z.unknown());

export const chronicleSourceKindSchema = z.enum([
  "manual",
  "import",
  "claude",
  "codex",
  "cursor",
  "shell",
  "cli",
  "tool",
  "system",
]);

export const chronicleSessionStatusSchema = z.enum(["imported", "normalized"]);

export const chronicleEntryRoleSchema = z.enum([
  "user",
  "assistant",
  "system",
  "tool",
  "unknown",
]);

export const chronicleEntryKindSchema = z.enum([
  "message",
  "note",
  "trace",
  "command",
  "event",
]);

export const chronicleArtifactKindSchema = z.enum([
  "attachment",
  "log",
  "image",
  "export",
  "file",
]);

export const chronicleSourceSchema = baseEntitySchema.extend({
  kind: chronicleSourceKindSchema,
  label: z.string().min(1),
  machine_id: z.string().nullable(),
  provenance_root: z.string().nullable(),
});

export const chronicleSessionSchema = baseEntitySchema.extend({
  source_id: idSchema,
  external_id: z.string().nullable(),
  title: z.string().min(1),
  summary: z.string().nullable(),
  project_hint: z.string().nullable(),
  status: chronicleSessionStatusSchema,
  imported_at: timestampSchema,
  started_at: timestampSchema.nullable(),
  ended_at: timestampSchema.nullable(),
  provenance_path: z.string().nullable(),
  raw_path: z.string().min(1),
  entry_count: z.number().int().nonnegative(),
  artifact_count: z.number().int().nonnegative(),
  metadata: metadataSchema,
});

export const chronicleEntrySchema = z.object({
  id: idSchema,
  session_id: idSchema,
  external_id: z.string().nullable(),
  ordinal: z.number().int().nonnegative(),
  occurred_at: timestampSchema.nullable(),
  role: chronicleEntryRoleSchema,
  kind: chronicleEntryKindSchema,
  content: z.string(),
  metadata: metadataSchema,
  inserted_at: timestampSchema,
});

export const chronicleArtifactSchema = z.object({
  id: idSchema,
  session_id: idSchema,
  entry_id: idSchema.nullable(),
  kind: chronicleArtifactKindSchema,
  name: z.string().min(1),
  mime_type: z.string().nullable(),
  stored_path: z.string().min(1),
  original_path: z.string().nullable(),
  size_bytes: z.number().int().nonnegative(),
  metadata: metadataSchema,
  inserted_at: timestampSchema,
});

export const chronicleSessionSummarySchema = chronicleSessionSchema.extend({
  source_kind: chronicleSourceKindSchema,
  source_label: z.string().min(1),
});

export const chronicleSessionDetailSchema = z.object({
  source: chronicleSourceSchema,
  session: chronicleSessionSchema,
  entries: z.array(chronicleEntrySchema),
  artifacts: z.array(chronicleArtifactSchema),
  extractions: z.array(chronicleExtractionSchema).default([]),
  review_items: z.array(reviewItemSchema).default([]),
  promotion_receipts: z.array(promotionReceiptSchema).default([]),
});

export const chronicleImportSourceInputSchema = z.object({
  id: z.string().min(1).optional(),
  kind: chronicleSourceKindSchema,
  label: z.string().min(1),
  machine_id: z.string().nullable().optional(),
  provenance_root: z.string().nullable().optional(),
});

export const chronicleImportEntryInputSchema = z.object({
  external_id: z.string().min(1).optional(),
  occurred_at: timestampSchema.nullable().optional(),
  role: chronicleEntryRoleSchema.optional().default("unknown"),
  kind: chronicleEntryKindSchema.optional().default("message"),
  content: z.string(),
  metadata: metadataSchema.optional().default({}),
});

export const chronicleImportArtifactInputSchema = z.object({
  name: z.string().min(1),
  kind: chronicleArtifactKindSchema.optional().default("attachment"),
  mime_type: z.string().nullable().optional(),
  source_path: z.string().nullable().optional(),
  text_content: z.string().nullable().optional(),
  metadata: metadataSchema.optional().default({}),
  entry_index: z.number().int().nonnegative().optional(),
}).refine(
  (value) =>
    (typeof value.source_path === "string" && value.source_path.length > 0)
    || (typeof value.text_content === "string"),
  {
    message: "artifact requires source_path or text_content",
  },
);

export const chronicleImportSessionInputSchema = z.object({
  external_id: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().nullable().optional(),
  project_hint: z.string().nullable().optional(),
  started_at: timestampSchema.nullable().optional(),
  ended_at: timestampSchema.nullable().optional(),
  provenance_path: z.string().nullable().optional(),
  metadata: metadataSchema.optional().default({}),
  entries: z.array(chronicleImportEntryInputSchema).default([]),
  artifacts: z.array(chronicleImportArtifactInputSchema).default([]),
  raw_payload: z.unknown().optional(),
});

export const createChronicleImportInputSchema = z.object({
  source: chronicleImportSourceInputSchema,
  session: chronicleImportSessionInputSchema,
});

export type ChronicleSourceKind = z.infer<typeof chronicleSourceKindSchema>;
export type ChronicleSessionStatus = z.infer<typeof chronicleSessionStatusSchema>;
export type ChronicleEntryRole = z.infer<typeof chronicleEntryRoleSchema>;
export type ChronicleEntryKind = z.infer<typeof chronicleEntryKindSchema>;
export type ChronicleArtifactKind = z.infer<typeof chronicleArtifactKindSchema>;
export type ChronicleSource = z.infer<typeof chronicleSourceSchema>;
export type ChronicleSession = z.infer<typeof chronicleSessionSchema>;
export type ChronicleEntry = z.infer<typeof chronicleEntrySchema>;
export type ChronicleArtifact = z.infer<typeof chronicleArtifactSchema>;
export type ChronicleSessionSummary = z.infer<typeof chronicleSessionSummarySchema>;
export type ChronicleSessionDetail = z.infer<typeof chronicleSessionDetailSchema>;
export type ChronicleImportSourceInput = z.infer<typeof chronicleImportSourceInputSchema>;
export type ChronicleImportEntryInput = z.infer<typeof chronicleImportEntryInputSchema>;
export type ChronicleImportArtifactInput = z.infer<typeof chronicleImportArtifactInputSchema>;
export type ChronicleImportSessionInput = z.infer<typeof chronicleImportSessionInputSchema>;
export type CreateChronicleImportInput = z.infer<typeof createChronicleImportInputSchema>;
