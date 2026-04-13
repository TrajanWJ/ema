/**
 * Blueprint service — business logic for the GAC queue.
 *
 * Owns: CRUD + state-machine enforcement against the `gac_cards` and
 * `gac_transitions` tables. No routing, no filesystem, no MCP — those live
 * in sibling modules and call into this one.
 *
 * Emits domain events via `blueprintEvents` for other subsystems to observe.
 * Follows the dependency-minimal pattern — no import of Composer, Pipes, or
 * Visibility.
 */

import { EventEmitter } from "node:events";

import { nanoid } from "nanoid";

import {
  gacCardSchema,
  type GacAnswer,
  type GacCard,
  type GacCategory,
  type GacOption,
  type GacPriority,
  type GacResultAction,
  type GacStatus,
} from "@ema/shared/schemas";
import { getDb } from "../../persistence/db.js";
import { applyBlueprintDdl } from "./schema.js";
import {
  assertTransition,
  type GacTransitionRecord,
} from "./state-machine.js";

type DbRow = Record<string, unknown>;

export interface CreateGacCardInput {
  title: string;
  question: string;
  options: GacOption[];
  category: GacCategory;
  priority: GacPriority;
  author: string;
  id?: string | undefined; // if omitted, the service mints GAC-NNN
  tags?: string[] | undefined;
  connections?: GacCard["connections"] | undefined;
  context?: GacCard["context"] | undefined;
}

export interface AnswerGacCardInput {
  selected: string | null;
  freeform?: string | undefined;
  answered_by: string;
  reason?: string | undefined;
  result_action?: GacResultAction | undefined;
}

export interface DeferGacCardInput {
  actor: string;
  reason: string;
  blocker_id?: string | undefined;
}

export interface PromoteGacCardInput {
  actor: string;
  reason: string;
  blocker_id: string;
}

export type BlueprintEvent =
  | { type: "gac:created"; card: GacCard }
  | { type: "gac:answered"; card: GacCard }
  | { type: "gac:deferred"; card: GacCard }
  | { type: "gac:promoted"; card: GacCard };

export const blueprintEvents = new EventEmitter();

export class GacNotFoundError extends Error {
  public readonly code = "gac_not_found";
  constructor(public readonly id: string) {
    super(`GAC card not found: ${id}`);
    this.name = "GacNotFoundError";
  }
}

let initialised = false;

export function initBlueprint(): void {
  if (initialised) return;
  applyBlueprintDdl(getDb());
  initialised = true;
}

// -- (de)serialisation helpers --------------------------------------------

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

function mapRow(row: DbRow | undefined): GacCard | null {
  if (!row) return null;
  if (row.deleted_at) return null;

  const candidate = {
    id: String(row.id),
    type: "gac_card" as const,
    layer: "intents" as const,
    title: String(row.title),
    status: String(row.status) as GacStatus,
    created: String(row.created_at),
    updated: String(row.updated_at),
    ...(typeof row.answered_at === "string"
      ? { answered_at: row.answered_at }
      : {}),
    ...(typeof row.answered_by === "string"
      ? { answered_by: row.answered_by }
      : {}),
    author: String(row.author),
    category: String(row.category) as GacCategory,
    priority: String(row.priority) as GacPriority,
    question: String(row.question),
    options: decode<GacOption[]>(row.options, []),
    ...(typeof row.answer === "string" && row.answer.length > 0
      ? { answer: decode<GacAnswer | undefined>(row.answer, undefined) }
      : {}),
    ...(typeof row.result_action === "string" && row.result_action.length > 0
      ? {
          result_action: decode<GacResultAction | undefined>(
            row.result_action,
            undefined,
          ),
        }
      : {}),
    connections: decode<GacCard["connections"]>(row.connections, []),
    ...(typeof row.context === "string" && row.context.length > 0
      ? { context: decode<GacCard["context"]>(row.context, undefined) }
      : {}),
    tags: decode<string[]>(row.tags, []),
  };

  const parsed = gacCardSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}

// -- queries --------------------------------------------------------------

export interface ListGacCardsFilter {
  status?: GacStatus | undefined;
  category?: GacCategory | undefined;
  priority?: GacPriority | undefined;
}

