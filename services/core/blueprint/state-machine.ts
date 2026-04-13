/**
 * GACCard state machine.
 *
 * Valid transitions (per DEC-004 §3):
 *
 *   pending → answered
 *   pending → deferred
 *   pending → promoted
 *
 * Anything else is rejected. Transitions are append-only — terminal states
 * never re-transition, they only accumulate audit rows.
 */

import { GAC_TRANSITIONS, type GacStatus } from "@ema/shared/schemas";

export class InvalidTransitionError extends Error {
  public readonly code = "gac_invalid_transition";
  constructor(
    public readonly from: GacStatus,
    public readonly to: GacStatus,
  ) {
    super(`Invalid GAC transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: GacStatus, to: GacStatus): boolean {
  const allowed = GAC_TRANSITIONS[from];
  return (allowed as readonly GacStatus[]).includes(to);
}

export function assertTransition(from: GacStatus, to: GacStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export interface GacTransitionRecord {
  id: string;
  card_id: string;
  from_status: GacStatus;
  to_status: GacStatus;
  actor: string;
  reason: string | null;
  happened_at: string;
}
