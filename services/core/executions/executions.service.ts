/**
 * Executions service — business logic for the executions subservice.
 *
 * Owns:
 *   - CRUD over the `executions` table (the schema defined in
 *     `./executions.schema.ts`, layered on top of the base table in
 *     `services/persistence/db.ts`).
 *   - Append-only phase transition log via `execution_phase_transitions`.
 *   - Per-step checkpoint journal stored as a JSON column on each row.
 *
 * Does NOT own:
 *   - Filesystem reflection of intent folders (Phase 2 — see AGENT-RUNTIME.md).
 *   - Real tmux/pty session recording (Phase 2 — deferred).
 *   - Routing or MCP registration (sibling modules).
 *
 * Follows the Blueprint service pattern: typed errors, an EventEmitter for
 * domain events, and no imports from other `services/core/*` subservices.
 * Real tmux/pty session recording is explicitly out of scope in this file.
 */

import { EventEmitter } from "node:events";

import type Database from "better-sqlite3";
import { nanoid } from "nanoid";

import type { ActorPhase, ExecutionStatus } from "@ema/shared/schemas";

import { getDb } from "../../persistence/db.js";
import { attachExecution, getIntent } from "../intents/service.js";
import { pipeBus } from "../pipes/bus.js";
import { applyExecutionsDdl } from "./executions.schema.js";
import {
  assertPhaseTransition,
  type ExecutionPhaseTransitionRecord,
} from "./state-machine.js";

type DbRow = Record<string, unknown>;

// ---------------------------------------------------------------- types

export interface ExecutionStep {
  label: string;
  note?: string | undefined;
  at: string; // ISO8601
  // Extra free-form fields permitted but opaque — callers cast at the boundary.
  extra?: Record<string, unknown> | undefined;
}

export interface ExecutionRecord {
  id: string;
  title: string;
  objective: string | null;
  mode: string;
  status: ExecutionStatus;
  project_slug: string | null;
  intent_slug: string | null;
  intent_path: string | null;
  result_path: string | null;
  requires_approval: boolean;
  brain_dump_item_id: string | null;
  proposal_id: string | null;
  completed_at: string | null;
  inserted_at: string;
  updated_at: string;
  space_id: string | null;
  progress_log_path: string | null;
  step_journal: ExecutionStep[];
  reflexion_context: string | null;
  current_phase: ActorPhase | null;
  archived_at: string | null;
}

export interface CreateExecutionInput {
  title: string;
  objective?: string | null;
  mode?: string | null;
  status?: ExecutionStatus | string | null;
  requires_approval?: boolean | null;
  brain_dump_item_id?: string | null;
  project_slug?: string | null;
  intent_slug?: string | null;
  intent_path?: string | null;
  proposal_id?: string | null;
  space_id?: string | null;
}

export interface ListExecutionsFilter {
  status?: ExecutionStatus | undefined;
  mode?: string | undefined;
  intent_slug?: string | undefined;
  project_slug?: string | undefined;
  includeArchived?: boolean | undefined;
}

// ---------------------------------------------------------------- events

export type ExecutionEvent =
  | { type: "execution:created"; execution: ExecutionRecord }
  | { type: "execution:updated"; execution: ExecutionRecord }
  | { type: "execution:completed"; execution: ExecutionRecord }
  | { type: "execution:archived"; execution: ExecutionRecord }
  | {
      type: "execution:phase_transitioned";
      execution: ExecutionRecord;
      transition: ExecutionPhaseTransitionRecord;
    }
  | {
      type: "execution:step_appended";
      execution: ExecutionRecord;
      step: ExecutionStep;
    };

export const executionsEvents = new EventEmitter();

// ---------------------------------------------------------------- errors

export class ExecutionNotFoundError extends Error {
  public readonly code = "execution_not_found";
  constructor(public readonly id: string) {
    super(`Execution not found: ${id}`);
    this.name = "ExecutionNotFoundError";
  }
}

// ---------------------------------------------------------------- init

let initialised = false;

export function initExecutions(): void {
  if (initialised) return;
  applyExecutionsDdl(getDb());
  initialised = true;
}

/** For hermetic tests that swap the database between runs. */
export function __resetExecutionsInit(): void {
  initialised = false;
}

// ---------------------------------------------------------------- helpers

function nowIso(): string {
  return new Date().toISOString();
}

function decodeJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toBool(raw: unknown): boolean {
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "boolean") return raw;
  return false;
}

