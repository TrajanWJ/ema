/**
 * Execution phase state machine.
 *
 * Canon: `ema-genesis/canon/decisions/DEC-005-actor-phases.md`. The phase
 * vocabulary and allowed-forward map live in `@ema/shared/schemas/actor-phase`
 * as `PHASE_TRANSITIONS`. This module wraps the map in an assertion helper
 * and exposes a typed error the router translates to HTTP 422.
 *
 * Transitions are append-only. A "back to plan" from `execute` is itself a
 * new forward-recorded row in `execution_phase_transitions`, never an UPDATE
 * and never a DELETE. The service-layer mutation paths enforce this by
 * construction — they only INSERT.
 *
 * The initial transition (null → idle) is always legal; it is how an
 * execution first enters the phase log.
 */

import {
  PHASE_TRANSITIONS,
  type ActorPhase,
} from "@ema/shared/schemas";

export class InvalidPhaseTransitionError extends Error {
  public readonly code = "invalid_phase_transition";
  constructor(
    public readonly from: ActorPhase | null,
    public readonly to: ActorPhase,
  ) {
    super(
      `Invalid execution phase transition: ${from ?? "(null)"} -> ${to}`,
    );
    this.name = "InvalidPhaseTransitionError";
  }
}

export function canTransitionPhase(
  from: ActorPhase | null,
  to: ActorPhase,
): boolean {
  if (from === null) {
    // First row into the log — only `idle` is legal, matching DEC-005.
    return to === "idle";
  }
  const allowed = PHASE_TRANSITIONS[from] as readonly ActorPhase[];
  return allowed.includes(to);
}

export function assertPhaseTransition(
  from: ActorPhase | null,
  to: ActorPhase,
): void {
  if (!canTransitionPhase(from, to)) {
    throw new InvalidPhaseTransitionError(from, to);
  }
}

export interface ExecutionPhaseTransitionRecord {
  id: string;
  execution_id: string;
  from_phase: ActorPhase | null;
  to_phase: ActorPhase;
  reason: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  transitioned_at: string;
}
