// intent-loader.ts
//
// Walk ema-genesis/intents/, parse every intent, return a typed array.
//
// Intents live one of two ways:
//   - Folder form:  ema-genesis/intents/<SLUG>/README.md   (preferred, the convention)
//   - File form:    ema-genesis/intents/<SLUG>.md          (tolerated, e.g. GAC-QUEUE-MOC.md)
//
// Results are cached per-invocation to match the existing node-loader pattern.
// See lib/node-loader.ts for the research-side analogue.

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { findGenesisRoot, intentsRoot } from './genesis-root.js';
import { parseFrontmatter, getString, getStringArray } from './frontmatter.js';

export type IntentKind =
  | 'port'
  | 'wiring'
  | 'new-work'
  | 'reconciliation'
  | 'canon-repair'
  | 'process'
  | 'historical-sprint'
  | 'recovery'
  | string; // tolerate new kinds without breaking

export interface IntentFrontmatter {
  readonly id: string | undefined;
  readonly type: string | undefined; // intent | gac_card | moc | ...
  readonly title: string | undefined;
  readonly status: string | undefined;
  readonly kind: IntentKind | undefined;
  readonly phase: string | undefined;
  readonly priority: string | undefined;
  readonly author: string | undefined;
  readonly created: string | undefined;
  readonly updated: string | undefined;
  readonly exitCondition: string | undefined;
  readonly tags: readonly string[];
}

export interface Intent {
  /** Absolute path to the README.md (or the single-file intent markdown). */
  readonly path: string;
  /** Path relative to the genesis root. */
  readonly relPath: string;
  /** The directory name (or file basename without .md) used as the slug. */
  readonly slug: string;
  /** True if this intent lives as `intents/<slug>/README.md`. False if it's a loose .md file. */
  readonly isFolder: boolean;
  readonly frontmatter: IntentFrontmatter;
  readonly body: string;
}

const CACHE = new Map<string, readonly Intent[]>();

/** Load every intent under ema-genesis/intents/. */
export async function loadAllIntents(): Promise<readonly Intent[]> {
  const root = intentsRoot();
  const cached = CACHE.get(root);
  if (cached) return cached;

  const genesisRoot = findGenesisRoot();
  const intents: Intent[] = [];

  if (!existsSync(root)) {
    CACHE.set(root, []);
    return [];
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      const readme = join(root, entry.name, 'README.md');
      if (!existsSync(readme)) continue;
      intents.push(buildIntent(readme, genesisRoot, entry.name, true));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      const full = join(root, entry.name);
      const slug = basename(entry.name, '.md');
      intents.push(buildIntent(full, genesisRoot, slug, false));
    }
  }

  // Sort: GACs first (GAC-NNN by number), then INTs alphabetically.
  intents.sort((a, b) => {
    const aIsGac = a.slug.startsWith('GAC-');
    const bIsGac = b.slug.startsWith('GAC-');
    if (aIsGac && !bIsGac) return -1;
    if (!aIsGac && bIsGac) return 1;
    return a.slug.localeCompare(b.slug);
  });

  CACHE.set(root, intents);
  return intents;
}

/** Load a single intent by slug. Returns undefined if not found. */
export async function findIntentBySlug(slug: string): Promise<Intent | undefined> {
  const all = await loadAllIntents();
  return all.find((i) => i.slug === slug);
}

function buildIntent(
  absPath: string,
  genesisRoot: string,
  slug: string,
  isFolder: boolean,
): Intent {
  const parsed = parseFrontmatter(absPath);
  const data = parsed.data;

  const frontmatter: IntentFrontmatter = {
    id: getString(data, 'id'),
    type: getString(data, 'type'),
    title: getString(data, 'title'),
    status: getString(data, 'status'),
    kind: getString(data, 'kind'),
    phase: getString(data, 'phase'),
    priority: getString(data, 'priority'),
    author: getString(data, 'author'),
    created: getString(data, 'created'),
    updated: getString(data, 'updated'),
    exitCondition: getString(data, 'exit_condition'),
    tags: getStringArray(data, 'tags'),
  };

  return {
    path: absPath,
    relPath: relative(genesisRoot, absPath),
    slug,
    isFolder,
    frontmatter,
    body: parsed.content,
  };
}
