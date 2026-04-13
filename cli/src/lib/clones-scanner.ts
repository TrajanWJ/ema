// clones-scanner.ts
//
// List the directories in `research/_clones/` and compute disk usage.
//
// Clones are shallow-1 git checkouts of upstream repos that other agents
// (not us) drop in. This scanner only reads — it must not create, modify,
// or delete anything under `_clones/`.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { genesisPath } from './genesis-root.js';

export interface CloneEntry {
  /** Basename — e.g. `silverbulletmd-silverbullet`. */
  readonly name: string;
  /** Absolute path. */
  readonly path: string;
  /**
   * Size string from `du -sh`. Null if `du` failed or wasn't available.
   * We keep it as a string rather than bytes because `du -sh` is human-
   * friendly already and reading every file via stat would be slow.
   */
  readonly size: string | null;
}

/** List every clone directory (non-recursive). */
export function scanClones(): readonly CloneEntry[] {
  const clonesDir = genesisPath('research', '_clones');
  const results: CloneEntry[] = [];

  try {
    const entries = readdirSync(clonesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = String(entry.name);
      if (name.startsWith('.')) continue; // skip .hidden dirs
      const abs = join(clonesDir, name);
      results.push({
        name,
        path: abs,
        size: duHuman(abs),
      });
    }
  } catch {
    return [];
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return Object.freeze(results);
}

/**
 * Compute total `_clones/` disk usage as a human-readable string.
 * Used by the `stats` command. Returns '?' if `du` is unavailable.
 */
export function totalClonesDiskUsage(): string {
  const clonesDir = genesisPath('research', '_clones');
  return duHuman(clonesDir) ?? '?';
}

/**
 * Shell out to `du -sh <path>`. We intentionally use the system `du` rather
 * than walking the tree ourselves — a large clone folder can be tens of
 * thousands of files and TypeScript traversal is 10x slower than `du`.
 *
 * Returns the size column (e.g. `12M`) or null if `du` isn't available.
 */
function duHuman(absPath: string): string | null {
  try {
    // `du -sh` prints "12M\t/abs/path". We want just "12M".
    const result = spawnSync('du', ['-sh', absPath], {
      encoding: 'utf8',
      // 5s ceiling — large clones can take time, but we don't want to hang.
      timeout: 5000,
    });
    if (result.status !== 0 || typeof result.stdout !== 'string') return null;
    const [size] = result.stdout.split('\t');
    return size?.trim() || null;
  } catch {
    return null;
  }
}

/** Used in extractions-scanner to tell whether a clone matches an extraction. */
export function hasClone(name: string): boolean {
  const abs = join(genesisPath('research', '_clones'), name);
  try {
    return statSync(abs).isDirectory();
  } catch {
    return false;
  }
}
