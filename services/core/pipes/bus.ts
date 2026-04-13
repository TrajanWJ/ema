/**
 * PipeBus — Node `EventEmitter` wrapper for trigger/subscribe fan-out.
 *
 * Replaces the old Elixir `Phoenix.PubSub` layer. Every domain service that
 * fires a lifecycle event (brain_dump, tasks, proposals, ...) calls
 * `pipeBus.trigger(name, payload)`, and the executor subscribes to dispatch
 * every matching enabled pipe.
 */

import { EventEmitter } from "node:events";
import type { PipeBusEvent, PipeBusHandler, TriggerName } from "./types.js";

const KEY = "pipe:event";

export class PipeBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  trigger(trigger: TriggerName, payload: unknown): void {
    const event: PipeBusEvent = { trigger, payload };
    this.emitter.emit(KEY, event);
  }

  subscribe(handler: PipeBusHandler): () => void {
    this.emitter.on(KEY, handler);
    return () => {
      this.emitter.off(KEY, handler);
    };
  }

  /** Test-only — wipe every listener. */
  reset(): void {
    this.emitter.removeAllListeners(KEY);
  }
}

/** Process-wide singleton. Domain services import this directly. */
export const pipeBus = new PipeBus();
