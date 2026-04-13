import { z } from "zod";

/**
 * GACCard — Genesis/Assumption/Clarification card.
 *
 * Canonical source: `ema-genesis/canon/specs/BLUEPRINT-PLANNER.md` §Data Models.
 * Implementation decision: `ema-genesis/canon/decisions/DEC-004-gac-card-backend.md`.
 *
 * A GACCard is a structured design question with pre-filled options.
 * The queue represents the system's open design gaps. Once answered, a card
 * triggers a `result_action` (create canon, create intent, update node, defer
 * to a blocker).
 *
 * Field names match `BLUEPRINT-PLANNER.md` §Data Models verbatim. Do not
 * rename without a DEC update.
 */

export const gacCardIdSchema = z
  .string()
  .regex(/^GAC-\d{3,}$/u, "GACCard id must match GAC-NNN (three or more digits)");

export const gacStatusSchema = z.enum([
  "pending",
  "answered",
  "deferred",
  "promoted",
]);

export const gacCategorySchema = z.enum([
  "gap",
  "assumption",
  "clarification",
]);

export const gacPrioritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

export const gacResultActionTypeSchema = z.enum([
  "create_canon",
  "create_intent",
  "update_node",
  "defer_to_blocker",
]);

export const gacOptionSchema = z.object({
  label: z.string().min(1),
  text: z.string().min(1),
  implications: z.string(),
});

export const gacAnswerSchema = z.object({
  selected: z.string().nullable(),
  freeform: z.string().optional(),
  answered_by: z.string().min(1),
  answered_at: z.string().datetime({ offset: true }),
});

export const gacResultActionSchema = z.object({
  type: gacResultActionTypeSchema,
  target: z.string().optional(),
});

export const gacConnectionSchema = z.object({
  target: z.string().min(1),
  relation: z.string().min(1),
});

export const gacContextSchema = z.object({
  related_nodes: z.array(z.string()).optional(),
  section: z.string().optional(),
});

export const gacCardSchema = z.object({
  id: gacCardIdSchema,
  type: z.literal("gac_card"),
  layer: z.literal("intents"),
  title: z.string().min(1),
  status: gacStatusSchema,
  created: z.string().datetime({ offset: true }),
  updated: z.string().datetime({ offset: true }),
  answered_at: z.string().datetime({ offset: true }).optional(),
  answered_by: z.string().optional(),
  author: z.string().min(1),
  category: gacCategorySchema,
  priority: gacPrioritySchema,
  question: z.string().min(1),
  options: z.array(gacOptionSchema),
  answer: gacAnswerSchema.optional(),
  result_action: gacResultActionSchema.optional(),
  connections: z.array(gacConnectionSchema).default([]),
  context: gacContextSchema.optional(),
  tags: z.array(z.string()).default([]),
});

export type GacCard = z.infer<typeof gacCardSchema>;
export type GacStatus = z.infer<typeof gacStatusSchema>;
export type GacCategory = z.infer<typeof gacCategorySchema>;
export type GacPriority = z.infer<typeof gacPrioritySchema>;
export type GacOption = z.infer<typeof gacOptionSchema>;
export type GacAnswer = z.infer<typeof gacAnswerSchema>;
export type GacResultAction = z.infer<typeof gacResultActionSchema>;
export type GacConnection = z.infer<typeof gacConnectionSchema>;
export type GacContext = z.infer<typeof gacContextSchema>;

/**
 * Valid state transitions enforced by the Blueprint service.
 *
 * `pending` is the only legal source for a terminal transition. Once a card
 * is `answered`, `deferred`, or `promoted`, it does not transition again —
 * further changes append new transition rows via the audit log only.
 */
export const GAC_TRANSITIONS = {
  pending: ["answered", "deferred", "promoted"],
  answered: [],
  deferred: [],
  promoted: [],
} as const satisfies Record<GacStatus, readonly GacStatus[]>;
