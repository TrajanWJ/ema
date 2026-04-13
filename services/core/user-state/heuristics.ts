/**
 * UserState heuristics — pure functions that convert signal streams into
 * `mode` / `distress_flag` decisions.
 *
 * Crude v1 rules, explicitly documented so they're testable from both sides
 * (signals → distress, signals → mode) and overridable by self-report.
 *
 * Rules in force (all thresholds exported so tests and future tuning can
 * address them by name):
 *
 *   1. **Distress raised.** Three or more `agent_blocked` signals within a
 *      rolling five-minute window → `distress_flag = true`, `mode = crisis`.
 *   2. **Distress raised (self).** A single `self_report_overwhelm` signal
 *      → `distress_flag = true`, `mode = crisis`.
 *   3. **Distress cleared.** A `self_report_flow` or `agent_recovered` signal
 *      clears the flag and moves to `focused` (flow) or `scattered`
 *      (recovered) respectively.
 *   4. **Drift bump.** Each `drift_detected` inside the window pushes the
 *      mode toward `scattered`; three within the window also set
 *      `drift_score = 1.0`. Drift alone does not raise distress.
 *   5. **Idle.** An `idle_timeout` moves the mode to `resting`.
 *
 * Everything here is deterministic and stateless — the caller supplies the
 * relevant signal history + the previous snapshot and gets back a next-state
 * proposal. The service layer is responsible for clock + persistence.
 */

import type {
  UserStateMode,
  UserStateSignal,
  UserStateSignalKind,
  UserStateSnapshot,
} from "@ema/shared/schemas";

/** Rolling window for agent_blocked aggregation. */
export const DISTRESS_WINDOW_MS = 5 * 60 * 1000;

/** How many blocks inside the window raise distress. */
export const DISTRESS_BLOCK_THRESHOLD = 3;

/** How many drift events inside the window saturate drift_score to 1.0. */
export const DRIFT_SATURATION_THRESHOLD = 3;

export interface HeuristicInput {
  readonly previous: UserStateSnapshot;
  readonly signal: UserStateSignal;
  readonly history: readonly UserStateSignal[]; // most recent first
  readonly now: string; // ISO timestamp
}

export interface HeuristicResult {
  readonly next: UserStateSnapshot;
  /** Short, lowercase. Used as the transition reason on the snapshot row. */
  readonly reason: string;
  /** Raised to the event bus so Visibility can surface a crisis topic. */
  readonly distressTransition: "raised" | "cleared" | "unchanged";
}

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function countWithin(
  history: readonly UserStateSignal[],
  kind: UserStateSignalKind,
  nowMs: number,
  windowMs: number,
): number {
  let n = 0;
  for (const s of history) {
    if (s.kind !== kind) continue;
    const at = s.at ? toMs(s.at) : nowMs;
    if (nowMs - at <= windowMs) n += 1;
  }
  return n;
}

/**
 * Compute the next snapshot given a signal + the recent history.
 *
 * `history` should include the current signal; the service appends before
 * calling so the counting rules see it.
 */
export function applySignal(input: HeuristicInput): HeuristicResult {
  const { previous, signal, history, now } = input;
  const nowMs = toMs(now);

  const base: UserStateSnapshot = {
    ...previous,
    updated_at: now,
    updated_by: "heuristic",
  };

  switch (signal.kind) {
    case "self_report_overwhelm": {
      const next: UserStateSnapshot = {
        ...base,
        mode: "crisis",
        distress_flag: true,
      };
      return {
        next,
        reason: "self_report_overwhelm",
        distressTransition: previous.distress_flag ? "unchanged" : "raised",
      };
    }

    case "self_report_flow": {
      const next: UserStateSnapshot = {
        ...base,
        mode: "focused",
        distress_flag: false,
      };
      return {
        next,
        reason: "self_report_flow",
        distressTransition: previous.distress_flag ? "cleared" : "unchanged",
      };
    }

    case "agent_blocked": {
      const blocks = countWithin(
        history,
        "agent_blocked",
        nowMs,
        DISTRESS_WINDOW_MS,
      );
      if (blocks >= DISTRESS_BLOCK_THRESHOLD) {
        const next: UserStateSnapshot = {
          ...base,
          mode: "crisis",
          distress_flag: true,
        };
        return {
          next,
          reason: `agent_blocked_x${blocks}`,
          distressTransition: previous.distress_flag ? "unchanged" : "raised",
        };
      }
      const softMode: UserStateMode =
        previous.mode === "unknown" ? "scattered" : previous.mode;
      const next: UserStateSnapshot = { ...base, mode: softMode };
      return {
        next,
        reason: `agent_blocked_x${blocks}`,
        distressTransition: "unchanged",
      };
    }

    case "agent_recovered": {
      const cleared = previous.distress_flag;
      const next: UserStateSnapshot = {
        ...base,
        mode: cleared ? "scattered" : previous.mode,
        distress_flag: false,
      };
      return {
        next,
        reason: "agent_recovered",
        distressTransition: cleared ? "cleared" : "unchanged",
      };
    }

    case "drift_detected": {
      const drifts = countWithin(
        history,
        "drift_detected",
        nowMs,
        DISTRESS_WINDOW_MS,
      );
      const driftScore =
        drifts >= DRIFT_SATURATION_THRESHOLD
          ? 1
          : Math.min(1, drifts / DRIFT_SATURATION_THRESHOLD);
      const next: UserStateSnapshot = {
        ...base,
        mode: previous.distress_flag ? previous.mode : "scattered",
        drift_score: driftScore,
      };
      return {
        next,
        reason: `drift_detected_x${drifts}`,
        distressTransition: "unchanged",
      };
    }

    case "idle_timeout": {
      const next: UserStateSnapshot = { ...base, mode: "resting" };
      return {
        next,
        reason: "idle_timeout",
        distressTransition: "unchanged",
      };
    }

    case "task_completed": {
      const next: UserStateSnapshot = {
        ...base,
        drift_score: 0,
        mode: previous.distress_flag ? previous.mode : "focused",
      };
      return {
        next,
        reason: "task_completed",
        distressTransition: "unchanged",
      };
    }

    default: {
      // Exhaustiveness: the switch covers every `UserStateSignalKind`.
      const _exhaustive: never = signal.kind;
      void _exhaustive;
      return {
        next: base,
        reason: "unknown_signal",
        distressTransition: "unchanged",
      };
    }
  }
}
