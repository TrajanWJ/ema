/**
 * Cross-pollination entry schema.
 *
 * Records when a user-level fact learned in one project is transplanted to
 * another project's context, with a rationale. This is EMA's implementation of
 * Honcho's cross-context learning, ported from the old Elixir
 * `Ema.Memory.CrossPollination` module.
 */

import { z } from "zod";

export const crossPollinationEntrySchema = z.object({
  id: z.string().min(1),
  fact: z.string().min(1),
  source_project: z.string().min(1),
  target_project: z.string().min(1),
  rationale: z.string().min(1),
  applied_at: z.string().datetime(),
  actor_id: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).default([]),
});

export type CrossPollinationEntry = z.infer<typeof crossPollinationEntrySchema>;
