/**
 * Reflexion context injector.
 *
 * Port of the old Elixir `Ema.Executions.ReflexionInjector` behaviour (see
 * `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/executions/dispatcher.ex:126`).
 * When a new execution is dispatched against an intent, prior completed
 * executions for that same intent carry lessons worth feeding into the new
 * prompt. This module fetches the last N such executions, newest first, and
 * exposes a plain-text prefix builder the dispatcher prepends to the prompt.
 *
 * Side-effect-free reads only. No writes, no events.
 */

import type Database from "better-sqlite3";

import type {
  ExecutionRecord,
  ExecutionStep,
} from "./executions.service.js";
import { mapExecutionRow } from "./executions.service.js";

export interface ReflexionOptions {
  limit?: number;
  /** Exclude this execution id from the returned list. */
  excludeId?: string | undefined;
}

const DEFAULT_LIMIT = 5;

export function getReflexionContext(
  db: Database.Database,
  intentSlug: string,
  options: ReflexionOptions = {},
): ExecutionRecord[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!intentSlug || limit <= 0) return [];

  const params: unknown[] = [intentSlug];
  let sql =
    "SELECT * FROM executions WHERE intent_slug = ? AND archived_at IS NULL";
  if (options.excludeId) {
    sql += " AND id != ?";
    params.push(options.excludeId);
  }
  sql += " ORDER BY COALESCE(completed_at, updated_at) DESC, created_at DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return rows
    .map((row) => mapExecutionRow(row))
    .filter((exec): exec is ExecutionRecord => exec !== null);
}

/**
 * Build a reflexion prefix the dispatcher prepends to a new execution's
 * prompt. Empty string if there is no usable history — callers should test
 * for that and skip the concatenation to avoid a leading separator.
 */
export function buildReflexionPrefix(history: ExecutionRecord[]): string {
  if (history.length === 0) return "";

  const lines: string[] = [
    "# Reflexion — lessons from prior executions of this intent",
    "",
  ];
  for (const exec of history) {
    const when = exec.completed_at ?? exec.updated_at;
    lines.push(`- [${when}] ${exec.title} (${exec.status})`);
    if (exec.objective) {
      lines.push(`    objective: ${exec.objective}`);
    }
    const journal = exec.step_journal ?? [];
    if (journal.length > 0) {
      const lastStep = journal[journal.length - 1];
      if (lastStep) {
        lines.push(`    last step: ${summariseStep(lastStep)}`);
      }
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

function summariseStep(step: ExecutionStep): string {
  if (step.note) return `${step.label} — ${step.note}`;
  return step.label;
}
