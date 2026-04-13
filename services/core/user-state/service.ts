/**
 * UserState service — GAC-010 runtime.
 *
 * Owns the singleton operator snapshot (`user_state_current`) plus the
 * append-only ring buffer of every mutation (`user_state_snapshots`).
 *
 * Public surface:
 *   - `getCurrentUserState()`   — read the current snapshot (initialised if absent).
 *   - `updateUserState(patch)`  — self or agent mutation; writes a snapshot row.
 *   - `recordSignal(signal)`    — heuristic path; runs `applySignal` and persists the result.
 *   - `getUserStateHistory({limit})` — read back from the ring buffer.
 *   - `resetUserState()`        — test-only; drops the current row.
 *
 * Events (`userStateEvents`):
 *   - `user_state:changed`            — every mutation
 *   - `user_state:distress_raised`    — distress_flag 0 → 1
 *   - `user_state:distress_cleared`   — distress_flag 1 → 0
 *
 * Follows the dependency-minimal pattern — no import of Blueprint, Visibility,
 * Pipes, Composer, or any sibling subservice.
 */

import { EventEmitter } from "node:events";

import { nanoid } from "nanoid";

import {
  userStateSnapshotSchema,
  type UserStateMode,
  type UserStateSignal,
  type UserStateSnapshot,
  type UserStateUpdatedBy,
} from "@ema/shared/schemas";

import { getDb } from "../../persistence/db.js";
import {
  applySignal,
  DISTRESS_WINDOW_MS,
  type HeuristicResult,
} from "./heuristics.js";
import { applyUserStateDdl, SNAPSHOT_RING_SIZE } from "./schema.js";

type DbRow = Record<string, unknown>;

const SINGLETON_ID = "self";

export type UserStateEvent =
  | { type: "user_state:changed"; snapshot: UserStateSnapshot; reason: string }
  | { type: "user_state:distress_raised"; snapshot: UserStateSnapshot }
  | { type: "user_state:distress_cleared"; snapshot: UserStateSnapshot };

export const userStateEvents = new EventEmitter();
userStateEvents.setMaxListeners(0);

let initialised = false;

export function initUserState(): void {
  if (initialised) return;
  applyUserStateDdl(getDb());
  initialised = true;
}

// -- helpers --------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function numToCell(value: number | undefined): string | null {
  return typeof value === "number" ? String(value) : null;
}

function cellToNum(raw: unknown): number | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rowToSnapshot(row: DbRow | undefined): UserStateSnapshot | null {
  if (!row) return null;
  const focus = cellToNum(row.focus_score);
  const energy = cellToNum(row.energy_score);
  const drift = cellToNum(row.drift_score);
  const candidate: UserStateSnapshot = {
    mode: String(row.mode) as UserStateMode,
    ...(focus !== undefined ? { focus_score: focus } : {}),
    ...(energy !== undefined ? { energy_score: energy } : {}),
    distress_flag: Number(row.distress_flag) === 1,
    ...(drift !== undefined ? { drift_score: drift } : {}),
    current_intent_slug:
      typeof row.current_intent_slug === "string"
        ? row.current_intent_slug
        : null,
    updated_at: String(row.updated_at),
    updated_by: String(row.updated_by) as UserStateUpdatedBy,
  };
  const parsed = userStateSnapshotSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Snapshot returned when the service boots and no row exists yet.
 * Per the spec: mode 'unknown', distress_flag false, not zeros.
 */
function coldStartSnapshot(): UserStateSnapshot {
  return {
    mode: "unknown",
    distress_flag: false,
    current_intent_slug: null,
    updated_at: nowIso(),
    updated_by: "self",
  };
}

function writeCurrent(snapshot: UserStateSnapshot): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO user_state_current (
       id, mode, focus_score, energy_score, distress_flag,
       drift_score, current_intent_slug, updated_at, updated_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       mode = excluded.mode,
       focus_score = excluded.focus_score,
       energy_score = excluded.energy_score,
       distress_flag = excluded.distress_flag,
       drift_score = excluded.drift_score,
       current_intent_slug = excluded.current_intent_slug,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  ).run(
    SINGLETON_ID,
    snapshot.mode,
    numToCell(snapshot.focus_score),
    numToCell(snapshot.energy_score),
    snapshot.distress_flag ? 1 : 0,
    numToCell(snapshot.drift_score),
    snapshot.current_intent_slug,
    snapshot.updated_at,
    snapshot.updated_by,
  );
}

