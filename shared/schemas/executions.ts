import { z } from "zod";
import {
  baseEntitySchema,
  emaLinksField,
  idSchema,
  spaceIdField,
  timestampSchema,
} from "./common.js";

/**
 * Execution schema — minimal Zod mirror of `ExecutionRecord` in
 * `services/core/executions/executions.service.ts`. The service currently
 * writes a hand-rolled row shape directly against SQLite; this schema is
 * the canonical contract new code should depend on and exists so GAC-005
 * (typed edges) and GAC-007 (flat-MVP space containment) can attach to
 * executions without a second migration.
 *
 * The service-layer row shape is a superset; this schema is the shared
 * surface the SDK and vApps consume.
 */
export const executionStatusSchema = z.enum([
  "created",
  "awaiting_approval",
  "approved",
  "running",
  "completed",
  "cancelled",
  "failed",
]);
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;

export const executionSchema = baseEntitySchema.extend({
  title: z.string(),
  objective: z.string().nullable(),
  mode: z.string(),
  status: executionStatusSchema,
  project_slug: z.string().nullable(),
  intent_slug: z.string().nullable(),
  intent_path: z.string().nullable(),
  result_path: z.string().nullable(),
  requires_approval: z.boolean(),
  brain_dump_item_id: idSchema.nullable(),
  proposal_id: idSchema.nullable(),
  completed_at: timestampSchema.nullable(),
  /** GAC-007 flat-MVP space containment. */
  space_id: spaceIdField,
  /** GAC-005 typed edges. */
  ema_links: emaLinksField,
});
export type Execution = z.infer<typeof executionSchema>;
