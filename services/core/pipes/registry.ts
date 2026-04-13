/**
 * Pipes registry — the single name→metadata lookup for triggers, actions,
 * and transforms. Ported verbatim from `Ema.Pipes.Registry` (Elixir).
 *
 * Counts (as of v0.1 bootstrap):
 *   - triggers: 21  (Appendix A.3 heading says 22; source enumerates 21)
 *   - actions:  21  (Appendix A.3 heading says 15; source enumerates 21)
 *   - transforms: 5
 *
 * See `ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md` §A.3 and the Elixir
 * source at `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/pipes/registry.ex`.
 */

import { allTriggers } from "./triggers/index.js";
import { allActions } from "./actions/index.js";
import { allTransforms } from "./transforms/index.js";
import type {
  ActionDef,
  ActionName,
  TransformDef,
  TransformName,
  TriggerDef,
  TriggerName,
} from "./types.js";

function indexByName<T extends { name: string }>(
  entries: readonly T[],
): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    if (map.has(entry.name)) {
      throw new Error(`duplicate registry entry: ${entry.name}`);
    }
    map.set(entry.name, entry);
  }
  return map;
}

const triggerIndex = indexByName(allTriggers);
const actionIndex = indexByName(allActions);
const transformIndex = indexByName(allTransforms);

export const registry = {
  triggers: allTriggers,
  actions: allActions,
  transforms: allTransforms,
  getTrigger(name: TriggerName): TriggerDef | undefined {
    return triggerIndex.get(name);
  },
  getAction(name: ActionName): ActionDef | undefined {
    return actionIndex.get(name);
  },
  getTransform(name: TransformName): TransformDef | undefined {
    return transformIndex.get(name);
  },
  hasTrigger(name: string): boolean {
    return triggerIndex.has(name);
  },
  hasAction(name: string): boolean {
    return actionIndex.has(name);
  },
  hasTransform(name: string): boolean {
    return transformIndex.has(name as TransformName);
  },
  counts: {
    triggers: allTriggers.length,
    actions: allActions.length,
    transforms: allTransforms.length,
  } as const,
} as const;

export type PipesRegistry = typeof registry;