export function listGacCards(filter: ListGacCardsFilter = {}): GacCard[] {
  initBlueprint();
  const db = getDb();
  const clauses: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter.category) {
    clauses.push("category = ?");
    params.push(filter.category);
  }
  if (filter.priority) {
    clauses.push("priority = ?");
    params.push(filter.priority);
  }
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT * FROM gac_cards ${whereSql} ORDER BY created_at DESC`,
    )
    .all(...params) as DbRow[];
  return rows.map((row) => mapRow(row)).filter((c): c is GacCard => c !== null);
}

export function getGacCard(id: string): GacCard | null {
  initBlueprint();
  const db = getDb();
  const row = db.prepare("SELECT * FROM gac_cards WHERE id = ?").get(id) as
    | DbRow
    | undefined;
  return mapRow(row);
}

export function listGacTransitions(cardId: string): GacTransitionRecord[] {
  initBlueprint();
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM gac_transitions WHERE card_id = ? ORDER BY happened_at ASC",
    )
    .all(cardId) as DbRow[];
  return rows.map((row) => ({
    id: String(row.id),
    card_id: String(row.card_id),
    from_status: String(row.from_status) as GacStatus,
    to_status: String(row.to_status) as GacStatus,
    actor: String(row.actor),
    reason: typeof row.reason === "string" ? row.reason : null,
    happened_at: String(row.happened_at),
  }));
}

// -- id minting -----------------------------------------------------------

function nextGacId(): string {
  initBlueprint();
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id FROM gac_cards WHERE id GLOB 'GAC-[0-9]*' ORDER BY id DESC LIMIT 1",
    )
    .get() as DbRow | undefined;
  const current = row && typeof row.id === "string" ? row.id : "GAC-000";
  const numericPart = current.replace(/^GAC-/u, "");
  const parsed = Number.parseInt(numericPart, 10);
  const next = Number.isFinite(parsed) ? parsed + 1 : 1;
  return `GAC-${String(next).padStart(3, "0")}`;
}

// -- mutations ------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function appendTransition(
  cardId: string,
  from: GacStatus,
  to: GacStatus,
  actor: string,
  reason: string | null,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO gac_transitions (id, card_id, from_status, to_status, actor, reason, happened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(nanoid(), cardId, from, to, actor, reason, nowIso());
}

export function createGacCard(input: CreateGacCardInput): GacCard {
  initBlueprint();
  const db = getDb();
  const id = input.id ?? nextGacId();
  const now = nowIso();

  const candidate = {
    id,
    type: "gac_card" as const,
    layer: "intents" as const,
    title: input.title,
    status: "pending" as const,
    created: now,
    updated: now,
    author: input.author,
    category: input.category,
    priority: input.priority,
    question: input.question,
    options: input.options,
    connections: input.connections ?? [],
    ...(input.context ? { context: input.context } : {}),
    tags: input.tags ?? [],
  };

  const parsed = gacCardSchema.parse(candidate);

  db.prepare(
    `INSERT INTO gac_cards (
       id, type, layer, title, status, category, priority, author, question,
       options, answer, result_action, connections, context, tags,
       source_path, deleted_at, created_at, updated_at, answered_at, answered_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL)`,
  ).run(
    parsed.id,
    parsed.type,
    parsed.layer,
    parsed.title,
    parsed.status,
    parsed.category,
    parsed.priority,
    parsed.author,
    parsed.question,
    encode(parsed.options),
    encode(parsed.connections),
    parsed.context ? encode(parsed.context) : null,
    encode(parsed.tags),
    parsed.created,
    parsed.updated,
  );

  appendTransition(parsed.id, "pending", "pending", input.author, "created");

  const emitted: BlueprintEvent = { type: "gac:created", card: parsed };
  blueprintEvents.emit("gac:created", emitted);
  return parsed;
}

function requireCard(id: string): GacCard {
  const existing = getGacCard(id);
  if (!existing) throw new GacNotFoundError(id);
  return existing;
}

export function answerGacCard(
  id: string,
  input: AnswerGacCardInput,
): GacCard {
  initBlueprint();
  const existing = requireCard(id);
  assertTransition(existing.status, "answered");

  const now = nowIso();
  const answer: GacAnswer = {
    selected: input.selected,
    ...(input.freeform !== undefined ? { freeform: input.freeform } : {}),
    answered_by: input.answered_by,
    answered_at: now,
  };

  const db = getDb();
  db.prepare(
    `UPDATE gac_cards
        SET status = 'answered',
            answer = ?,
            result_action = ?,
            answered_at = ?,
            answered_by = ?,
            updated_at = ?
      WHERE id = ?`,
  ).run(
    encode(answer),
    input.result_action ? encode(input.result_action) : null,
    now,
    input.answered_by,
    now,
    id,
  );

  appendTransition(
    id,
    existing.status,
    "answered",
    input.answered_by,
    input.reason ?? null,
  );

  const updated = requireCard(id);
  const emitted: BlueprintEvent = { type: "gac:answered", card: updated };
  blueprintEvents.emit("gac:answered", emitted);
  return updated;
}

export function deferGacCard(
  id: string,
  input: DeferGacCardInput,
): GacCard {
  initBlueprint();
  const existing = requireCard(id);
  assertTransition(existing.status, "deferred");

  const now = nowIso();
  const resultAction: GacResultAction = {
    type: "defer_to_blocker",
    ...(input.blocker_id ? { target: input.blocker_id } : {}),
  };

  const db = getDb();
  db.prepare(
    `UPDATE gac_cards
        SET status = 'deferred',
            result_action = ?,
            updated_at = ?
      WHERE id = ?`,
  ).run(encode(resultAction), now, id);

  appendTransition(id, existing.status, "deferred", input.actor, input.reason);

  const updated = requireCard(id);
  const emitted: BlueprintEvent = { type: "gac:deferred", card: updated };
  blueprintEvents.emit("gac:deferred", emitted);
  return updated;
}

export function promoteGacCard(
  id: string,
  input: PromoteGacCardInput,
): GacCard {
  initBlueprint();
  const existing = requireCard(id);
  assertTransition(existing.status, "promoted");

  const now = nowIso();
  const resultAction: GacResultAction = {
    type: "defer_to_blocker",
    target: input.blocker_id,
  };

  const db = getDb();
  db.prepare(
    `UPDATE gac_cards
        SET status = 'promoted',
            result_action = ?,
            updated_at = ?
      WHERE id = ?`,
  ).run(encode(resultAction), now, id);

  appendTransition(id, existing.status, "promoted", input.actor, input.reason);

  const updated = requireCard(id);
  const emitted: BlueprintEvent = { type: "gac:promoted", card: updated };
  blueprintEvents.emit("gac:promoted", emitted);
  return updated;
}

// -- filesystem-sync hooks ------------------------------------------------

/**
 * Upsert a card loaded from the filesystem layer. Bypasses the "create"
 * mint/validate path so already-existing ids (GAC-001 etc.) survive a
 * cold-boot reindex.
 */
export function upsertGacCardFromSource(
  card: GacCard,
  sourcePath: string,
): GacCard {
  initBlueprint();
  const parsed = gacCardSchema.parse(card);
  const db = getDb();

  db.prepare(
    `INSERT INTO gac_cards (
       id, type, layer, title, status, category, priority, author, question,
       options, answer, result_action, connections, context, tags,
       source_path, deleted_at, created_at, updated_at, answered_at, answered_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       status = excluded.status,
       category = excluded.category,
       priority = excluded.priority,
       author = excluded.author,
       question = excluded.question,
       options = excluded.options,
       answer = excluded.answer,
       result_action = excluded.result_action,
       connections = excluded.connections,
       context = excluded.context,
       tags = excluded.tags,
       source_path = excluded.source_path,
       deleted_at = NULL,
       updated_at = excluded.updated_at,
       answered_at = excluded.answered_at,
       answered_by = excluded.answered_by`,
  ).run(
    parsed.id,
    parsed.type,
    parsed.layer,
    parsed.title,
    parsed.status,
    parsed.category,
    parsed.priority,
    parsed.author,
    parsed.question,
    encode(parsed.options),
    parsed.answer ? encode(parsed.answer) : null,
    parsed.result_action ? encode(parsed.result_action) : null,
    encode(parsed.connections),
    parsed.context ? encode(parsed.context) : null,
    encode(parsed.tags),
    sourcePath,
    parsed.created,
    parsed.updated,
    parsed.answered_at ?? null,
    parsed.answered_by ?? null,
  );

  return parsed;
}

/** Soft-delete by source path — used when a card.md file is removed. */
export function softDeleteBySourcePath(sourcePath: string): number {
  initBlueprint();
  const db = getDb();
  const now = nowIso();
  const result = db
    .prepare(
      "UPDATE gac_cards SET deleted_at = ?, updated_at = ? WHERE source_path = ? AND deleted_at IS NULL",
    )
    .run(now, now, sourcePath);
  return result.changes;
}
