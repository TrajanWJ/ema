/**
 * Agent runtime-state classifier — GAC-003 resolution [D].
 *
 * Pure function that maps a terminal-output snapshot + timing metadata to
 * one of the seven runtime states defined in
 * `shared/schemas/actor-phase.ts` (`agentRuntimeStateSchema`):
 *
 *   working | idle | blocked | error | context-full | paused | crashed
 *
 * Heuristics ported in spirit (not in code) from agent_farm's adaptive
 * pane-content classifier and Ark0N/Codeman's 6-layer terminal stream.
 * Runtime-state is orthogonal to actor work-phase (idle/plan/execute/...):
 * both axes are emitted independently. See actor-phase.ts for the phase
 * axis and its append-only log.
 *
 * This module owns NO I/O. The pty adapter layer feeds snapshots in; the
 * poller runs the classifier and compares against the last known state to
 * decide whether a transition event should fire. The classifier is pure
 * so it is trivially unit-testable without any pty, WS, or DB plumbing.
 */

import {
  type AgentRuntimeState,
  agentRuntimeStateSchema,
} from "@ema/shared/schemas";

export interface RuntimeSnapshot {
  /** Most recent N lines of terminal output from the agent's pty pane. */
  paneTail: string;
  /** Whether the underlying process is still alive according to the OS. */
  processAlive: boolean;
  /** Timestamp of the last observed byte on the pty, milliseconds since epoch. */
  lastByteAt: number;
  /** Current wall clock in the poller tick, milliseconds since epoch. */
  now: number;
  /** Whether the user has explicitly paused this agent from the UI. */
  userPaused: boolean;
}

/**
 * Milliseconds after the last pty byte at which a live, non-paused agent
 * is considered "idle" rather than "working". Adaptive per agent eventually;
 * today this is a fixed default the poller can override.
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 5_000;

const CONTEXT_FULL_PATTERNS = [
  /context.{0,20}limit/i,
  /token.{0,20}limit/i,
  /max_tokens/i,
  /compact(?:ion)? (?:required|needed)/i,
];

const BLOCKED_PATTERNS = [
  /awaiting (?:approval|input|confirmation)/i,
  /press (?:enter|return) to continue/i,
  /\[y\/n\]/i,
  /paused for (?:approval|review)/i,
];

const ERROR_PATTERNS = [
  /\bfatal\b/i,
  /\btraceback\b/i,
  /\buncaught exception\b/i,
  /\bpanic:\b/i,
  /\bsegmentation fault\b/i,
];

export interface ClassifyOptions {
  idleTimeoutMs?: number;
}

export function classifyRuntimeState(
  snapshot: RuntimeSnapshot,
  opts: ClassifyOptions = {},
): AgentRuntimeState {
  if (!snapshot.processAlive) return "crashed";
  if (snapshot.userPaused) return "paused";

  const tail = snapshot.paneTail;

  if (CONTEXT_FULL_PATTERNS.some((re) => re.test(tail))) return "context-full";
  if (ERROR_PATTERNS.some((re) => re.test(tail))) return "error";
  if (BLOCKED_PATTERNS.some((re) => re.test(tail))) return "blocked";

  const idleTimeout = opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const silentFor = snapshot.now - snapshot.lastByteAt;
  return silentFor >= idleTimeout ? "idle" : "working";
}

/**
 * Validate a string against the canonical Zod enum. Used by the HTTP route
 * that receives transitions from out-of-process workers — if a worker sends
 * a state that isn't in the v1 enum, reject rather than broadcast.
 */
export function isAgentRuntimeState(value: unknown): value is AgentRuntimeState {
  return agentRuntimeStateSchema.safeParse(value).success;
}
