import { z } from "zod";
import { baseEntitySchema, idSchema } from "./common.js";

/**
 * Space schema — GAC-007 flat MVP.
 *
 * Canon source: `ema-genesis/intents/GAC-007/README.md` recommendation
 * ([D] defer with flat MVP). Round 2-B negative prior art from Mattermost,
 * Rocket.Chat, and Anytype confirmed nesting is the wrong bet for v1.
 * Nested `parent_space_id` / Matrix-style MSC1772 cascade is explicitly
 * deferred to v2 and must not be added here without a new GAC card.
 *
 * Members are stored as an array of actor IDs — roles and ACL chains are
 * out of scope. A space is a flat container of entities keyed by
 * `space_id` on Intent / Proposal / Execution.
 */
export const spaceMemberSchema = z.object({
  actor_id: idSchema,
  role: z.enum(["owner", "member", "viewer"]).default("member"),
});
export type SpaceMember = z.infer<typeof spaceMemberSchema>;

export const spaceSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  members: z.array(spaceMemberSchema).default([]),
  settings: z.record(z.unknown()).default({}),
});
export type Space = z.infer<typeof spaceSchema>;