function nullableString(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/**
 * Row → `ExecutionRecord`. Exported so `reflexion.ts` can reuse it without a
 * circular dependency on the full service surface.
 */
export function mapExecutionRow(row: DbRow | undefined): ExecutionRecord | null {
  if (!row) return null;

  const status = (typeof row.status === "string" ? row.status : "created") as ExecutionStatus;
  const phaseRaw = typeof row.current_phase === "string" ? row.current_phase : null;
  const currentPhase = (phaseRaw ?? null) as ActorPhase | null;

  return {
    id: String(row.id),
    title: String(row.title),
    objective: nullableString(row.objective),
    mode: typeof row.mode === "string" ? row.mode : "research",
    status,
    project_slug: nullableString(row.project_slug),
    intent_slug: nullableString(row.intent_slug),
    intent_path: nullableString(row.intent_path),
    result_path: nullableString(row.result_path),
    requires_approval: toBool(row.requires_approval),
    brain_dump_item_id: nullableString(row.brain_dump_item_id),
    proposal_id: nullableString(row.proposal_id),
    completed_at: nullableString(row.completed_at),
    inserted_at:
      typeof row.created_at === "string" ? row.created_at : nowIso(),
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : nowIso(),
    space_id: nullableString(row.space_id),
    progress_log_path: nullableString(row.progress_log_path),
    step_journal: decodeJson<ExecutionStep[]>(row.step_journal, []),
    reflexion_context: nullableString(row.reflexion_context),
    current_phase: currentPhase,
    archived_at: nullableString(row.archived_at),
  };
}

function db(): Database.Database {
  initExecutions();
  return getDb();
}

// ---------------------------------------------------------------- queries

export function listExecutions(filter: ListExecutionsFilter = {}): ExecutionRecord[] {
  const handle = db();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!filter.includeArchived) {
    clauses.push("archived_at IS NULL");
  }
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter.mode) {
    clauses.push("mode = ?");
    params.push(filter.mode);
  }
  if (filter.intent_slug) {
    clauses.push("intent_slug = ?");
    params.push(filter.intent_slug);
  }
  if (filter.project_slug) {
    clauses.push("project_slug = ?");
    params.push(filter.project_slug);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = handle
    .prepare(
      `SELECT * FROM executions ${whereSql} ORDER BY updated_at DESC, created_at DESC`,
    )
    .all(...params) as DbRow[];

  return rows
    .map((row) => mapExecutionRow(row))
    .filter((exec): exec is ExecutionRecord => exec !== null);
}

export function getExecution(id: string): ExecutionRecord | null {
  const handle = db();
  const row = handle
    .prepare("SELECT * FROM executions WHERE id = ?")
    .get(id) as DbRow | undefined;
  return mapExecutionRow(row);
}

function requireExecution(id: string): ExecutionRecord {
  const found = getExecution(id);
  if (!found) throw new ExecutionNotFoundError(id);
  return found;
}

// ---------------------------------------------------------------- mutations

export function createExecution(input: CreateExecutionInput): ExecutionRecord {
  const handle = db();
  const now = nowIso();
  const id = nanoid();
  const requiresApproval = input.requires_approval ?? false;
  const status = (input.status as ExecutionStatus | undefined) ??
    (requiresApproval ? "awaiting_approval" : "created");

  // DEC-007 semantic ↔ operational bridge. Reject dangling references
  // before the insert so the intents table and executions table never
  // disagree about whether an intent exists.
  let intentExists = false;
  if (input.intent_slug) {
    intentExists = getIntent(input.intent_slug) !== null;
    if (!intentExists) {
      throw new Error(`intent_not_found: ${input.intent_slug}`);
    }
  }

  handle
    .prepare(
      `INSERT INTO executions (
         id, title, mode, status, brain_dump_item_id, requires_approval,
         result_summary, created_at, updated_at,
         objective, project_slug, intent_slug, intent_path, proposal_id,
         space_id, step_journal, current_phase
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, '[]', NULL)`,
    )
    .run(
      id,
      input.title,
      input.mode ?? "research",
      status,
      input.brain_dump_item_id ?? null,
      requiresApproval ? 1 : 0,
      now,
      now,
      input.objective ?? null,
      input.project_slug ?? null,
      input.intent_slug ?? null,
      input.intent_path ?? null,
      input.proposal_id ?? null,
      input.space_id ?? null,
    );

  const created = requireExecution(id);

  // Attach the execution to the intent via `intent_links` with the `runtime`
  // relation — the canonical bridge. Fire-and-forget: a failure here must
  // not roll back the execution insert because the operational row is the
  // source of truth and the link is a derived edge. See DEC-007 §Consequences.
  if (input.intent_slug && intentExists) {
    try {
      attachExecution(input.intent_slug, id, "execution");
    } catch {
      // Swallow — future work: dead-letter event for orphan repair.
    }
  }

  // Announce on the pipe bus so cross-subsystem automations
  // (e.g. `executions:created` → tasks:create) can react. Failures are
  // intentionally swallowed — observers must never gate execution creation.
  try {
    pipeBus.trigger("executions:created", {
      execution_id: id,
      intent_slug: input.intent_slug ?? null,
      proposal_id: input.proposal_id ?? null,
      title: input.title,
      status,
    });
  } catch {
    // Swallow — observer failures are non-fatal by design.
  }

  executionsEvents.emit("execution:created", {
    type: "execution:created",
    execution: created,
  } satisfies ExecutionEvent);
  return created;
}

