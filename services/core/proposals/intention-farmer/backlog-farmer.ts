/**
 * BacklogFarmer — periodic batch harvester.
 *
 * Ports `Ema.IntentionFarmer.BacklogFarmer` but strips the GenServer + PubSub
 * plumbing. Instead it exposes a plain `run()` method that a scheduler
 * (cron, setInterval, whatever) can call. The old module relied on
 * SourceRegistry + Parser + Cleaner + Loader + NoteEmitter GenServers — we
 * keep that call graph visible via a dependency bag so the IntentionFarmer
 * façade can assemble the pipeline once and reuse it.
 */

import type { HarvestedIntent } from "./loader.js";
import type { Cleaner } from "./cleaner.js";
import type { Loader } from "./loader.js";

export interface BacklogFarmerDeps {
  /** Returns every candidate intent across the registered sources. */
  collect(): Promise<HarvestedIntent[]>;
  cleaner: Cleaner;
  loader: Loader;
}

export interface BacklogSummary {
  collected: number;
  duplicates: number;
  empties: number;
  loaded: number;
  intents: HarvestedIntent[];
}

export class BacklogFarmer {
  constructor(private readonly deps: BacklogFarmerDeps) {}

  async run(): Promise<BacklogSummary> {
    const collected = await this.deps.collect();
    const { kept, duplicates, empties } = this.deps.cleaner.clean(collected);
    const loaded = this.deps.loader.loadBatch(kept);

    return {
      collected: collected.length,
      duplicates: duplicates.length,
      empties: empties.length,
      loaded: loaded.length,
      intents: loaded,
    };
  }
}
