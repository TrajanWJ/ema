/**
 * Intents service — business logic for the Intent Engine.
 *
 * Ports `Ema.Intents` (old Elixir build) to TypeScript. Two-layer — the
 * filesystem is source of truth, SQLite is the queryable index. Every
 * mutation is routed through this module so the append-only phase log and
 * the domain event bus stay consistent.
 *
 * Dependency-minimal: no coupling to Blueprint / Pipes / Composer / Visibility.
 */

import { EventEmitter } from "node:events";

import { nanoid } from "nanoid";

import {
  intentSchema,
  validateIntentForKind,
  type Intent,
  type IntentKind,
} from "@ema/shared/schemas";
import { getDb } from "../../persistence/db.js";
import { applyIntentsDdl } from "./schema.js";
import {
  assertTransition,
  type IntentPhase,
  type IntentPhaseTransitionRecord,
} from "./state-machine.js";

type DbRow = Record<string, unknown>;

// -- errors ---------------------------------------------------------------

export class IntentNotFoundError extends Error {
  public readonly code = "intent_not_found";
  constructor(public readonly slug: string) {
    super(`Intent not found: ${slug}`);
    this.name = "IntentNotFoundError";
  }
}

export class IntentValidationError extends Error {
  public readonly code = "missing_required_fields";
  constructor(public readonly missing: string[]) {
    super(`Intent rejected — missing required fields: ${missing.join(", ")}`);
    this.name = "IntentValidationError";
  }
}

// -- events ---------------------------------------------------------------

export type IntentEvent =
  | { type: "intent:created"; intent: Intent }
  | { type: "intent:updated"; intent: Intent }
  | { type: "intent:phase_changed"; intent: Intent; from: IntentPhase | null; to: IntentPhase }
  | { type: "intent:status_changed"; intent: Intent; from: string; to: string };

export const intentsEvents = new EventEmitter();

// -- init -----------------------------------------------------------------

let initialised = false;

export function initIntents(): void {
  if (initialised) return;
  applyIntentsDdl(getDb());
  initialised = true;
}

// Reset the init flag. Test-only — lets the hermetic DB drop and recreate
// tables without the service short-circuiting.
export function _resetInitForTest(): void {
  initialised = false;
}

// -- serialisation --------------------------------------------------------

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

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(row: DbRow | undefined): Intent | null {
  if (!row) return null;
  if (row.deleted_at) return null;

  const candidate: Record<string, unknown> = {
    id: String(row.id),
    inserted_at: String(row.created_at),
    updated_at: String(row.updated_at),
    title: String(row.title),
    description:
      typeof row.description === "string" ? row.description : null,
    level: String(row.level),
    status: String(row.status),
    parent_id: typeof row.parent_id === "string" ? row.parent_id : null,
    project_id: typeof row.project_id === "string" ? row.project_id : null,
    actor_id: typeof row.actor_id === "string" ? row.actor_id : null,
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
  };

  if (typeof row.kind === "string" && row.kind.length > 0) {
    candidate.kind = row.kind;
  }
  if (typeof row.exit_condition === "string" && row.exit_condition.length > 0) {
    candidate.exit_condition = row.exit_condition;
  }
  if (typeof row.scope === "string" && row.scope.length > 0) {
    candidate.scope = decode<string[]>(row.scope, []);
  }
  if (typeof row.space_id === "string" && row.space_id.length > 0) {
    candidate.space_id = row.space_id;
  }
  if (typeof row.ema_links === "string" && row.ema_links.length > 0) {
    candidate.ema_links = decode<Intent["ema_links"]>(row.ema_links, []);
  }

  const parsed = intentSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}

// -- queries --------------------------------------------------------------

export interface ListIntentsFilter {
  status?: string | undefined;
  level?: string | undefined;
  kind?: IntentKind | undefined;
  phase?: IntentPhase | undefined;
  project_id?: string | undefined;
  parent_id?: string | undefined;
}

