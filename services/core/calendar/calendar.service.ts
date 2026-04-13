import { EventEmitter } from "node:events";

import { nanoid } from "nanoid";

import {
  actorPhaseSchema,
  calendarEntryKindSchema,
  calendarEntrySchema,
  calendarEntryStatusSchema,
  goalOwnerKindSchema,
  type ActorPhase,
  type CalendarEntry,
  type CalendarEntryKind,
  type CalendarEntryStatus,
  type GoalOwnerKind,
} from "@ema/shared/schemas";

import { getDb } from "../../persistence/db.js";
import { getGoal, initGoals } from "../goals/goals.service.js";
import { applyCalendarDdl } from "./schema.js";

type DbRow = Record<string, unknown>;

export interface CalendarEntryRecord extends CalendarEntry {}

export interface BuildoutRecord {
  buildout_id: string;
  entries: CalendarEntryRecord[];
}

export interface CalendarFilters {
  owner_kind?: GoalOwnerKind | undefined;
  owner_id?: string | undefined;
  status?: CalendarEntryStatus | undefined;
  entry_kind?: CalendarEntryKind | undefined;
  goal_id?: string | undefined;
  intent_slug?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  buildout_id?: string | undefined;
}

export interface CreateCalendarEntryInput {
  title: string;
  description?: string | null | undefined;
  entry_kind: CalendarEntryKind;
  status?: CalendarEntryStatus | undefined;
  owner_kind?: GoalOwnerKind | undefined;
  owner_id?: string | undefined;
  starts_at: string;
  ends_at?: string | null | undefined;
  phase?: ActorPhase | null | undefined;
  buildout_id?: string | null | undefined;
  goal_id?: string | null | undefined;
  task_id?: string | null | undefined;
  project_id?: string | null | undefined;
  space_id?: string | null | undefined;
  intent_slug?: string | null | undefined;
  execution_id?: string | null | undefined;
  location?: string | null | undefined;
  id?: string | undefined;
}

export interface UpdateCalendarEntryInput {
  title?: string | undefined;
  description?: string | null | undefined;
  entry_kind?: CalendarEntryKind | undefined;
  status?: CalendarEntryStatus | undefined;
  owner_kind?: GoalOwnerKind | undefined;
  owner_id?: string | undefined;
  starts_at?: string | undefined;
  ends_at?: string | null | undefined;
  phase?: ActorPhase | null | undefined;
  goal_id?: string | null | undefined;
  task_id?: string | null | undefined;
  project_id?: string | null | undefined;
  space_id?: string | null | undefined;
  intent_slug?: string | null | undefined;
  execution_id?: string | null | undefined;
  location?: string | null | undefined;
}

export interface CreateAgentBuildoutInput {
  goal_id?: string | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
  owner_id: string;
  start_at: string;
  plan_minutes?: number | undefined;
  execute_minutes?: number | undefined;
  review_minutes?: number | undefined;
  retro_minutes?: number | undefined;
  project_id?: string | null | undefined;
  space_id?: string | null | undefined;
  intent_slug?: string | null | undefined;
}

export type CalendarEvent =
  | { type: "calendar:created"; entry: CalendarEntryRecord }
  | { type: "calendar:updated"; entry: CalendarEntryRecord }
  | { type: "calendar:deleted"; id: string }
  | { type: "calendar:buildout_created"; buildout_id: string; entries: CalendarEntryRecord[] };

export const calendarEvents = new EventEmitter();

let initialised = false;

