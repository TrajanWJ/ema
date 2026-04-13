// extractions-scanner.ts
//
// List the `.md` files in `research/_extractions/` and match them back to
// research nodes. Matching is by basename convention: an extraction named
// `owner-repo.md` maps to the research node `research/<category>/owner-repo.md`.
//
// The template file `_TEMPLATE.md` is excluded — it's a scaffolding doc, not
// a real extraction.
//
// Like clones-scanner, this is READ-ONLY. Other agents own writes to
// `_extractions/`.

import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { genesisPath } from './genesis-root.js';
import { parseFrontmatter, getNested } from './frontmatter.js';
import type { ResearchNode } from './node-loader.js';

export interface ExtractionEntry {
  /** Basename without extension — e.g. `silverbulletmd-silverbullet`. */
  readonly slug: string;
  /** Absolute path. */
  readonly path: string;
  /** Path relative to genesis root. */
  readonly relPath: string;
  /** Resolved `source.url` from frontmatter, if present. */
  readonly sourceUrl: string | undefined;
  /** Resolved `clone_path` from frontmatter. */
  readonly clonePath: string | undefined;
}

/** List every extraction doc, sorted by slug. */
export function scanExtractions(): readonly ExtractionEntry[] {
  const dir = genesisPath('research', '_extractions');
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: ExtractionEntry[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name === '_TEMPLATE.md') continue;
    if (entry.name.startsWith('_MOC')) continue;

    const abs = join(dir, entry.name);
    const slug = basename(entry.name, '.md');
    const parsed = safeParse(abs);
    out.push({
      slug,
      path: abs,
      relPath: `ema-genesis/research/_extractions/${entry.name}`,
      sourceUrl: asString(getNested(parsed, 'source', 'url')),
      clonePath: asString(parsed['clone_path']),
    });
  }

  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return Object.freeze(out);
}

/**
 * Return the research nodes that DON'T have a matching extraction doc.
 * Matching rule: an extraction `foo-bar.md` satisfies any research node
 * with slug `foo-bar`.
 *
 * Used by `ema research extractions --missing` to see the gap between
 * what's been researched vs. what's been pulled-apart-at-source.
 */
export function nodesMissingExtractions(
  allNodes: readonly ResearchNode[],
): readonly ResearchNode[] {
  const present = new Set(scanExtractions().map((e) => e.slug));
  return allNodes.filter((n) => !present.has(n.slug));
}

/** Never throw — callers want a best-effort scan. */
function safeParse(absPath: string): Record<string, unknown> {
  try {
    return parseFrontmatter(absPath).data;
  } catch {
    return {};
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