export function listIntents(filter: ListIntentsFilter = {}): Intent[] {
  initIntents();
  const db = getDb();
  const clauses: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter.level) {
    clauses.push("level = ?");
    params.push(filter.level);
  }
  if (filter.kind) {
    clauses.push("kind = ?");
    params.push(filter.kind);
  }
  if (filter.phase) {
    clauses.push("phase = ?");
    params.push(filter.phase);
  }
  if (filter.project_id) {
    clauses.push("project_id = ?");
    params.push(filter.project_id);
  }
  if (filter.parent_id) {
    clauses.push("parent_id = ?");
    params.push(filter.parent_id);
  }
  const whereSql = `WHERE ${clauses.join(" AND ")}`;
  const rows = db
    .prepare(`SELECT * FROM intents ${whereSql} ORDER BY created_at DESC`)
    .all(...params) as DbRow[];
  return rows
    .map((row) => mapRow(row))
    .filter((i): i is Intent => i !== null);
}

export function getIntent(slug: string): Intent | null {
  initIntents();
  const db = getDb();
  const row = db.prepare("SELECT * FROM intents WHERE id = ?").get(slug) as
    | DbRow
    | undefined;
  return mapRow(row);
}

export function getIntentPhase(slug: string): IntentPhase | null {
  initIntents();
  const db = getDb();
  const row = db
    .prepare("SELECT phase FROM intents WHERE id = ?")
    .get(slug) as DbRow | undefined;
  if (!row || typeof row.phase !== "string") return null;
  return row.phase as IntentPhase;
}

