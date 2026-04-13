/**
 * Agent runtime heartbeat — GAC-003 resolution [D], worker side.
 *
 * The classifier + poller type-source-of-truth lives in
 * `services/core/actors/runtime-classifier.ts` and operates on a
 * `RuntimeSnapshot`. This file is the out-of-process harness that:
 *
 *   1. Owns the registry of live agent pty targets (pluggable — the pty
 *      wrapper canon in `AGENT-RUNTIME.md` is not yet built, so today the
 *      registry is empty and ticks are cheap no-ops).
 *   2. Runs the classifier on every registered target once per interval.
 *   3. Detects state transitions and forwards them to
 *      `POST /api/agents/runtime-transition` on the services daemon, which
 *      validates the payload and re-broadcasts it on the Phoenix-protocol
 *      WebSocket bus (topic `agents:runtime`, event `state_transition`).
 *
 * Because `workers/` runs in a separate Node process from `@ema/services`,
 * we cannot import the in-process `broadcast()` function directly. The
 * HTTP hop is the deliberate seam. When pty targets land, they register
 * here via `registerAgentTarget()`.
 *
 * The classifier logic is intentionally duplicated inline (small, pure)
 * so this worker stays within its own workspace boundary — `@ema/workers`
 * does not currently depend on `@ema/shared`. The canonical source for
 * the 7-state enum is still `shared/schemas/actor-phase.ts`; this file
 * mirrors the literal values and must stay in sync with it.
 */

import type { Worker } from "./worker-manager.js";

// --- Runtime-state enum (mirrors shared/schemas/actor-phase.ts) ---------

export type AgentRuntimeState =
  | "working"
  | "idle"
  | "blocked"
  | "error"
  | "context-full"
  | "paused"
  | "crashed";

// --- Target adapter seam ------------------------------------------------

export interface RuntimeSnapshot {
  paneTail: string;
  processAlive: boolean;
  lastByteAt: number;
  now: number;
  userPaused: boolean;
}

export interface AgentTarget {
  actorId: string;
  getSnapshot(): Promise<RuntimeSnapshot> | RuntimeSnapshot;
}

const targets = new Map<string, AgentTarget>();
const lastStates = new Map<string, AgentRuntimeState>();

export function registerAgentTarget(target: AgentTarget): void {
  targets.set(target.actorId, target);
}

export function unregisterAgentTarget(actorId: string): void {
  targets.delete(actorId);
  lastStates.delete(actorId);
}

// --- Classifier (mirror of services/core/actors/runtime-classifier.ts) --

const DEFAULT_IDLE_TIMEOUT_MS = 5_000;

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

function classify(snapshot: RuntimeSnapshot): AgentRuntimeState {
  if (!snapshot.processAlive) return "crashed";
  if (snapshot.userPaused) return "paused";
  if (CONTEXT_FULL_PATTERNS.some((re) => re.test(snapshot.paneTail)))
    return "context-full";
  if (ERROR_PATTERNS.some((re) => re.test(snapshot.paneTail))) return "error";
  if (BLOCKED_PATTERNS.some((re) => re.test(snapshot.paneTail)))
    return "blocked";
  const silent = snapshot.now - snapshot.lastByteAt;
  return silent >= DEFAULT_IDLE_TIMEOUT_MS ? "idle" : "working";
}

// --- Transition forwarder ----------------------------------------------

const SERVICES_BASE_URL =
  process.env["EMA_SERVICES_URL"] ?? "http://127.0.0.1:4488";

async function forwardTransition(
  actorId: string,
  fromState: AgentRuntimeState | null,
  toState: AgentRuntimeState,
  observedAt: number,
): Promise<void> {
  try {
    await fetch(`${SERVICES_BASE_URL}/api/agents/runtime-transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_id: actorId,
        from_state: fromState,
        to_state: toState,
        reason: fromState === null ? `initial observation: ${toState}` : `${fromState} → ${toState}`,
        observed_at: new Date(observedAt).toISOString(),
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[agent-runtime-heartbeat] forward failed for ${actorId}: ${msg}`);
  }
}

// --- Worker lifecycle --------------------------------------------------

const HEARTBEAT_INTERVAL_MS = Number(
  process.env["EMA_HEARTBEAT_INTERVAL_MS"] ?? "1000",
);

async function tick(): Promise<void> {
  if (targets.size === 0) return;
  for (const target of targets.values()) {
    try {
      const snapshot = await target.getSnapshot();
      const next = classify(snapshot);
      const prev = lastStates.get(target.actorId) ?? null;
      if (next !== prev) {
        lastStates.set(target.actorId, next);
        await forwardTransition(target.actorId, prev, next, snapshot.now);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[agent-runtime-heartbeat] snapshot failed for ${target.actorId}: ${msg}`,
      );
    }
  }
}

/**
 * Seed the target registry with one synthetic target so the full wire —
 * classifier → state change → HTTP POST → services router → WebSocket
 * broadcast — is exercised end-to-end at every boot. The target polls
 * `/api/intents?status=active` and reports `working` whenever there is
 * any active intent, `idle` otherwise. It is intentionally coarse: its
 * value is proving the wire runs, not classifying real pane content.
 * Real pty targets (the Codeman-shaped runtime) plug in via
 * `registerAgentTarget()` once `canon/specs/AGENT-RUNTIME.md` ships.
 */
function registerSystemBootstrapTarget(): void {
  const actorId = "system:bootstrap";
  let lastActiveObservedAt = Date.now();

  registerAgentTarget({
    actorId,
    async getSnapshot(): Promise<RuntimeSnapshot> {
      const now = Date.now();
      let activeIntents = 0;
      try {
        const res = await fetch(
          `${SERVICES_BASE_URL}/api/intents?status=active`,
        );
        if (res.ok) {
          const body = (await res.json()) as { intents?: unknown[] };
          activeIntents = Array.isArray(body.intents) ? body.intents.length : 0;
        }
      } catch {
        // Services unreachable — treat as no-activity this tick.
      }
      if (activeIntents > 0) lastActiveObservedAt = now;
      return {
        paneTail: `[bootstrap] active_intents=${activeIntents}`,
        processAlive: true,
        lastByteAt: lastActiveObservedAt,
        now,
        userPaused: false,
      };
    },
  });
}

export function createAgentRuntimeHeartbeat(): Worker {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    name: "agent-runtime-heartbeat",
    async start(): Promise<void> {
      registerSystemBootstrapTarget();
      timer = setInterval(() => void tick(), HEARTBEAT_INTERVAL_MS);
    },
    async stop(): Promise<void> {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      targets.clear();
      lastStates.clear();
    },
  };
}
