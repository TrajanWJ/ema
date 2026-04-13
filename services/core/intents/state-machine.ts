/**
 * Intent phase state machine.
 *
 * Phases are the DEC-005 actor work lifecycle (`idle|plan|execute|review|retro`),
 * reused here because an intent is "what the actor is doing" and the actor's
 * phase IS the intent's phase at any moment. `PHASE_TRANSITIONS` in
 * `@ema/shared/schemas` is the canonical allowed-transition map — we reuse it
 * so the service layer and the actor runtime agree.
 *
 * Append-only: every phase change writes a row to `intent_phase_transitions`.
 * An intent may skip forward (e.g. `idle → execute`) but "rewinding" is itself
 * a new forward transition, not an undo.
 */

import {
  actorPhaseSchema,
  PHASE_TRANSITIONS,
  type ActorPhase,
} from "@ema/shared/schemas";

export type IntentPhase = ActorPhase;
export { actorPhaseSchema as intentPhaseSchema };

export class InvalidIntentPhaseTransitionError extends Error {
  public readonly code = "intent_invalid_phase_transition";
  constructor(
    public readonly from: IntentPhase | null,
    public readonly to: IntentPhase,
  ) {
    super(
      `Invalid intent phase transition: ${from ?? "<initial>"} -> ${to}`,
    );
    this.name = "InvalidIntentPhaseTransitionError";
  }
}

/**
 * A null `from` means this is the initial phase-entry for an intent that had
 * no previously-recorded phase (e.g. a cold-boot parse of an intent whose
 * markdown declares `phase: execute`). Initial entries are always permitted.
 */
export function canTransition(
  from: IntentPhase | null,
  to: IntentPhase,
): boolean {
  if (from === null) return true;
  if (from === to) return true;
  const allowed = PHASE_TRANSITIONS[from];
  return (allowed as readonly IntentPhase[]).includes(to);
}

export function assertTransition(
  from: IntentPhase | null,
  to: IntentPhase,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidIntentPhaseTransitionError(from, to);
  }
}

export interface IntentPhaseTransitionRecord {
  id: string;
  intent_slug: string;
  from_phase: IntentPhase | null;
  to_phase: IntentPhase;
  reason: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  transitioned_at: string;
}