export function listIntentPhaseTransitions(
  slug: string,
): IntentPhaseTransitionRecord[] {
  initIntents();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM intent_phase_transitions
       WHERE intent_slug = ?
       ORDER BY transitioned_at ASC`,
    )
    .all(slug) as DbRow[];
  return rows.map((row) => ({
    id: String(row.id),
    intent_slug: String(row.intent_slug),
    from_phase:
      typeof row.from_phase === "string"
        ? (row.from_phase as IntentPhase)
        : null,
    to_phase: String(row.to_phase) as IntentPhase,
    reason: String(row.reason),
    summary: typeof row.summary === "string" ? row.summary : null,
    metadata:
      typeof row.metadata === "string" && row.metadata.length > 0
        ? decode<Record<string, unknown>>(row.metadata, {})
        : null,
    transitioned_at: String(row.transitioned_at),
  }));
}

// -- slug helpers ---------------------------------------------------------

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && slug.length >= 3 && slug.length <= 128;
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/gu, "")
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-");
  return base.length > 0 ? base : `intent-${nanoid(8).toLowerCase()}`;
}

// -- mutations ------------------------------------------------------------

export interface CreateIntentInput {
  slug?: string | undefined;
  title: string;
  description?: string | null | undefined;
  level: Intent["level"];
  status?: Intent["status"] | undefined;
  kind?: IntentKind | undefined;
  phase?: IntentPhase | undefined;
  parent_id?: string | null | undefined;
  project_id?: string | null | undefined;
  actor_id?: string | null | undefined;
  exit_condition?: string | undefined;
  scope?: string[] | undefined;
  space_id?: string | undefined;
  ema_links?: Intent["ema_links"] | undefined;
  metadata?: Record<string, unknown> | undefined;
  tags?: string[] | undefined;
}

function buildIntentCandidate(
  input: CreateIntentInput,
  id: string,
  timestamps: { created: string; updated: string },
): Intent {
  const candidate: Record<string, unknown> = {
    id,
    inserted_at: timestamps.created,
    updated_at: timestamps.updated,
    title: input.title,
    description: input.description ?? null,
    level: input.level,
    status: input.status ?? "draft",
    parent_id: input.parent_id ?? null,
    project_id: input.project_id ?? null,
    actor_id: input.actor_id ?? null,
    metadata: input.metadata ?? {},
  };
  if (input.kind !== undefined) candidate.kind = input.kind;
  if (input.exit_condition !== undefined) {
    candidate.exit_condition = input.exit_condition;
  }
  if (input.scope !== undefined) candidate.scope = input.scope;
  if (input.space_id !== undefined) candidate.space_id = input.space_id;
  if (input.ema_links !== undefined) candidate.ema_links = input.ema_links;
  return intentSchema.parse(candidate);
}

export function createIntent(input: CreateIntentInput): Intent {
  initIntents();

  const id = (input.slug ?? slugify(input.title)).toLowerCase();
  if (!isValidSlug(id)) {
    throw new IntentValidationError(["slug"]);
  }

  const now = nowIso();
  const parsed = buildIntentCandidate(input, id, {
    created: now,
    updated: now,
  });

  const validation = validateIntentForKind(parsed);
  if (!validation.ok) {
    throw new IntentValidationError(validation.missing);
  }

  const db = getDb();

  // Slug uniqueness — reject if one already lives at that id.
  const existing = db
    .prepare("SELECT id FROM intents WHERE id = ? AND deleted_at IS NULL")
    .get(id) as DbRow | undefined;
  if (existing) {
    throw new IntentValidationError(["slug"]);
  }

  const phase: IntentPhase = input.phase ?? "idle";
  const tags = input.tags ?? [];

  db.prepare(
    `INSERT INTO intents (
       id, title, description, level, status, kind, phase,
       parent_id, project_id, actor_id, space_id,
       exit_condition, scope, ema_links, metadata, tags,
       source_path, deleted_at, created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       NULL, NULL, ?, ?
     )`,
  ).run(
    parsed.id,
    parsed.title,
    parsed.description,
    parsed.level,
    parsed.status,
    parsed.kind ?? null,
    phase,
    parsed.parent_id,
    parsed.project_id,
    parsed.actor_id,
    parsed.space_id ?? null,
    parsed.exit_condition ?? null,
    parsed.scope ? encode(parsed.scope) : null,
    parsed.ema_links ? encode(parsed.ema_links) : null,
    encode(parsed.metadata),
    encode(tags),
    parsed.inserted_at,
    parsed.updated_at,
  );

  appendPhaseTransition({
    slug: parsed.id,
    from: null,
    to: phase,
    reason: "created",
  });

  const emitted: IntentEvent = { type: "intent:created", intent: parsed };
  intentsEvents.emit("intent:created", emitted);
  return parsed;
}

function requireIntent(slug: string): Intent {
  const existing = getIntent(slug);
  if (!existing) throw new IntentNotFoundError(slug);
  return existing;
}

// -- phase transitions ----------------------------------------------------

export interface TransitionPhaseInput {
  to: IntentPhase;
  reason: string;
  summary?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

interface AppendPhaseTransitionArgs {
  slug: string;
  from: IntentPhase | null;
  to: IntentPhase;
  reason: string;
  summary?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

function appendPhaseTransition(args: AppendPhaseTransitionArgs): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO intent_phase_transitions (
       id, intent_slug, from_phase, to_phase, reason, summary, metadata, transitioned_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    args.slug,
    args.from,
    args.to,
    args.reason,
    args.summary ?? null,
    args.metadata ? encode(args.metadata) : null,
    nowIso(),
  );
}

export function transitionPhase(
  slug: string,
  input: TransitionPhaseInput,
): Intent {
  initIntents();
  const existing = requireIntent(slug);
  const fromPhase = getIntentPhase(slug);
  assertTransition(fromPhase, input.to);

  const now = nowIso();
  const db = getDb();
  db.prepare(
    "UPDATE intents SET phase = ?, updated_at = ? WHERE id = ?",
  ).run(input.to, now, slug);

  appendPhaseTransition({
    slug,
    from: fromPhase,
    to: input.to,
    reason: input.reason,
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });

  const updated = requireIntent(slug);
  const emitted: IntentEvent = {
    type: "intent:phase_changed",
    intent: updated,
    from: fromPhase,
    to: input.to,
  };
  intentsEvents.emit("intent:phase_changed", emitted);
  // Keep the generic updated event flowing too.
  const updatedEvent: IntentEvent = {
    type: "intent:updated",
    intent: updated,
  };
  intentsEvents.emit("intent:updated", updatedEvent);
  void existing;
  return updated;
}

// -- status updates -------------------------------------------------------

export interface UpdateStatusInput {
  status: Intent["status"];
  reason?: string | undefined;
}

export function updateIntentStatus(
  slug: string,
  input: UpdateStatusInput,
): Intent {
  initIntents();
  const existing = requireIntent(slug);
  const now = nowIso();
  const db = getDb();
  db.prepare(
    "UPDATE intents SET status = ?, updated_at = ? WHERE id = ?",
  ).run(input.status, now, slug);

  const updated = requireIntent(slug);
  const emitted: IntentEvent = {
    type: "intent:status_changed",
    intent: updated,
    from: existing.status,
    to: input.status,
  };
  intentsEvents.emit("intent:status_changed", emitted);
  return updated;
}

// -- filesystem-sync upsert -----------------------------------------------

export interface UpsertFromSourceInput {
  intent: Intent;
  phase?: IntentPhase | undefined;
  tags?: string[] | undefined;
  sourcePath: string;
}

/**
 * Upsert an intent loaded from the filesystem layer. Bypasses the "create"
 * mint/validate path so pre-existing slugs (e.g. `int-recovery-wave-1`)
 * survive a cold-boot reindex. Phase transitions are recorded only when
 * the stored phase differs from the parsed phase.
 */
export function upsertIntentFromSource(input: UpsertFromSourceInput): Intent {
  initIntents();
  const parsed = intentSchema.parse(input.intent);
  const db = getDb();

  const phase: IntentPhase = input.phase ?? "idle";
  const tags = input.tags ?? [];

  const previousPhase = getIntentPhase(parsed.id);

  db.prepare(
    `INSERT INTO intents (
       id, title, description, level, status, kind, phase,
       parent_id, project_id, actor_id, space_id,
       exit_condition, scope, ema_links, metadata, tags,
       source_path, deleted_at, created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, NULL, ?, ?
     )
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       level = excluded.level,
       status = excluded.status,
       kind = excluded.kind,
       phase = excluded.phase,
       parent_id = excluded.parent_id,
       project_id = excluded.project_id,
       actor_id = excluded.actor_id,
       space_id = excluded.space_id,
       exit_condition = excluded.exit_condition,
       scope = excluded.scope,
       ema_links = excluded.ema_links,
       metadata = excluded.metadata,
       tags = excluded.tags,
       source_path = excluded.source_path,
       deleted_at = NULL,
       updated_at = excluded.updated_at`,
  ).run(
    parsed.id,
    parsed.title,
    parsed.description,
    parsed.level,
    parsed.status,
    parsed.kind ?? null,
    phase,
    parsed.parent_id,
    parsed.project_id,
    parsed.actor_id,
    parsed.space_id ?? null,
    parsed.exit_condition ?? null,
    parsed.scope ? encode(parsed.scope) : null,
    parsed.ema_links ? encode(parsed.ema_links) : null,
    encode(parsed.metadata),
    encode(tags),
    input.sourcePath,
    parsed.inserted_at,
    parsed.updated_at,
  );

  // Only record a transition when phase actually changed (or is the initial
  // entry). Reindexing the same file shouldn't spam the log.
  if (previousPhase === null) {
    appendPhaseTransition({
      slug: parsed.id,
      from: null,
      to: phase,
      reason: "indexed_from_source",
    });
  } else if (previousPhase !== phase) {
    // Forward-skip checks delegated to the state machine; if the source
    // declares an illegal rewind, record it as a new forward entry anyway
    // since the filesystem is the source of truth. Log the raw change.
    appendPhaseTransition({
      slug: parsed.id,
      from: previousPhase,
      to: phase,
      reason: "source_changed_phase",
    });
  }

  return parsed;
}

// -- intent_links: attachment verbs ---------------------------------------

export type IntentLinkTargetType =
  | "intent"
  | "execution"
  | "proposal"
  | "task"
  | "session"
  | "actor"
  | "canon";

export interface IntentLinkRecord {
  id: string;
  source_slug: string;
  target_type: IntentLinkTargetType;
  target_id: string;
  relation: string;
  provenance: string;
  created_at: string;
}

export interface AttachLinkInput {
  intentSlug: string;
  targetType: IntentLinkTargetType;
  targetId: string;
  relation: string;
  provenance?: string | undefined;
}

function mapLinkRow(row: DbRow | undefined): IntentLinkRecord | null {
  if (!row) return null;
  return {
    id: String(row.id),
    source_slug: String(row.source_slug),
    target_type: String(row.target_type) as IntentLinkTargetType,
    target_id: String(row.target_id),
    relation: String(row.relation),
    provenance: String(row.provenance),
    created_at: String(row.created_at),
  };
}

/**
 * Attach a target record to an intent. Validates that the intent exists
 * (throws `IntentNotFoundError` otherwise) and appends an `intent_events`
 * row so the lineage log carries the attachment. Does NOT validate that
 * the target record exists — the intent service does not own executions,
 * proposals, sessions, or actors. Callers (e.g. `executions.service.ts`)
 * are responsible for calling this only after they have created the
 * target row.
 */
export function attachLink(input: AttachLinkInput): IntentLinkRecord {
  initIntents();
  requireIntent(input.intentSlug);

  const db = getDb();
  const id = nanoid();
  const now = nowIso();
  db.prepare(
    `INSERT INTO intent_links (
       id, source_slug, target_type, target_id, relation, provenance, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.intentSlug,
    input.targetType,
    input.targetId,
    input.relation,
    input.provenance ?? "manual",
    now,
  );

  appendIntentEvent({
    intentSlug: input.intentSlug,
    eventType: "attached",
    payload: {
      target_type: input.targetType,
      target_id: input.targetId,
      relation: input.relation,
    },
  });

  return {
    id,
    source_slug: input.intentSlug,
    target_type: input.targetType,
    target_id: input.targetId,
    relation: input.relation,
    provenance: input.provenance ?? "manual",
    created_at: now,
  };
}

