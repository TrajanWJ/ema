/**
 * Pipes service — CRUD over `pipes` + `pipe_runs`.
 *
 * Depends only on the persistence layer and the schema. The executor reads
 * + writes through this module to stay decoupled from SQL.
 */

import { nanoid } from "nanoid";

import { getDb } from "../../persistence/db.js";
import { applyPipesDdl } from "./schema.js";
import { registry } from "./registry.js";
import type {
  ActionName,
  Pipe,
  PipeRun,
  PipeRunStatus,
  PipeTransformStep,
  TransformName,
  TriggerName,
} from "./types.js";

type DbRow = Record<string, unknown>;

let initialised = false;

export function initPipes(): void {
  if (initialised) return;
  applyPipesDdl(getDb());
  initialised = true;
}

/** Test hook — force a re-init against a freshly mocked db. */
export function resetPipesInitFlag(): void {
  initialised = false;
}

// -- (de)serialisation -----------------------------------------------------

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function decode<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapPipeRow(row: DbRow | undefined): Pipe | null {
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    trigger: String(row.trigger) as TriggerName,
    action: String(row.action) as ActionName,
    transforms: decode<PipeTransformStep[]>(row.transforms, []),
    enabled: String(row.enabled ?? "1") === "1",
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapRunRow(row: DbRow | undefined): PipeRun | null {
  if (!row) return null;
  const base = {
    id: String(row.id),
    pipe_id: String(row.pipe_id),
    trigger: String(row.trigger) as TriggerName,
    status: String(row.status) as PipeRunStatus,
    input: decode<unknown>(row.input, null),
    started_at: String(row.started_at),
  };
  const run: PipeRun = {
    ...base,
    ...(typeof row.output === "string" && row.output.length > 0
      ? { output: decode<unknown>(row.output, null) }
      : {}),
    ...(typeof row.error === "string" ? { error: row.error } : {}),
    ...(typeof row.halted_reason === "string"
      ? { halted_reason: row.halted_reason }
      : {}),
    ...(typeof row.finished_at === "string"
      ? { finished_at: row.finished_at }
      : {}),
    ...(typeof row.duration_ms === "string"
      ? { duration_ms: Number.parseInt(row.duration_ms, 10) }
      : {}),
  };
  return run;
}

// -- CRUD ------------------------------------------------------------------

export interface CreatePipeInput {
  name: string;
  trigger: TriggerName;
  action: ActionName;
  transforms?: readonly { name: TransformName; config?: unknown }[];
  enabled?: boolean;
}

export class InvalidPipeError extends Error {
  public readonly code = "invalid_pipe";
  constructor(message: string) {
    super(message);
    this.name = "InvalidPipeError";
  }
}

export class PipeNotFoundError extends Error {
  public readonly code = "pipe_not_found";
  constructor(public readonly id: string) {
    super(`pipe not found: ${id}`);
    this.name = "PipeNotFoundError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createPipe(input: CreatePipeInput): Pipe {
  initPipes();
  if (!registry.hasTrigger(input.trigger)) {
    throw new InvalidPipeError(`unknown trigger: ${input.trigger}`);
  }
  if (!registry.hasAction(input.action)) {
    throw new InvalidPipeError(`unknown action: ${input.action}`);
  }
  const transforms: PipeTransformStep[] = (input.transforms ?? []).map((t) => {
    if (!registry.hasTransform(t.name)) {
      throw new InvalidPipeError(`unknown transform: ${t.name}`);
    }
    return { name: t.name, config: t.config ?? {} };
  });

  const id = `pipe-${nanoid(10)}`;
  const now = nowIso();
  const pipe: Pipe = {
    id,
    name: input.name,
    trigger: input.trigger,
    action: input.action,
    transforms,
    enabled: input.enabled ?? true,
    created_at: now,
    updated_at: now,
  };

  const db = getDb();
  db.prepare(
    `INSERT INTO pipes (id, name, trigger, action, transforms, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    pipe.id,
    pipe.name,
    pipe.trigger,
    pipe.action,
    encode(pipe.transforms),
    pipe.enabled ? "1" : "0",
    pipe.created_at,
    pipe.updated_at,
  );
  return pipe;
}

export interface ListPipesFilter {
  trigger?: TriggerName;
  enabled?: boolean;
}

export function listPipes(filter: ListPipesFilter = {}): Pipe[] {
  initPipes();
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.trigger) {
    clauses.push("trigger = ?");
    params.push(filter.trigger);
  }
  if (filter.enabled !== undefined) {
    clauses.push("enabled = ?");
    params.push(filter.enabled ? "1" : "0");
  }
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM pipes ${whereSql} ORDER BY created_at DESC`)
    .all(...params) as DbRow[];
  return rows
    .map((row) => mapPipeRow(row))
    .filter((p): p is Pipe => p !== null);
}

export function getPipe(id: string): Pipe | null {
  initPipes();
  const row = getDb().prepare("SELECT * FROM pipes WHERE id = ?").get(id) as
    | DbRow
    | undefined;
  return mapPipeRow(row);
}

export function togglePipe(id: string, enabled: boolean): Pipe {
  initPipes();
  const existing = getPipe(id);
  if (!existing) throw new PipeNotFoundError(id);
  const now = nowIso();
  getDb()
    .prepare(
      "UPDATE pipes SET enabled = ?, updated_at = ? WHERE id = ?",
    )
    .run(enabled ? "1" : "0", now, id);
  return { ...existing, enabled, updated_at: now };
}

export function deletePipe(id: string): void {
  initPipes();
  const existing = getPipe(id);
  if (!existing) throw new PipeNotFoundError(id);
  getDb().prepare("DELETE FROM pipes WHERE id = ?").run(id);
}

// -- runs ------------------------------------------------------------------

export interface StartRunInput {
  pipeId: string;
  trigger: TriggerName;
  input: unknown;
}

export function startPipeRun(input: StartRunInput): PipeRun {
  initPipes();
  const id = `run-${nanoid(10)}`;
  const now = nowIso();
  const run: PipeRun = {
    id,
    pipe_id: input.pipeId,
    trigger: input.trigger,
    status: "running",
    input: input.input,
    started_at: now,
  };
  getDb()
    .prepare(
      `INSERT INTO pipe_runs (id, pipe_id, trigger, status, input, output, error, halted_reason, started_at, finished_at, duration_ms)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, NULL)`,
    )
    .run(run.id, run.pipe_id, run.trigger, run.status, encode(run.input), run.started_at);
  return run;
}

export interface FinishRunInput {
  runId: string;
  status: PipeRunStatus;
  output?: unknown;
  error?: string;
  haltedReason?: string;
}

export function finishPipeRun(input: FinishRunInput): PipeRun {
  initPipes();
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM pipe_runs WHERE id = ?")
    .get(input.runId) as DbRow | undefined;
  if (!existing) {
    throw new Error(`pipe run not found: ${input.runId}`);
  }
  const now = nowIso();
  const startedAt = String(existing.started_at);
  const duration = Date.parse(now) - Date.parse(startedAt);
  db.prepare(
    `UPDATE pipe_runs
        SET status = ?,
            output = ?,
            error = ?,
            halted_reason = ?,
            finished_at = ?,
            duration_ms = ?
      WHERE id = ?`,
  ).run(
    input.status,
    input.output !== undefined ? encode(input.output) : null,
    input.error ?? null,
    input.haltedReason ?? null,
    now,
    String(duration),
    input.runId,
  );
  const updated = db
    .prepare("SELECT * FROM pipe_runs WHERE id = ?")
    .get(input.runId) as DbRow;
  const mapped = mapRunRow(updated);
  if (!mapped) throw new Error(`pipe run serialisation failed: ${input.runId}`);
  return mapped;
}

export interface ListRunsFilter {
  pipeId?: string;
  limit?: number;
}

export function listPipeRuns(filter: ListRunsFilter = {}): PipeRun[] {
  initPipes();
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  const db = getDb();
  const rows = filter.pipeId
    ? (db
        .prepare(
          `SELECT * FROM pipe_runs WHERE pipe_id = ? ORDER BY started_at DESC LIMIT ?`,
        )
        .all(filter.pipeId, limit) as DbRow[])
    : (db
        .prepare(`SELECT * FROM pipe_runs ORDER BY started_at DESC LIMIT ?`)
        .all(limit) as DbRow[]);
  return rows
    .map((row) => mapRunRow(row))
    .filter((r): r is PipeRun => r !== null);
}

export function getPipeRun(id: string): PipeRun | null {
  initPipes();
  const row = getDb()
    .prepare("SELECT * FROM pipe_runs WHERE id = ?")
    .get(id) as DbRow | undefined;
  return mapRunRow(row);
}