function updateStatus(
  id: string,
  status: ExecutionStatus,
  resultSummary?: string | null,
): ExecutionRecord {
  const handle = db();
  requireExecution(id);
  const now = nowIso();
  handle
    .prepare(
      `UPDATE executions
          SET status = ?,
              result_summary = COALESCE(?, result_summary),
              completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END,
              updated_at = ?
        WHERE id = ?`,
    )
    .run(status, resultSummary ?? null, status, now, now, id);

  const updated = requireExecution(id);
  const eventType =
    status === "completed" ? "execution:completed" : "execution:updated";
  executionsEvents.emit(eventType, {
    type: eventType,
    execution: updated,
  } satisfies ExecutionEvent);
  return updated;
}

export function approveExecution(id: string): ExecutionRecord | null {
  if (!getExecution(id)) return null;
  return updateStatus(id, "approved");
}

export function cancelExecution(id: string): ExecutionRecord | null {
  if (!getExecution(id)) return null;
  return updateStatus(id, "cancelled");
}

export function completeExecution(
  id: string,
  resultSummary?: string | null,
): ExecutionRecord | null {
  if (!getExecution(id)) return null;
  return updateStatus(id, "completed", resultSummary);
}

export function updateExecutionStatus(
  id: string,
  status: ExecutionStatus,
  resultSummary?: string | null,
): ExecutionRecord {
  return updateStatus(id, status, resultSummary);
}

export function archiveExecution(id: string): ExecutionRecord {
  const handle = db();
  requireExecution(id);
  const now = nowIso();
  handle
    .prepare(
      `UPDATE executions SET archived_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(now, now, id);

  const updated = requireExecution(id);
  executionsEvents.emit("execution:archived", {
    type: "execution:archived",
    execution: updated,
  } satisfies ExecutionEvent);
  return updated;
}

// ---------------------------------------------------------------- phases

export interface TransitionPhaseInput {
  to: ActorPhase;
  reason: string;
  summary?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export function transitionPhase(
  id: string,
  input: TransitionPhaseInput,
): {
  execution: ExecutionRecord;
  transition: ExecutionPhaseTransitionRecord;
} {
  const handle = db();
  const existing = requireExecution(id);
  const from = existing.current_phase;
  assertPhaseTransition(from, input.to);

  const now = nowIso();
  const transitionId = nanoid();
  const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

  handle
    .prepare(
      `INSERT INTO execution_phase_transitions (
         id, execution_id, from_phase, to_phase, reason, summary, metadata, transitioned_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      transitionId,
      id,
      from,
      input.to,
      input.reason,
      input.summary ?? null,
      metadataJson,
      now,
    );

  handle
    .prepare(
      `UPDATE executions SET current_phase = ?, updated_at = ? WHERE id = ?`,
    )
    .run(input.to, now, id);

  const updated = requireExecution(id);
  const transition: ExecutionPhaseTransitionRecord = {
    id: transitionId,
    execution_id: id,
    from_phase: from,
    to_phase: input.to,
    reason: input.reason,
    summary: input.summary ?? null,
    metadata: input.metadata ?? null,
    transitioned_at: now,
  };

  executionsEvents.emit("execution:phase_transitioned", {
    type: "execution:phase_transitioned",
    execution: updated,
    transition,
  } satisfies ExecutionEvent);

  return { execution: updated, transition };
}

export function listPhaseTransitions(
  id: string,
): ExecutionPhaseTransitionRecord[] {
  const handle = db();
  const rows = handle
    .prepare(
      `SELECT * FROM execution_phase_transitions
        WHERE execution_id = ?
        ORDER BY transitioned_at ASC`,
    )
    .all(id) as DbRow[];

  return rows.map((row) => ({
    id: String(row.id),
    execution_id: String(row.execution_id),
    from_phase: (typeof row.from_phase === "string"
      ? row.from_phase
      : null) as ActorPhase | null,
    to_phase: String(row.to_phase) as ActorPhase,
    reason: String(row.reason),
    summary: typeof row.summary === "string" ? row.summary : null,
    metadata:
      typeof row.metadata === "string"
        ? decodeJson<Record<string, unknown> | null>(row.metadata, null)
        : null,
    transitioned_at: String(row.transitioned_at),
  }));
}

// ---------------------------------------------------------------- step journal

export function appendStep(
  id: string,
  step: Omit<ExecutionStep, "at"> & { at?: string },
): ExecutionRecord {
  const handle = db();
  const existing = requireExecution(id);
  const stamped: ExecutionStep = {
    label: step.label,
    ...(step.note !== undefined ? { note: step.note } : {}),
    ...(step.extra !== undefined ? { extra: step.extra } : {}),
    at: step.at ?? nowIso(),
  };
  const next = [...existing.step_journal, stamped];
  const now = nowIso();
  handle
    .prepare(
      `UPDATE executions SET step_journal = ?, updated_at = ? WHERE id = ?`,
    )
    .run(JSON.stringify(next), now, id);

  const updated = requireExecution(id);
  executionsEvents.emit("execution:step_appended", {
    type: "execution:step_appended",
    execution: updated,
    step: stamped,
  } satisfies ExecutionEvent);
  return updated;
}

export function getStepJournal(id: string): ExecutionStep[] {
  const existing = requireExecution(id);
  return existing.step_journal;
}