/**
 * Convenience wrapper for the common case: attach an execution to an
 * intent with the canonical `runtime` relation. This is the function
 * `executions.service.createExecution()` calls after inserting the row.
 */
export function attachExecution(
  intentSlug: string,
  executionId: string,
  provenance: string = "execution",
): IntentLinkRecord {
  return attachLink({
    intentSlug,
    targetType: "execution",
    targetId: executionId,
    relation: "runtime",
    provenance,
  });
}

export function attachActor(
  intentSlug: string,
  actorId: string,
  relation: string = "owner",
): IntentLinkRecord {
  return attachLink({
    intentSlug,
    targetType: "actor",
    targetId: actorId,
    relation,
  });
}

export function attachSession(
  intentSlug: string,
  sessionId: string,
  relation: string = "runtime",
): IntentLinkRecord {
  return attachLink({
    intentSlug,
    targetType: "session",
    targetId: sessionId,
    relation,
  });
}

export function listIntentLinks(
  intentSlug: string,
  filter: { targetType?: IntentLinkTargetType; relation?: string } = {},
): IntentLinkRecord[] {
  initIntents();
  const db = getDb();
  const clauses: string[] = ["source_slug = ?"];
  const params: unknown[] = [intentSlug];
  if (filter.targetType) {
    clauses.push("target_type = ?");
    params.push(filter.targetType);
  }
  if (filter.relation) {
    clauses.push("relation = ?");
    params.push(filter.relation);
  }
  const rows = db
    .prepare(
      `SELECT * FROM intent_links WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`,
    )
    .all(...params) as DbRow[];
  return rows
    .map((row) => mapLinkRow(row))
    .filter((r): r is IntentLinkRecord => r !== null);
}

