/**
 * Pipes executor — orchestrates a single run from trigger payload through
 * transforms into the action handler, recording a `pipe_run` row for every
 * invocation.
 *
 * `attachPipeBusExecutor` subscribes the executor to the process-wide
 * `pipeBus` so domain services get fan-out for free. Tests run
 * `executePipe` directly against a pipe record.
 */

import { nanoid } from "nanoid";

import { pipeBus, type PipeBus } from "./bus.js";
import { registry } from "./registry.js";
import {
  finishPipeRun,
  listPipes,
  startPipeRun,
} from "./service.js";
import type {
  ActionContext,
  Pipe,
  PipeRun,
  TransformResult,
  TriggerName,
} from "./types.js";
import { pipeLog, pipeWarn } from "./voice.js";

export interface ExecutePipeOptions {
  trigger?: TriggerName;
}

/**
 * Run a single pipe against a payload end-to-end.
 *
 * 1. Validate the trigger payload against the registry schema (warn-only,
 *    since payloads are typically `passthrough()`).
 * 2. Apply every transform in order; a halted transform ends the run with
 *    status `"halted"`.
 * 3. Invoke the action handler; any throw ends the run with status
 *    `"failed"` and the error message.
 * 4. Persist the outcome via `finishPipeRun` and return the final row.
 */
export async function executePipe(
  pipe: Pipe,
  payload: unknown,
  options: ExecutePipeOptions = {},
): Promise<PipeRun> {
  const trigger = options.trigger ?? pipe.trigger;
  const run = startPipeRun({
    pipeId: pipe.id,
    trigger,
    input: payload,
  });

  const triggerDef = registry.getTrigger(trigger);
  if (triggerDef) {
    const parsed = triggerDef.payloadSchema.safeParse(payload);
    if (!parsed.success) {
      pipeWarn(
        `pipe ${pipe.id} trigger ${trigger} payload failed schema: ${parsed.error.message}`,
      );
    }
  }

  let working: unknown = payload;
  for (const step of pipe.transforms) {
    const def = registry.getTransform(step.name);
    if (!def) {
      return finishPipeRun({
        runId: run.id,
        status: "failed",
        error: `unknown transform: ${step.name}`,
      });
    }
    let result: TransformResult;
    try {
      result = await def.apply(working, step.config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return finishPipeRun({
        runId: run.id,
        status: "failed",
        error: `transform ${step.name} failed: ${message}`,
      });
    }
    working = result.payload;
    if (result.halted) {
      pipeLog(
        `pipe ${pipe.id} halted at transform ${step.name}: ${result.reason ?? "no reason"}`,
      );
      return finishPipeRun({
        runId: run.id,
        status: "halted",
        output: working,
        ...(result.reason !== undefined ? { haltedReason: result.reason } : {}),
      });
    }
  }

  const actionDef = registry.getAction(pipe.action);
  if (!actionDef) {
    return finishPipeRun({
      runId: run.id,
      status: "failed",
      error: `unknown action: ${pipe.action}`,
    });
  }

  const ctx: ActionContext = {
    pipeId: pipe.id,
    runId: run.id,
    trigger,
    now: () => new Date(),
  };

  try {
    const output = await actionDef.handler(working, ctx);
    return finishPipeRun({
      runId: run.id,
      status: "completed",
      output,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pipeWarn(`pipe ${pipe.id} action ${pipe.action} failed: ${message}`);
    return finishPipeRun({
      runId: run.id,
      status: "failed",
      error: message,
    });
  }
}

/**
 * Subscribe the executor to a bus so every trigger fires every matching
 * enabled pipe. Returns an unsubscribe fn. Idempotent per bus instance —
 * callers track their own subscription.
 */
export function attachPipeBusExecutor(bus: PipeBus = pipeBus): () => void {
  return bus.subscribe(async (event) => {
    const pipes = listPipes({ trigger: event.trigger, enabled: true });
    for (const pipe of pipes) {
      try {
        await executePipe(pipe, event.payload, { trigger: event.trigger });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        pipeWarn(
          `executor crashed on pipe ${pipe.id} (${nanoid(6)}): ${message}`,
        );
      }
    }
  });
}
