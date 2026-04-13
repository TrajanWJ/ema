// proposal-loader.ts
//
// Walk ema-genesis/proposals/ and parse every proposal. Mirrors intent-loader.
// Proposals follow the same folder convention as intents:
//   ema-genesis/proposals/<SLUG>/README.md
//
// Or for early-phase proposals stored as loose markdown:
//   ema-genesis/proposals/<SLUG>.md
//
// If the proposals/ directory doesn't exist, returns an empty list (no error).
// This is expected during bootstrap when no proposals have been written yet.

import { readdirSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { findGenesisRoot, genesisPath } from './genesis-root.js';
import { parseFrontmatter, getString, getStringArray } from './frontmatter.js';

export interface ProposalFrontmatter {
  readonly id: string | undefined;
  readonly type: string | undefined;
  readonly title: string | undefined;
  readonly status: string | undefined;
  readonly priority: string | undefined;
  readonly intentSlug: string | undefined;
  readonly proposedBy: string | undefined;
  readonly created: string | undefined;
  readonly updated: string | undefined;
  readonly tags: readonly string[];
}

export interface Proposal {
  readonly path: string;
  readonly relPath: string;
  readonly slug: string;
  readonly isFolder: boolean;
  readonly frontmatter: ProposalFrontmatter;
  readonly body: string;
}

const CACHE = new Map<string, readonly Proposal[]>();

function proposalsRoot(): string {
  return genesisPath('proposals');
}

export async function loadAllProposals(): Promise<readonly Proposal[]> {
  const root = proposalsRoot();
  const cached = CACHE.get(root);
  if (cached) return cached;

  if (!existsSync(root)) {
    CACHE.set(root, []);
    return [];
  }

  const genesisRoot = findGenesisRoot();
  const proposals: Proposal[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const name = String(entry.name);
    if (name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      const readme = join(root, name, 'README.md');
      if (!existsSync(readme)) continue;
      proposals.push(buildProposal(readme, genesisRoot, name, true));
      continue;
    }

    if (entry.isFile() && name.endsWith('.md')) {
      const full = join(root, name);
      const slug = basename(name, '.md');
      proposals.push(buildProposal(full, genesisRoot, slug, false));
    }
  }

  proposals.sort((a, b) => a.slug.localeCompare(b.slug));
  CACHE.set(root, proposals);
  return proposals;
}

export async function findProposalBySlug(slug: string): Promise<Proposal | undefined> {
  const all = await loadAllProposals();
  return all.find((p) => p.slug === slug);
}

function buildProposal(
  absPath: string,
  genesisRoot: string,
  slug: string,
  isFolder: boolean,
): Proposal {
  const parsed = parseFrontmatter(absPath);
  const data = parsed.data;

  const frontmatter: ProposalFrontmatter = {
    id: getString(data, 'id'),
    type: getString(data, 'type'),
    title: getString(data, 'title'),
    status: getString(data, 'status'),
    priority: getString(data, 'priority'),
    intentSlug: getString(data, 'intent_slug'),
    proposedBy: getString(data, 'proposed_by'),
    created: getString(data, 'created'),
    updated: getString(data, 'updated'),
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