// -- intent_events: append-only lineage log -------------------------------

export interface IntentEventRecord {
  id: string;
  intent_slug: string;
  event_type: string;
  payload: Record<string, unknown>;
  actor: string;
  happened_at: string;
}

interface AppendIntentEventInput {
  intentSlug: string;
  eventType: string;
  payload?: Record<string, unknown> | undefined;
  actor?: string | undefined;
}

export function appendIntentEvent(
  input: AppendIntentEventInput,
): IntentEventRecord {
  initIntents();
  const db = getDb();
  const id = nanoid();
  const now = nowIso();
  const payload = input.payload ?? {};
  const actor = input.actor ?? "system";
  db.prepare(
    `INSERT INTO intent_events (id, intent_slug, event_type, payload, actor, happened_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.intentSlug, input.eventType, encode(payload), actor, now);
  return {
    id,
    intent_slug: input.intentSlug,
    event_type: input.eventType,
    payload,
    actor,
    happened_at: now,
  };
}

export function listIntentEvents(
  intentSlug: string,
  limit: number = 50,
): IntentEventRecord[] {
  initIntents();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM intent_events
        WHERE intent_slug = ?
        ORDER BY happened_at DESC
        LIMIT ?`,
    )
    .all(intentSlug, limit) as DbRow[];
  return rows.map((row) => ({
    id: String(row.id),
    intent_slug: String(row.intent_slug),
    event_type: String(row.event_type),
    payload: decode<Record<string, unknown>>(row.payload, {}),
    actor: String(row.actor),
    happened_at: String(row.happened_at),
  }));
}

