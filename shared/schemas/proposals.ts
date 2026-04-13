/**
 * Legacy renderer-era proposal schema.
 *
 * Keep this only for compatibility surfaces that still expect queue-oriented
 * proposal view models. The active durable backend contract lives in
 * `shared/schemas/proposal.ts` and is served by `/api/proposals`.
 */
import { z } from "zod";
import {
  baseEntitySchema,
  emaLinksField,
  idSchema,
  spaceIdField,
} from "./common.js";

export const proposalStatusSchema = z.enum([
  "generating",
  "refining",
  "debating",
  "tagging",
  "queued",
  "approved",
  "redirected",
  "killed",
  "cancelled",
]);

export const proposalSchema = baseEntitySchema.extend({
  title: z.string(),
  body: z.string(),
  status: proposalStatusSchema,
  confidence: z.number().min(0).max(1).nullable(),
  generation: z.number().default(1),
  parent_proposal_id: idSchema.nullable(),
  seed_id: idSchema.nullable(),
  project_id: idSchema.nullable(),
  tags: z.array(z.string()),
  benefits: z.array(z.string()),
  risks: z.array(z.string()),
  /** GAC-007 flat-MVP space containment. */
  space_id: spaceIdField,
  /** GAC-005 typed edges. */
  ema_links: emaLinksField,
});