function appendSnapshot(snapshot: UserStateSnapshot, reason: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO user_state_snapshots (
       id, mode, focus_score, energy_score, distress_flag,
       drift_score, current_intent_slug, updated_at, updated_by, reason
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    snapshot.mode,
    numToCell(snapshot.focus_score),
    numToCell(snapshot.energy_score),
    snapshot.distress_flag ? 1 : 0,
    numToCell(snapshot.drift_score),
    snapshot.current_intent_slug,
    snapshot.updated_at,
    snapshot.updated_by,
    reason,
  );

  // Ring-buffer prune: drop oldest beyond SNAPSHOT_RING_SIZE.
  db.prepare(
    `DELETE FROM user_state_snapshots
     WHERE id IN (
       SELECT id FROM user_state_snapshots
       ORDER BY updated_at ASC
       LIMIT MAX(0, (SELECT COUNT(*) FROM user_state_snapshots) - ?)
     )`,
  ).run(SNAPSHOT_RING_SIZE);
}

function emitChange(
  previous: UserStateSnapshot,
  next: UserStateSnapshot,
  reason: string,
): void {
  const changed: UserStateEvent = {
    type: "user_state:changed",
    snapshot: next,
    reason,
  };
  userStateEvents.emit("user_state:changed", changed);

  if (!previous.distress_flag && next.distress_flag) {
    const raised: UserStateEvent = {
      type: "user_state:distress_raised",
      snapshot: next,
    };
    userStateEvents.emit("user_state:distress_raised", raised);
  } else if (previous.distress_flag && !next.distress_flag) {
    const cleared: UserStateEvent = {
      type: "user_state:distress_cleared",
      snapshot: next,
    };
    userStateEvents.emit("user_state:distress_cleared", cleared);
  }
}

// -- public API -----------------------------------------------------------

export function getCurrentUserState(): UserStateSnapshot {
  initUserState();
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM user_state_current WHERE id = ?")
    .get(SINGLETON_ID) as DbRow | undefined;
  const existing = rowToSnapshot(row);
  if (existing) return existing;

  // Cold-boot: persist the default so subsequent mutations have a baseline.
  const seed = coldStartSnapshot();
  writeCurrent(seed);
  appendSnapshot(seed, "cold_start");
  return seed;
}

export interface UpdateUserStateInput {
  // Explicit `| undefined` required under exactOptionalPropertyTypes so
  // Zod-parsed bodies (which produce `T | undefined` for optional fields) pass
  // through without a spread dance at every call site.
  readonly mode?: UserStateMode | undefined;
  readonly focus_score?: number | undefined;
  readonly energy_score?: number | undefined;
  readonly distress_flag?: boolean | undefined;
  readonly drift_score?: number | undefined;
  readonly current_intent_slug?: string | null | undefined;
  readonly updated_by?: UserStateUpdatedBy | undefined;
  readonly reason?: string | undefined;
}

