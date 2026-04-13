/**
 * Cross-pollination service — records user-level facts transplanted between
 * projects with a rationale.
 *
 * Ported from the old Elixir `Ema.Memory.CrossPollination` module. This is
 * EMA's implementation of Honcho's cross-context learning: when a fact learned
 * in project A becomes relevant to project B, the applicability and the
 * rationale for it get preserved as a first-class memory entry.
 *
 * Owns: CRUD against `memory_cross_pollinations`. No routing, no MCP, no
 * filesystem — those live in sibling modules or get added later. Emits domain
 * events via `crossPollinationEvents` for other subsystems to observe.
 */

import { EventEmitter } from "node:events";

import { nanoid } from "nanoid";

import {
  crossPollinationEntrySchema,
  type CrossPollinationEntry,
} from "@ema/shared/schemas";
import { getDb } from "../../persistence/db.js";
import { applyCrossPollinationDdl } from "./cross-pollination.schema.js";

type DbRow = Record<string, unknown>;

export interface RecordCrossPollinationInput {
  fact: string;
  source_project: string;
  target_project: string;
  rationale: string;
  actor_id?: string | undefined;
  confidence?: number | undefined;
  tags?: string[] | undefined;
}

export interface ListCrossPollinationFilter {
  source_project?: string | undefined;
  target_project?: string | undefined;
  limit?: number | undefined;
}

export type CrossPollinationEvent =
  | { kind: "recorded"; entry: CrossPollinationEntry }
  | { kind: "applied"; entry: CrossPollinationEntry };

export const crossPollinationEvents = new EventEmitter();

export class CrossPollinationNotFoundError extends Error {
  public readonly code = "cross_pollination_not_found";
  constructor(public readonly id: string) {
    super(`cross_pollination_not_found: ${id}`);
    this.name = "CrossPollinationNotFoundError";
  }
}

let initialised = false;

/** Apply DDL once per process. Safe to call repeatedly. */
export function initCrossPollination(): void {
  if (initialised) return;
  applyCrossPollinationDdl(getDb());
  initialised = true;
}

/** Test-only hook: force re-init on the next call (e.g. after DROP TABLE). */
export function _resetCrossPollinationForTests(): void {
  initialised = false;
}

// -- (de)serialisation helpers --------------------------------------------

function encodeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

function decodeTags(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

function mapRow(row: DbRow | undefined): CrossPollinationEntry | null {
  if (!row) return null;

  const candidate: Record<string, unknown> = {
    id: String(row.id),
    fact: String(row.fact),
    source_project: String(row.source_project),
    target_project: String(row.target_project),
    rationale: String(row.rationale),
    applied_at: String(row.applied_at),
    tags: decodeTags(row.tags),
  };
  if (typeof row.actor_id === "string" && row.actor_id.length > 0) {
    candidate.actor_id = row.actor_id;
  }
  if (typeof row.confidence === "number") {
    candidate.confidence = row.confidence;
  }

  const parsed = crossPollinationEntrySchema.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}

function nowIso(): string {
  return new Date().toISOString();
}

// -- service ---------------------------------------------------------------

export class CrossPollinationService {
  private readonly emitter: EventEmitter;

  constructor(emitter: EventEmitter = crossPollinationEvents) {
    initCrossPollination();
    this.emitter = emitter;
  }

  /** Record a new cross-pollination entry. Returns the persisted row. */
  async record(
    input: RecordCrossPollinationInput,
  ): Promise<CrossPollinationEntry> {
    initCrossPollination();
    const db = getDb();

    const candidate: Record<string, unknown> = {
      id: nanoid(),
      fact: input.fact,
      source_project: input.source_project,
      target_project: input.target_project,
      rationale: input.rationale,
      applied_at: nowIso(),
      tags: input.tags ?? [],
    };
    if (input.actor_id !== undefined) candidate.actor_id = input.actor_id;
    if (input.confidence !== undefined)
      candidate.confidence = input.confidence;

    const parsed = crossPollinationEntrySchema.parse(candidate);

    db.prepare(
      `INSERT INTO memory_cross_pollinations (
         id, fact, source_project, target_project, rationale, applied_at,
         actor_id, confidence, tags
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      parsed.id,
      parsed.fact,
      parsed.source_project,
      parsed.target_project,
      parsed.rationale,
      parsed.applied_at,
      parsed.actor_id ?? null,
      parsed.confidence ?? null,
      encodeTags(parsed.tags),
    );

    const event: CrossPollinationEvent = { kind: "recorded", entry: parsed };
    this.emitter.emit("cross-pollination", event);
    return parsed;
  }

  /** Fetch a single entry by id. Returns null if it does not exist. */
  async get(id: string): Promise<CrossPollinationEntry | null> {
    initCrossPollination();
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM memory_cross_pollinations WHERE id = ?")
      .get(id) as DbRow | undefined;
    return mapRow(row);
  }

  /** List entries, filterable by source/target project. Ordered newest first. */
  async list(
    filter: ListCrossPollinationFilter = {},
  ): Promise<CrossPollinationEntry[]> {
    initCrossPollination();
    const db = getDb();
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.source_project) {
      clauses.push("source_project = ?");
      params.push(filter.source_project);
    }
    if (filter.target_project) {
      clauses.push("target_project = ?");
      params.push(filter.target_project);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit =
      typeof filter.limit === "number" && filter.limit > 0 ? filter.limit : 100;
    const rows = db
      .prepare(
        `SELECT * FROM memory_cross_pollinations ${whereSql} ORDER BY applied_at DESC LIMIT ?`,
      )
      .all(...params, limit) as DbRow[];
    return rows
      .map((row) => mapRow(row))
      .filter((e): e is CrossPollinationEntry => e !== null);
  }

  /**
   * Find entries applicable to a target project — i.e. previously-recorded
   * transplants whose target matches. Used when hydrating project context so
   * the same fact surfaces next time the user opens project B.
   */
  async findApplicableFor(
    targetProject: string,
    limit: number = 50,
  ): Promise<CrossPollinationEntry[]> {
    return this.list({ target_project: targetProject, limit });
  }

  /**
   * Get the transplant history for a source project — every fact that was
   * learned here and exported elsewhere.
   */
  async getHistory(sourceProject: string): Promise<CrossPollinationEntry[]> {
    return this.list({ source_project: sourceProject });
  }

  /**
   * Subscribe to cross-pollination events. Returns an unsubscribe function.
   */
  subscribe(
    handler: (event: CrossPollinationEvent) => void,
  ): () => void {
    const listener = (event: CrossPollinationEvent): void => handler(event);
    this.emitter.on("cross-pollination", listener);
    return () => {
      this.emitter.off("cross-pollination", listener);
    };
  }
}

/** Default singleton — mirrors blueprintEvents / service usage. */
export const crossPollinationService = new CrossPollinationService();
