// frontmatter.ts
//
// Thin wrapper around gray-matter with typed helpers for the research node
// frontmatter shape. gray-matter does the YAML parse; everything else here
// is adapter + validation.
//
// The canonical shape (Bootstrap v0.2) is:
//
//   id: RES-<slug>
//   type: research
//   layer: research
//   category: <category-name>
//   title: "owner/repo — tagline"
//   status: active
//   created: 2026-04-12
//   author: research-round-N
//   source:
//     url: https://github.com/owner/repo
//     stars: 42000
//     verified: 2026-04-12
//     last_activity: 2026-04-11
//   signal_tier: S | A | B
//   tags: [research, category, keyword1, keyword2]
//   connections:
//     - { target: "[[wikilink]]", relation: references }
//
// Unknown extra fields are allowed — we don't want to break when research
// rounds add new keys. We just surface the typed fields we care about and
// keep the rest on `raw`.

import { readFileSync } from 'node:fs';
import matter from 'gray-matter';

export interface ParsedMarkdown {
  /** Absolute path the file was read from. Helpful for error messages. */
  readonly path: string;
  /** Raw frontmatter object — unknown shape, all keys preserved. */
  readonly data: Record<string, unknown>;
  /** Markdown body below the frontmatter fence. */
  readonly content: string;
}

/** Parse a markdown file. Throws if the file is unreadable. */
export function parseFrontmatter(absPath: string): ParsedMarkdown {
  const raw = readFileSync(absPath, 'utf8');
  const parsed = matter(raw);
  return {
    path: absPath,
    data: (parsed.data ?? {}) as Record<string, unknown>,
    content: parsed.content ?? '',
  };
}

/**
 * Narrowed lookup helpers. We intentionally return `undefined` rather than
 * throwing so that malformed research nodes show up as gaps in `stats` and
 * `extractions --missing` rather than breaking the whole CLI.
 */

export function getString(
  data: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = data[key];
  return typeof v === 'string' ? v : undefined;
}

export function getNumber(
  data: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = data[key];
  return typeof v === 'number' ? v : undefined;
}

export function getStringArray(
  data: Record<string, unknown>,
  key: string,
): string[] {
  const v = data[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

/** Drill into a nested object — e.g. `getNested(data, 'source', 'url')`. */
export function getNested(
  data: Record<string, unknown>,
  ...path: string[]
): unknown {
  let cursor: unknown = data;
  for (const key of path) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}
