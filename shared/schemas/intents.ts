import { z } from "zod";
import {
  baseEntitySchema,
  emaLinksField,
  idSchema,
  spaceIdField,
} from "./common.js";

export const intentLevelSchema = z.enum([
  "vision",
  "strategy",
  "objective",
  "initiative",
  "execution",
  "task",
]);

export const intentStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "abandoned",
]);

/**
 * Intent kind (GAC-004 resolution [D]).
 *
 * Orthogonal to `level` and `status`. Gates the kind-aware requirement for
 * `exit_condition` and `scope` — required on `implement` and `port`, optional
 * (with a warning at the service layer) for exploratory kinds.
 *
 * Optional at the schema level so legacy intents written before GAC-004
 * still parse. The service layer SHOULD backfill `kind` on read where it
 * can be inferred.
 */
export const intentKindSchema = z.enum([
  "implement",
  "port",
  "research",
  "explore",
  "planning",
  "brain_dump",
]);
export type IntentKind = z.infer<typeof intentKindSchema>;

/**
 * Intent kinds for which `exit_condition` and `scope` are mandatory.
 * Source: `ema-genesis/intents/GAC-004/README.md` resolution.
 */
export const INTENT_KINDS_REQUIRING_EXIT_CONDITION = [
  "implement",
  "port",
] as const satisfies readonly IntentKind[];

export const intentSchema = baseEntitySchema.extend({
  title: z.string(),
  description: z.string().nullable(),
  level: intentLevelSchema,
  status: intentStatusSchema,
  parent_id: idSchema.nullable(),
  project_id: idSchema.nullable(),
  actor_id: idSchema.nullable(),
  metadata: z.record(z.unknown()),
  /**
   * GAC-004: Intent kind. Optional for backwards compatibility with
   * pre-GAC-004 intents. New intents SHOULD set this.
   */
  kind: intentKindSchema.optional(),
  /**
   * GAC-004: How the system knows this intent is complete. Required at
   * the service layer for `kind in INTENT_KINDS_REQUIRING_EXIT_CONDITION`,
   * optional otherwise. Kept optional in the base Zod schema so existing
   * intents still parse — see `validateIntentForKind` for enforcement.
   */
  exit_condition: z.string().optional(),
  /**
   * GAC-004: File globs this intent is permitted to touch. Enforced at
   * dispatch/write time by the Dispatcher's wrapped tool layer. Kept
   * optional in the base schema for backwards compatibility.
   */
  scope: z.array(z.string()).optional(),
  /** GAC-007 flat-MVP space containment. Nesting is explicitly v2. */
  space_id: spaceIdField,
  /** GAC-005 typed edges. See `common.ts` for the grammar and edge-type set. */
  ema_links: emaLinksField,
});

export type Intent = z.infer<typeof intentSchema>;

/**
 * Kind-aware validator for the GAC-004 mandatory fields.
 *
 * Returns `{ ok: false, missing: [...] }` if the intent's `kind` is in
 * `INTENT_KINDS_REQUIRING_EXIT_CONDITION` and any of the required fields
 * are absent or empty. Returns `{ ok: true, missing: [] }` otherwise.
 *
 * The service layer calls this at intent creation and before dispatch.
 * Intents without a `kind` field (legacy) pass — the service layer may
 * upgrade them separately.
 */
export function validateIntentForKind(
  intent: Intent,
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (
    intent.kind !== undefined &&
    (INTENT_KINDS_REQUIRING_EXIT_CONDITION as readonly IntentKind[]).includes(
      intent.kind,
    )
  ) {
    if (intent.exit_condition === undefined || intent.exit_condition === "") {
      missing.push("exit_condition");
    }
    if (intent.scope === undefined || intent.scope.length === 0) {
      missing.push("scope");
    }
  }
  return { ok: missing.length === 0, missing };
}
