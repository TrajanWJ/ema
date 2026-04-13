/**
 * Loader — persistence-boundary adapter for harvested intents.
 *
 * Ports `Ema.IntentionFarmer.Loader`. The old Loader talked to Ecto
 * directly and broadcast Phoenix PubSub events. We keep the same surface
 * but route writes through two injectable callbacks so the subservice is
 * unit-testable and doesn't drag in a DB or event bus.
 *
 * `HarvestedIntent` is the canonical JSON shape we emit both in-memory and
 * when an external caller serialises the file. `load()` parses that JSON
 * and feeds it back through the pipeline as a one-shot — useful for
 * re-running IntentionFarmer against a previously-captured snapshot.
 */

import { promises as fs } from "node:fs";

export type HarvestedIntentSource =
  | "vault"
  | "git-commit"
  | "channel"
  | "brain-dump"
  | "intent";

export interface HarvestedIntent {
  id: string;
  title: string;
  body: string;
  source: HarvestedIntentSource;
  source_ref: string;
  harvested_at: string;
  suggested_kind?: string;
}

export interface LoaderOptions {
  /** Persist a single intent. Should be idempotent. */
  persist?: (intent: HarvestedIntent) => void | Promise<void>;
  /** Called after each successful persist — meant for event emission. */
  onLoaded?: (intent: HarvestedIntent) => void;
}

export class Loader {
  constructor(private readonly opts: LoaderOptions = {}) {}

  /**
   * Bulk-load a batch of cleaned intents. Returns the subset that was
   * accepted (i.e. didn't throw during persistence). When no persist
   * callback is configured the method is a pass-through.
   */
  loadBatch(intents: HarvestedIntent[]): HarvestedIntent[] {
    const accepted: HarvestedIntent[] = [];
    for (const intent of intents) {
      try {
        this.opts.persist?.(intent);
        accepted.push(intent);
        this.opts.onLoaded?.(intent);
      } catch {
        // Non-fatal: a single failed persist shouldn't poison the batch.
      }
    }
    return accepted;
  }

  /**
   * Load a previously-harvested JSON file. The file may contain either a
   * top-level array of intents or an object with an `intents` field.
   * Invalid shapes return an empty list rather than throwing — the caller
   * can decide what "no harvest on disk" means.
   */
  async loadFromFile(path: string): Promise<HarvestedIntent[]> {
    let raw: string;
    try {
      raw = await fs.readFile(path, "utf8");
    } catch {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    const list = extractList(parsed);
    return list.filter(isHarvestedIntent);
  }
}

function extractList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const maybe = (value as { intents?: unknown }).intents;
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
}

function isHarvestedIntent(value: unknown): value is HarvestedIntent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.body === "string" &&
    typeof v.source === "string" &&
    typeof v.source_ref === "string" &&
    typeof v.harvested_at === "string"
  );
}
