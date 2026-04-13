// node-loader.ts
//
// Walk the research tree, parse every markdown file, return a typed array.
//
// This is the one place that knows what directories to skip:
//   - `_moc/`        category indexes, not nodes themselves
//   - `_clones/`     cloned source trees — never parsed as research
//   - `_extractions/` extraction docs (different entity, different loader)
//   - `research-ingestion/_MOC.md`   category index; real nodes may now exist
//
// Results are cached in-process for the lifetime of a single CLI invocation.
// Each command gets a fresh cache, so there's no stale-data risk between
// invocations. For daemon use cases later, add explicit invalidation.

import { readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { researchRoot } from './genesis-root.js';
import {
  parseFrontmatter,
  getString,
  getStringArray,
  getNested,
  getNumber,
} from './frontmatter.js';

export type SignalTier = 'S' | 'A' | 'B';

export interface ResearchNodeFrontmatter {
  readonly id: string | undefined;
  readonly category: string | undefined;
  readonly title: string | undefined;
  readonly status: string | undefined;
  readonly author: string | undefined;
  readonly signal_tier: SignalTier | undefined;
  readonly tags: readonly string[];
  readonly sourceUrl: string | undefined;
  readonly sourceStars: number | undefined;
  readonly sourceLastActivity: string | undefined;
  readonly sourceVerified: string | undefined;
}

export interface ResearchNode {
  /** Absolute filesystem path. */
  readonly path: string;
  /** Path relative to genesis root — e.g. `research/cli-terminal/oclif-oclif.md`. */
  readonly relPath: string;
  /** File basename without extension — e.g. `oclif-oclif`. Used as the slug. */
  readonly slug: string;
  /** Directory name under research/ — e.g. `cli-terminal`. */
  readonly category: string;
  /** Parsed + normalized frontmatter. */
  readonly frontmatter: ResearchNodeFrontmatter;
  /** Markdown body (excluding the frontmatter fence). */
  readonly body: string;
}

// Module-level cache, cleared per CLI invocation. Keyed by the
// resolved research root so tests that point at different roots don't
// collide.
const CACHE = new Map<string, readonly ResearchNode[]>();

/**
 * Load every research node under `research/<category>/*.md`.
 * Excludes MOC files, clones, and extraction docs.
 */
export async function loadAllResearchNodes(): Promise<readonly ResearchNode[]> {
  const root = researchRoot();
  const cached = CACHE.get(root);
  if (cached) return cached;

  const nodes: ResearchNode[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue; // _moc, _clones, _extractions

    const categoryDir = join(root, entry.name);
    for (const file of readdirSync(categoryDir, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      if (!file.name.endsWith('.md')) continue;
      if (file.name === '_MOC.md') continue;
      const abs = join(categoryDir, file.name);
      const node = tryLoadNode(abs, entry.name);
      if (node) nodes.push(node);
    }
  }

  // Stable sort for deterministic output.
  nodes.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const frozen = Object.freeze(nodes);
  CACHE.set(root, frozen);
  return frozen;
}

/** Parse one node. Returns null on any read error — the file is silently skipped. */
function tryLoadNode(absPath: string, category: string): ResearchNode | null {
  try {
    if (!statSync(absPath).isFile()) return null;
    const parsed = parseFrontmatter(absPath);
    const slug = basename(absPath, '.md');
    const root = researchRoot();
    // Resolve relPath from genesis root (research/category/file.md), not
    // from research/ itself — matches how nodes are referenced in wikilinks.
    const relPath = relative(join(root, '..'), absPath).split('\\').join('/');

    const frontmatter: ResearchNodeFrontmatter = {
      id: getString(parsed.data, 'id'),
      category: getString(parsed.data, 'category') ?? category,
      title: getString(parsed.data, 'title'),
      status: getString(parsed.data, 'status'),
      author: getString(parsed.data, 'author'),
      signal_tier: parseSignalTier(getString(parsed.data, 'signal_tier')),
      tags: Object.freeze(getStringArray(parsed.data, 'tags')),
      sourceUrl: asString(getNested(parsed.data, 'source', 'url')),
      sourceStars: asNumber(getNested(parsed.data, 'source', 'stars')),
      sourceLastActivity: asString(
        getNested(parsed.data, 'source', 'last_activity'),
      ),
      sourceVerified: asString(getNested(parsed.data, 'source', 'verified')),
    };

    return {
      path: absPath,
      relPath,
      slug,
      category,
      frontmatter,
      body: parsed.content,
    };
  } catch {
    return null;
  }
}

function parseSignalTier(value: string | undefined): SignalTier | undefined {
  if (value === 'S' || value === 'A' || value === 'B') return value;
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * Find a node by slug OR by frontmatter id. Slug match wins — it's the
 * filesystem path users actually type. Case-insensitive.
 */
export async function findResearchNodeBySlug(
  query: string,
): Promise<ResearchNode | undefined> {
  const q = query.toLowerCase();
  const nodes = await loadAllResearchNodes();
  // Exact slug match first.
  const bySlug = nodes.find((n) => n.slug.toLowerCase() === q);
  if (bySlug) return bySlug;
  // Then exact id match.
  const byId = nodes.find((n) => n.frontmatter.id?.toLowerCase() === q);
  if (byId) return byId;
  // Then prefix match on slug — useful for `ema research get oclif`.
  const byPrefix = nodes.find((n) => n.slug.toLowerCase().startsWith(q));
  if (byPrefix) return byPrefix;
  return undefined;
}

/** Used by stats/categories commands. */
export function groupByCategory(
  nodes: readonly ResearchNode[],
): Map<string, readonly ResearchNode[]> {
  const map = new Map<string, ResearchNode[]>();
  for (const node of nodes) {
    const key = node.category;
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(node);
    } else {
      map.set(key, [node]);
    }
  }
  return new Map(
    Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, Object.freeze(v)] as const),
  );
}

/** Count nodes by signal tier. Unknown tiers bucket as 'unknown'. */
export function groupBySignalTier(
  nodes: readonly ResearchNode[],
): Record<'S' | 'A' | 'B' | 'unknown', number> {
  const counts = { S: 0, A: 0, B: 0, unknown: 0 };
  for (const node of nodes) {
    const tier = node.frontmatter.signal_tier;
    if (tier === 'S' || tier === 'A' || tier === 'B') {
      counts[tier] += 1;
    } else {
      counts.unknown += 1;
    }
  }
  return counts;
}

// Re-export a shim so upstream callers can also grab the loader's
// underlying parser without reaching into lib/frontmatter.ts directly.
export { parseFrontmatter } from './frontmatter.js';