export class CalendarEntryNotFoundError extends Error {
  public readonly code = "calendar_entry_not_found";
  constructor(public readonly ref: string) {
    super(`Calendar entry not found: ${ref}`);
    this.name = "CalendarEntryNotFoundError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureDatetime(value: string, code: string): string {
  if (Number.isNaN(new Date(value).getTime())) {
    throw new Error(code);
  }
  return value;
}

function maybeDatetime(value: string | null | undefined, code: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return ensureDatetime(value, code);
}

function mapEntry(row: DbRow | undefined): CalendarEntryRecord | null {
  if (!row) return null;

  const parsed = calendarEntrySchema.safeParse({
    id: String(row.id),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : null,
    entry_kind: String(row.entry_kind),
    status: String(row.status),
    owner_kind: String(row.owner_kind),
    owner_id: String(row.owner_id),
    starts_at: String(row.starts_at),
    ends_at: typeof row.ends_at === "string" ? row.ends_at : null,
    phase: typeof row.phase === "string" ? row.phase : null,
    buildout_id: typeof row.buildout_id === "string" ? row.buildout_id : null,
    goal_id: typeof row.goal_id === "string" ? row.goal_id : null,
    task_id: typeof row.task_id === "string" ? row.task_id : null,
    project_id: typeof row.project_id === "string" ? row.project_id : null,
    space_id: typeof row.space_id === "string" ? row.space_id : null,
    intent_slug: typeof row.intent_slug === "string" ? row.intent_slug : null,
    execution_id: typeof row.execution_id === "string" ? row.execution_id : null,
    location: typeof row.location === "string" ? row.location : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  });

  if (!parsed.success) return null;
  return parsed.data;
}

export function initCalendar(): void {
  if (initialised) return;
  initGoals();
  applyCalendarDdl(getDb());
  initialised = true;
}

export function __resetCalendarInit(): void {
  initialised = false;
}

export function listCalendarEntries(filters: CalendarFilters = {}): CalendarEntryRecord[] {
  initCalendar();

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.owner_kind) {
    clauses.push("owner_kind = ?");
    params.push(filters.owner_kind);
  }

  if (filters.owner_id) {
    clauses.push("owner_id = ?");
    params.push(filters.owner_id);
  }

  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }

  if (filters.entry_kind) {
    clauses.push("entry_kind = ?");
    params.push(filters.entry_kind);
  }

  if (filters.goal_id) {
    clauses.push("goal_id = ?");
    params.push(filters.goal_id);
  }

  if (filters.intent_slug) {
    clauses.push("intent_slug = ?");
    params.push(filters.intent_slug);
  }

  if (filters.buildout_id) {
    clauses.push("buildout_id = ?");
    params.push(filters.buildout_id);
  }

  if (filters.from) {
    clauses.push("starts_at >= ?");
    params.push(filters.from);
  }

  if (filters.to) {
    clauses.push("(ends_at IS NULL OR starts_at <= ?)");
    params.push(filters.to);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`SELECT * FROM calendar_entries ${whereSql} ORDER BY starts_at ASC, created_at ASC`)
    .all(...params) as DbRow[];

  return rows
    .map((row) => mapEntry(row))
    .filter((entry): entry is CalendarEntryRecord => entry !== null);
}

export function getCalendarEntry(ref: string): CalendarEntryRecord | null {
  initCalendar();
  const row = getDb()
    .prepare("SELECT * FROM calendar_entries WHERE id = ?")
    .get(ref) as DbRow | undefined;
  return mapEntry(row);
}

export function getBuildout(buildoutId: string): BuildoutRecord | null {
  const entries = listCalendarEntries({ buildout_id: buildoutId });
  if (entries.length === 0) return null;
  return { buildout_id: buildoutId, entries };
}

