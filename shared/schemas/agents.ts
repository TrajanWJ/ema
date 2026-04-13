import { z } from "zod";
import { baseEntitySchema, idSchema } from "./common.js";

export const agentStatusSchema = z.enum(["active", "paused", "disabled"]);

export const agentSchema = baseEntitySchema.extend({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  model: z.string(),
  temperature: z.number().default(0.7),
  system_prompt: z.string().nullable(),
  tools: z.array(z.string()),
  status: agentStatusSchema,
  actor_id: idSchema.nullable(),
  settings: z.record(z.unknown()),
  /**
   * GAC-008 stub. Nullable-optional so v1 rows parse. When the P2P identity
   * layer (HALO-style, per DXOS) ships in v2, existing agents get a pubkey
   * generated locally on first sync and the field becomes populated — the
   * migration is additive because the schema already tolerates null.
   * Leaving this field absent is legal; do not introduce validation that
   * requires it before v2 identity work begins.
   */
  identity_pubkey: z.string().optional(),
  /**
   * GAC-010 stub. References the most recent `user_state` row for this
   * agent/actor. Kept as an optional opaque ID so nothing downstream
   * depends on the UserState observer pipeline existing yet. The Blueprint
   * Planner aspiration-detection loop will populate this field; until
   * then, readers MUST tolerate `undefined`.
   */
  current_state_id: idSchema.optional(),
});