// -- runtime bundle + tree (context assembly for agents) -----------------

export interface IntentRuntimeBundle {
  intent: Intent;
  phase: IntentPhase | null;
  links: {
    executions: IntentLinkRecord[];
    proposals: IntentLinkRecord[];
    actors: IntentLinkRecord[];
    sessions: IntentLinkRecord[];
    tasks: IntentLinkRecord[];
    canon: IntentLinkRecord[];
  };
  phase_transitions: IntentPhaseTransitionRecord[];
  recent_events: IntentEventRecord[];
}

/**
 * Assemble everything an agent (or the SDK) needs to know about an intent
 * in a single call. Matches the shape the old Elixir
 * `Ema.Intents.get_runtime_bundle/1` returned and the shape promised by
 * the (now-stale) `docs/CONVERGENCE-READINESS-REPORT.md` for the old
 * daemon — so callers who were targeting the Elixir surface can port
 * with no semantic drift.
 */
export function getRuntimeBundle(
  intentSlug: string,
): IntentRuntimeBundle | null {
  initIntents();
  const intent = getIntent(intentSlug);
  if (!intent) return null;

  const allLinks = listIntentLinks(intentSlug);
  const links: IntentRuntimeBundle["links"] = {
    executions: [],
    proposals: [],
    actors: [],
    sessions: [],
    tasks: [],
    canon: [],
  };
  for (const link of allLinks) {
    switch (link.target_type) {
      case "execution":
        links.executions.push(link);
        break;
      case "proposal":
        links.proposals.push(link);
        break;
      case "actor":
        links.actors.push(link);
        break;
      case "session":
        links.sessions.push(link);
        break;
      case "task":
        links.tasks.push(link);
        break;
      case "canon":
        links.canon.push(link);
        break;
      default:
        break;
    }
  }

  return {
    intent,
    phase: getIntentPhase(intentSlug),
    links,
    phase_transitions: listIntentPhaseTransitions(intentSlug),
    recent_events: listIntentEvents(intentSlug, 20),
  };
}

export interface IntentTreeNode {
  intent: Intent;
  children: IntentTreeNode[];
}

/**
 * Build a tree of intents rooted at `rootSlug`, walking `parent_id`. If
 * `rootSlug` is omitted, returns every top-level intent (those with no
 * parent) as separate tree roots.
 */
export function getIntentTree(
  rootSlug: string | null = null,
): IntentTreeNode[] {
  initIntents();
  const everyIntent = listIntents();
  const byParent = new Map<string | null, Intent[]>();
  for (const intent of everyIntent) {
    const key = intent.parent_id ?? null;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(intent);
    else byParent.set(key, [intent]);
  }

  const build = (intent: Intent): IntentTreeNode => ({
    intent,
    children: (byParent.get(intent.id) ?? []).map(build),
  });

  if (rootSlug === null) {
    return (byParent.get(null) ?? []).map(build);
  }
  const root = everyIntent.find((i) => i.id === rootSlug);
  if (!root) return [];
  return [build(root)];
}

export function softDeleteBySourcePath(sourcePath: string): number {
  initIntents();
  const db = getDb();
  const now = nowIso();
  const result = db
    .prepare(
      `UPDATE intents
          SET deleted_at = ?, updated_at = ?
        WHERE source_path = ? AND deleted_at IS NULL`,
    )
    .run(now, now, sourcePath);
  return result.changes;
}
