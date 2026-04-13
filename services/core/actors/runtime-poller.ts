/**
 * In-process runtime-state poller — GAC-003 resolution [D].
 *
 * Holds a set of registered targets (one per live agent) and ticks on a
 * fixed interval. Each tick asks every target for a `RuntimeSnapshot`,
 * classifies it, and — when the state has changed since the last tick —
 * publishes a transition event via the injected `onTransition` callback.
 *
 * Intentionally decoupled from pty, node-cron, and the realtime bus:
 *
 * - `RuntimeTarget.getSnapshot` is the pty adapter seam. The pty wrapper
 *   hasn't been written yet (see `canon/specs/AGENT-RUNTIME.md`); when it
 *   is, it plugs into `registerTarget` without touching the classifier.
 * - The poller runs inside whichever process owns this module. In-process
 *   callers in `services/` can subscribe directly; out-of-process workers
 *   forward transitions back via the HTTP endpoint in `routes.ts`.
 */

import {
  type AgentRuntimeState,
} from "@ema/shared/schemas";

import {
  classifyRuntimeState,
  type RuntimeSnapshot,
} from "./runtime-classifier.js";

export interface RuntimeTarget {
  actorId: string;
  getSnapshot(): Promise<RuntimeSnapshot> | RuntimeSnapshot;
}

export interface RuntimeTransition {
  actorId: string;
  fromState: AgentRuntimeState | null;
  toState: AgentRuntimeState;
  reason: string;
  observedAt: string;
}

export interface RuntimePollerOptions {
  intervalMs?: number;
  idleTimeoutMs?: number;
  onTransition?: (transition: RuntimeTransition) => void;
  onError?: (actorId: string, err: unknown) => void;
}

const DEFAULT_INTERVAL_MS = 1_000;

interface ResolvedOptions {
  intervalMs: number;
  idleTimeoutMs: number;
  onTransition: ((transition: RuntimeTransition) => void) | null;
  onError: ((actorId: string, err: unknown) => void) | null;
}

export class RuntimePoller {
  private readonly targets = new Map<string, RuntimeTarget>();
  private readonly lastState = new Map<string, AgentRuntimeState>();
  private readonly options: ResolvedOptions;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RuntimePollerOptions = {}) {
    this.options = {
      intervalMs: options.intervalMs ?? DEFAULT_INTERVAL_MS,
      idleTimeoutMs: options.idleTimeoutMs ?? 5_000,
      onTransition: options.onTransition ?? null,
      onError: options.onError ?? null,
    };
  }

  registerTarget(target: RuntimeTarget): void {
    this.targets.set(target.actorId, target);
  }

  unregisterTarget(actorId: string): void {
    this.targets.delete(actorId);
    this.lastState.delete(actorId);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Run a single tick manually. Exposed for tests and for the worker-manager
   * harness that wraps the poller lifecycle.
   */
  async tick(): Promise<void> {
    for (const target of this.targets.values()) {
      try {
        const snapshot = await target.getSnapshot();
        const nextState = classifyRuntimeState(snapshot, {
          idleTimeoutMs: this.options.idleTimeoutMs,
        });
        const prevState = this.lastState.get(target.actorId) ?? null;
        if (nextState !== prevState) {
          this.lastState.set(target.actorId, nextState);
          this.options.onTransition?.call(null, {
            actorId: target.actorId,
            fromState: prevState,
            toState: nextState,
            reason: this.buildReason(prevState, nextState),
            observedAt: new Date(snapshot.now).toISOString(),
          });
        }
      } catch (err) {
        this.options.onError?.call(null, target.actorId, err);
      }
    }
  }

  private buildReason(
    from: AgentRuntimeState | null,
    to: AgentRuntimeState,
  ): string {
    if (from === null) return `initial observation: ${to}`;
    return `${from} → ${to}`;
  }
}

/**
 * Module-level singleton so in-process callers (blueprint, pipes, etc.) can
 * `import { runtimePoller } from "../actors"` without passing the instance
 * around. The worker-manager harness in `workers/` maintains its own poller
 * because it runs in a separate process.
 */
export const runtimePoller = new RuntimePoller();