export function updateUserState(
  input: UpdateUserStateInput,
): UserStateSnapshot {
  initUserState();
  const previous = getCurrentUserState();

  const next: UserStateSnapshot = userStateSnapshotSchema.parse({
    mode: input.mode ?? previous.mode,
    ...(input.focus_score !== undefined
      ? { focus_score: input.focus_score }
      : previous.focus_score !== undefined
        ? { focus_score: previous.focus_score }
        : {}),
    ...(input.energy_score !== undefined
      ? { energy_score: input.energy_score }
      : previous.energy_score !== undefined
        ? { energy_score: previous.energy_score }
        : {}),
    distress_flag: input.distress_flag ?? previous.distress_flag,
    ...(input.drift_score !== undefined
      ? { drift_score: input.drift_score }
      : previous.drift_score !== undefined
        ? { drift_score: previous.drift_score }
        : {}),
    current_intent_slug:
      input.current_intent_slug !== undefined
        ? input.current_intent_slug
        : previous.current_intent_slug,
    updated_at: nowIso(),
    updated_by: input.updated_by ?? "self",
  });

  writeCurrent(next);
  const reason = input.reason ?? `manual_${next.updated_by}`;
  appendSnapshot(next, reason);
  emitChange(previous, next, reason);
  return next;
}

/**
 * Submit a signal for heuristic aggregation. Returns the new snapshot after
 * the heuristic runs. Does NOT bypass self-report priority — if a self-report
 * set the state within the same call chain, the heuristic still runs on top
 * (mutations are total, not layered).
 */
export function recordSignal(signal: UserStateSignal): UserStateSnapshot {
  initUserState();
  const previous = getCurrentUserState();

  const at = signal.at ?? nowIso();
  const stampedSignal: UserStateSignal = { ...signal, at };

  // Pull the recent signal window from the snapshot history. We reconstruct
  // "signals" by re-reading snapshot reasons tagged with the signal kind —
  // crude but sufficient for the 5-minute distress window.
  const history = readSignalHistory(at);
  history.unshift(stampedSignal);

  const result: HeuristicResult = applySignal({
    previous,
    signal: stampedSignal,
    history,
    now: at,
  });

  const next = userStateSnapshotSchema.parse(result.next);
  writeCurrent(next);
  appendSnapshot(next, `signal:${stampedSignal.kind}:${result.reason}`);
  emitChange(previous, next, result.reason);
  return next;
}

function readSignalHistory(nowIsoStamp: string): UserStateSignal[] {
  const db = getDb();
  const cutoff = new Date(
    Date.parse(nowIsoStamp) - DISTRESS_WINDOW_MS,
  ).toISOString();
  const rows = db
    .prepare(
      `SELECT updated_at, reason FROM user_state_snapshots
       WHERE updated_at >= ? AND reason LIKE 'signal:%'
       ORDER BY updated_at DESC`,
    )
    .all(cutoff) as DbRow[];
  const out: UserStateSignal[] = [];
  for (const row of rows) {
    const reason = String(row.reason ?? "");
    // reason is "signal:<kind>:<heuristic_reason>"
    const match = /^signal:([a-z_]+):/u.exec(reason);
    if (!match || !match[1]) continue;
    out.push({
      kind: match[1] as UserStateSignal["kind"],
      source: "history",
      at: String(row.updated_at),
    });
  }
  return out;
}

export interface UserStateHistoryFilter {
  readonly limit?: number;
}

export interface UserStateHistoryEntry extends UserStateSnapshot {
  readonly reason: string;
}

export function getUserStateHistory(
  filter: UserStateHistoryFilter = {},
): UserStateHistoryEntry[] {
  initUserState();
  const limit = Math.max(
    1,
    Math.min(SNAPSHOT_RING_SIZE, filter.limit ?? 100),
  );
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM user_state_snapshots
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(limit) as DbRow[];
  const out: UserStateHistoryEntry[] = [];
  for (const row of rows) {
    const snap = rowToSnapshot(row);
    if (!snap) continue;
    out.push({ ...snap, reason: String(row.reason ?? "") });
  }
  return out;
}

/** Test-only. Drops the singleton + all snapshots. */
export function resetUserState(): void {
  initUserState();
  const db = getDb();
  db.exec(
    "DELETE FROM user_state_current; DELETE FROM user_state_snapshots;",
  );
}
