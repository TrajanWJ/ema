/**
 * Pipes voice + visibility helpers.
 *
 * - `pipeLog` — EMA-VOICE-compliant console log (directive, present-tense).
 * - `emitPipeActionEvent` — best-effort VisibilityHub notification so the
 *   Ambient strip can see pipe activity. Uses a lazy dynamic import so the
 *   pipes package does not hard-couple to visibility; if the import throws
 *   the call becomes a no-op.
 */

import type { ActionContext } from "./types.js";

const LOG_TAG = "[pipes]";

export function pipeLog(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`${LOG_TAG} ${message}`);
}

export function pipeWarn(message: string): void {
  // eslint-disable-next-line no-console
  console.warn(`${LOG_TAG} ${message}`);
}

interface MinimalHub {
  startTopic: (
    topic: {
      id: string;
      kind: "pipe";
      label: string;
      metadata?: Record<string, unknown>;
      state?: "starting" | "active";
    },
    message?: string,
  ) => unknown;
  endTopic: (
    id: string,
    finalState: "completed" | "error" | "cancelled",
    message?: string,
  ) => unknown;
}

let cachedHub: MinimalHub | null | undefined;

async function loadHub(): Promise<MinimalHub | null> {
  if (cachedHub !== undefined) return cachedHub;
  try {
    const mod = (await import("../visibility/index.js")) as {
      visibilityHub?: MinimalHub;
    };
    cachedHub = mod.visibilityHub ?? null;
  } catch {
    cachedHub = null;
  }
  return cachedHub;
}

/**
 * Best-effort fire-and-forget pipe activity event. Starts and immediately
 * ends a `pipe` topic with state `completed`; callers who want long-lived
 * topics should talk to the hub directly.
 */
export function emitPipeActionEvent(
  ctx: ActionContext,
  actionName: string,
  detail: unknown,
): void {
  void (async () => {
    const hub = await loadHub();
    if (!hub) return;
    const topicId = `pipe:${ctx.pipeId}:${ctx.runId}:${actionName}`;
    try {
      hub.startTopic(
        {
          id: topicId,
          kind: "pipe",
          label: `pipe ${ctx.pipeId} → ${actionName}`,
          metadata: { trigger: ctx.trigger, detail },
          state: "active",
        },
        `pipe action ${actionName} firing`,
      );
      hub.endTopic(topicId, "completed", `pipe action ${actionName} done`);
    } catch {
      // Visibility is best-effort; never let it break a pipe run.
    }
  })();
}