export function createCalendarEntry(input: CreateCalendarEntryInput): CalendarEntryRecord {
  initCalendar();

  calendarEntryKindSchema.parse(input.entry_kind);
  if (input.status) calendarEntryStatusSchema.parse(input.status);
  if (input.owner_kind) goalOwnerKindSchema.parse(input.owner_kind);
  if (input.phase !== undefined && input.phase !== null) actorPhaseSchema.parse(input.phase);

  const startsAt = ensureDatetime(input.starts_at, "invalid_calendar_start");
  const endsAt = maybeDatetime(input.ends_at, "invalid_calendar_end");
  if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    throw new Error("invalid_calendar_range");
  }

  const id = input.id ?? `cal_${nanoid()}`;
  const now = nowIso();

  getDb()
    .prepare(
      `INSERT INTO calendar_entries (
        id, title, description, entry_kind, status, owner_kind, owner_id,
        starts_at, ends_at, phase, buildout_id, goal_id, task_id, project_id, space_id,
        intent_slug, execution_id, location, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.description ?? null,
      input.entry_kind,
      input.status ?? "scheduled",
      input.owner_kind ?? "human",
      input.owner_id ?? "owner",
      startsAt,
      endsAt,
      input.phase ?? null,
      input.buildout_id ?? null,
      input.goal_id ?? null,
      input.task_id ?? null,
      input.project_id ?? null,
      input.space_id ?? null,
      input.intent_slug ?? null,
      input.execution_id ?? null,
      input.location ?? null,
      now,
      now,
    );

  const entry = getCalendarEntry(id);
  if (!entry) throw new Error("calendar_entry_create_failed");
  calendarEvents.emit("calendar:created", { type: "calendar:created", entry } satisfies CalendarEvent);
  return entry;
}

export function updateCalendarEntry(
  ref: string,
  input: UpdateCalendarEntryInput,
): CalendarEntryRecord {
  initCalendar();
  const existing = getCalendarEntry(ref);
  if (!existing) throw new CalendarEntryNotFoundError(ref);

  const next = {
    title: input.title ?? existing.title,
    description: input.description === undefined ? existing.description : input.description,
    entry_kind: input.entry_kind ?? existing.entry_kind,
    status: input.status ?? existing.status,
    owner_kind: input.owner_kind ?? existing.owner_kind,
    owner_id: input.owner_id ?? existing.owner_id,
    starts_at: input.starts_at ?? existing.starts_at,
    ends_at: input.ends_at === undefined ? existing.ends_at : maybeDatetime(input.ends_at, "invalid_calendar_end"),
    phase: input.phase === undefined ? existing.phase : input.phase,
    goal_id: input.goal_id === undefined ? existing.goal_id : input.goal_id,
    task_id: input.task_id === undefined ? existing.task_id : input.task_id,
    project_id: input.project_id === undefined ? existing.project_id : input.project_id,
    space_id: input.space_id === undefined ? existing.space_id : input.space_id,
    intent_slug: input.intent_slug === undefined ? existing.intent_slug : input.intent_slug,
    execution_id:
      input.execution_id === undefined ? existing.execution_id : input.execution_id,
    location: input.location === undefined ? existing.location : input.location,
  };

  calendarEntryKindSchema.parse(next.entry_kind);
  calendarEntryStatusSchema.parse(next.status);
  goalOwnerKindSchema.parse(next.owner_kind);
  if (next.phase !== null) actorPhaseSchema.parse(next.phase);
  ensureDatetime(next.starts_at, "invalid_calendar_start");
  if (next.ends_at && new Date(next.ends_at).getTime() < new Date(next.starts_at).getTime()) {
    throw new Error("invalid_calendar_range");
  }

  getDb()
    .prepare(
      `UPDATE calendar_entries
       SET title = ?, description = ?, entry_kind = ?, status = ?, owner_kind = ?, owner_id = ?,
           starts_at = ?, ends_at = ?, phase = ?, goal_id = ?, task_id = ?, project_id = ?, space_id = ?,
           intent_slug = ?, execution_id = ?, location = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.title,
      next.description,
      next.entry_kind,
      next.status,
      next.owner_kind,
      next.owner_id,
      next.starts_at,
      next.ends_at,
      next.phase,
      next.goal_id,
      next.task_id,
      next.project_id,
      next.space_id,
      next.intent_slug,
      next.execution_id,
      next.location,
      nowIso(),
      existing.id,
    );

  const entry = getCalendarEntry(existing.id);
  if (!entry) throw new Error("calendar_entry_update_failed");
  calendarEvents.emit("calendar:updated", { type: "calendar:updated", entry } satisfies CalendarEvent);
  return entry;
}

export function deleteCalendarEntry(ref: string): boolean {
  initCalendar();
  const existing = getCalendarEntry(ref);
  if (!existing) return false;
  const result = getDb().prepare("DELETE FROM calendar_entries WHERE id = ?").run(existing.id);
  if (result.changes > 0) {
    calendarEvents.emit("calendar:deleted", { type: "calendar:deleted", id: existing.id } satisfies CalendarEvent);
    return true;
  }
  return false;
}

export function bindExecutionToBuildout(
  buildoutId: string,
  executionId: string,
): BuildoutRecord | null {
  initCalendar();
  const updatedAt = nowIso();
  const result = getDb()
    .prepare(
      `UPDATE calendar_entries
       SET execution_id = ?, updated_at = ?
       WHERE buildout_id = ?`,
    )
    .run(executionId, updatedAt, buildoutId);

  if (result.changes === 0) return null;
  const buildout = getBuildout(buildoutId);
  if (!buildout) return null;
  for (const entry of buildout.entries) {
    calendarEvents.emit("calendar:updated", {
      type: "calendar:updated",
      entry,
    } satisfies CalendarEvent);
  }
  return buildout;
}

const PHASE_ORDER = ["plan", "execute", "review", "retro"] as const;

