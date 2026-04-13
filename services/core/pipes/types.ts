/**
 * Pipes types — Triggers, Actions, Transforms, Pipe, PipeRun.
 *
 * Ported verbatim from `Ema.Pipes.Registry` (Elixir) with the same registry
 * identifiers. See `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/pipes/registry.ex`
 * and `ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md` §A.3.
 *
 * Pipes connect a domain trigger ("brain_dump:item_created") through zero or
 * more transforms ("filter", "map", ...) to an action ("tasks:create").
 *
 * Voice: registry labels + descriptions follow EMA-VOICE — directive,
 * present-tense, no emojis.
 */

import type { ZodTypeAny } from "zod";

// --- name unions ---------------------------------------------------------

export type TriggerName = `${string}:${string}`;

/** Action names are mostly `${context}:${verb}` but `transform` and `branch`
 * ship as bare names to match the Elixir registry. */
export type ActionName = string;

export type TransformName =
  | "filter"
  | "map"
  | "delay"
  | "claude"
  | "conditional";

// --- registry entry shapes -----------------------------------------------

export interface TriggerDef {
  readonly name: TriggerName;
  readonly context: string;
  readonly eventType: string;
  readonly label: string;
  readonly description: string;
  readonly payloadSchema: ZodTypeAny;
}

export interface ActionContext {
  readonly pipeId: string;
  readonly runId: string;
  readonly trigger: TriggerName;
  readonly now: () => Date;
}

export interface ActionDef {
  readonly name: ActionName;
  readonly context: string;
  readonly label: string;
  readonly description: string;
  readonly inputSchema: ZodTypeAny;
  readonly outputSchema: ZodTypeAny;
  readonly handler: (
    input: unknown,
    ctx: ActionContext,
  ) => Promise<unknown>;
}

export interface TransformDef {
  readonly name: TransformName;
  readonly label: string;
  readonly description: string;
  readonly apply: (
    payload: unknown,
    config: unknown,
  ) => Promise<TransformResult>;
}

/**
 * Transform outcome — transforms can reshape the payload or halt execution
 * (filter drops, conditional short-circuits).
 */
export interface TransformResult {
  readonly payload: unknown;
  readonly halted: boolean;
  readonly reason?: string;
}

// --- pipe + run records --------------------------------------------------

export interface PipeTransformStep {
  readonly name: TransformName;
  readonly config: unknown;
}

export interface Pipe {
  readonly id: string;
  readonly name: string;
  readonly trigger: TriggerName;
  readonly action: ActionName;
  readonly transforms: readonly PipeTransformStep[];
  readonly enabled: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export type PipeRunStatus = "running" | "completed" | "halted" | "failed";

export interface PipeRun {
  readonly id: string;
  readonly pipe_id: string;
  readonly trigger: TriggerName;
  readonly status: PipeRunStatus;
  readonly input: unknown;
  readonly output?: unknown;
  readonly error?: string;
  readonly halted_reason?: string;
  readonly started_at: string;
  readonly finished_at?: string;
  readonly duration_ms?: number;
}

// --- bus -----------------------------------------------------------------

export interface PipeBusEvent {
  readonly trigger: TriggerName;
  readonly payload: unknown;
}

export type PipeBusHandler = (event: PipeBusEvent) => void | Promise<void>;
