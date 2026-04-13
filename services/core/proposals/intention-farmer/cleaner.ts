/**
 * Cleaner — dedup + empty-removal for harvested intents.
 *
 * Ports `Ema.IntentionFarmer.Cleaner`. The Elixir version also did
 * split-session merging and quality scoring for terminal sessions — we drop
 * those here because the new IntentionFarmer works on single intents rather
 * than parsed session structs. Merging/scoring can live in whichever module
 * actually parses the sessions, if and when we port that piece.
 *
 * Dedup key: `${source}:${trimmed content slice 0..200}`. The same content
 * harvested from two different sources legitimately counts twice — that
 * matches the old behaviour where the fingerprint included source_type.
 */

import { createHash } from "node:crypto";

import type { HarvestedIntent } from "./loader.js";

export interface CleanResult {
  kept: HarvestedIntent[];
  duplicates: HarvestedIntent[];
  empties: HarvestedIntent[];
}

export class Cleaner {
  clean(intents: HarvestedIntent[]): CleanResult {
    const empties: HarvestedIntent[] = [];
    const duplicates: HarvestedIntent[] = [];
    const kept: HarvestedIntent[] = [];
    const seen = new Set<string>();

    for (const intent of intents) {
      if (isEmpty(intent)) {
        empties.push(intent);
        continue;
      }
      const fp = fingerprint(intent);
      if (seen.has(fp)) {
        duplicates.push(intent);
        continue;
      }
      seen.add(fp);
      kept.push(intent);
    }

    return { kept, duplicates, empties };
  }
}

function isEmpty(intent: HarvestedIntent): boolean {
  const title = (intent.title ?? "").trim();
  const body = (intent.body ?? "").trim();
  return title.length === 0 && body.length === 0;
}

function fingerprint(intent: HarvestedIntent): string {
  const slice = `${intent.title}\n${intent.body}`.slice(0, 200);
  const payload = `${intent.source}:${slice}`;
  return createHash("sha256").update(payload).digest("hex");
}