export function syncExecutionPhaseToCalendar(
  executionId: string,
  phase: ActorPhase,
): BuildoutRecord | null {
  initCalendar();
  if (!PHASE_ORDER.includes(phase as (typeof PHASE_ORDER)[number])) {
    return null;
  }

  const rows = listCalendarEntries({ owner_kind: "agent" }).filter(
    (entry) => entry.execution_id === executionId,
  );
  if (rows.length === 0) return null;

  const buildoutId = rows[0]?.buildout_id ?? null;
  if (!buildoutId) return null;

  const phaseIndex = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  const updatedAt = nowIso();
  const handle = getDb();
  const tx = handle.transaction(() => {
    for (const entry of rows) {
      if (!entry.phase || !PHASE_ORDER.includes(entry.phase as (typeof PHASE_ORDER)[number])) {
        continue;
      }
      const entryIndex = PHASE_ORDER.indexOf(entry.phase as (typeof PHASE_ORDER)[number]);
      const nextStatus =
        entryIndex < phaseIndex
          ? "completed"
          : entryIndex === phaseIndex
            ? "in_progress"
            : "scheduled";
      handle
        .prepare(
          `UPDATE calendar_entries
           SET status = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(nextStatus, updatedAt, entry.id);
    }
  });
  tx();

  return getBuildout(buildoutId);
}

export function syncExecutionCompletionToCalendar(
  executionId: string,
  executionStatus: "completed" | "failed" | "cancelled",
): BuildoutRecord | null {
  initCalendar();
  const rows = listCalendarEntries({ owner_kind: "agent" }).filter(
    (entry) => entry.execution_id === executionId,
  );
  if (rows.length === 0) return null;

  const buildoutId = rows[0]?.buildout_id ?? null;
  if (!buildoutId) return null;

  const nextStatus =
    executionStatus === "completed" ? "completed" : "cancelled";
  const updatedAt = nowIso();
  const handle = getDb();
  handle
    .prepare(
      `UPDATE calendar_entries
       SET status = ?, updated_at = ?
       WHERE execution_id = ?`,
    )
    .run(nextStatus, updatedAt, executionId);

  return getBuildout(buildoutId);
}

function addMinutes(startAt: string, minutes: number): string {
  return new Date(new Date(startAt).getTime() + minutes * 60_000).toISOString();
}

export function createAgentBuildout(input: CreateAgentBuildoutInput): {
  buildout_id: string;
  entries: CalendarEntryRecord[];
} {
  initCalendar();
  const startAt = ensureDatetime(input.start_at, "invalid_buildout_start");
  const goal = input.goal_id ? getGoal(input.goal_id) : null;

  const titleBase = input.title?.trim() || goal?.title || "Agent buildout";
  const description = input.description ?? goal?.description ?? null;
  const intentSlug = input.intent_slug ?? goal?.intent_slug ?? null;
  const projectId = input.project_id ?? goal?.project_id ?? null;
  const spaceId = input.space_id ?? goal?.space_id ?? null;

  const planMinutes = input.plan_minutes ?? 60;
  const executeMinutes = input.execute_minutes ?? 180;
  const reviewMinutes = input.review_minutes ?? 45;
  const retroMinutes = input.retro_minutes ?? 30;

  const buildoutId = `buildout_${nanoid()}`;
  const db = getDb();
  const insert = db.transaction(() => {
    const entries: CalendarEntryRecord[] = [];

    let cursor = startAt;
    const phases: Array<[ActorPhase, number]> = [
      ["plan", planMinutes],
      ["execute", executeMinutes],
      ["review", reviewMinutes],
      ["retro", retroMinutes],
    ];

    for (const [phase, minutes] of phases) {
      const endAt = addMinutes(cursor, minutes);
      const entry = createCalendarEntry({
        title: `${phase}: ${titleBase}`,
        description,
        entry_kind: "agent_virtual_block",
        owner_kind: "agent",
        owner_id: input.owner_id,
        starts_at: cursor,
        ends_at: endAt,
        phase,
        buildout_id: buildoutId,
        goal_id: goal?.id ?? null,
        project_id: projectId,
        space_id: spaceId,
        intent_slug: intentSlug,
      });
      entries.push(entry);
      cursor = endAt;
    }

    return entries;
  });

  const entries = insert();
  calendarEvents.emit(
    "calendar:buildout_created",
    { type: "calendar:buildout_created", buildout_id: buildoutId, entries } satisfies CalendarEvent,
  );
  return { buildout_id: buildoutId, entries };
}
