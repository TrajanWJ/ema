/**
 * Space lifecycle state machine.
 *
 * Valid transitions:
 *
 *   draft    → active
 *   draft    → archived
 *   active   → archived
 *
 * `archived` is terminal. Spaces are never deleted — archive is append-only
 * and transitions accumulate audit rows in `space_transitions`.
 */

export const SPACE_STATUSES = ["draft", "active", "archived"] as const;
export type SpaceStatus = (typeof SPACE_STATUSES)[number];

export const SPACE_TRANSITIONS: Record<SpaceStatus, readonly SpaceStatus[]> = {
  draft: ["active", "archived"],
  active: ["archived"],
  archived: [],
};

export class InvalidSpaceTransitionError extends Error {
  public readonly code = "space_invalid_transition";
  constructor(
    public readonly from: SpaceStatus,
    public readonly to: SpaceStatus,
  ) {
    super(`Invalid space transition: ${from} -> ${to}`);
    this.name = "InvalidSpaceTransitionError";
  }
}

export function canTransition(from: SpaceStatus, to: SpaceStatus): boolean {
  return SPACE_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SpaceStatus, to: SpaceStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidSpaceTransitionError(from, to);
  }
}

export interface SpaceTransitionRecord {
  id: string;
  space_id: string;
  from_status: SpaceStatus;
  to_status: SpaceStatus;
  actor: string;
  reason: string | null;
  happened_at: string;
}
