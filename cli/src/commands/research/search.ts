// research search — substring search across frontmatter + body.
//
// Scope of the search:
//   - frontmatter.title
//   - frontmatter.tags
//   - frontmatter.sourceUrl
//   - frontmatter.id
//   - body (markdown content below the frontmatter)
//
// This is deliberately simple string-contains matching — no regex, no
// fuzzy, no stemming. If/when the research corpus crosses ~1000 nodes,
// swap this for a proper index (minisearch, lunr, or sqlite FTS).

import { Args, Command, Flags } from '@oclif/core';
import { loadAllResearchNodes } from '../../lib/node-loader.js';
import {
  printTable,
  colorSignalTier,
  truncate,
  printJson,
} from '../../lib/table-printer.js';

interface SearchHit {
  readonly slug: string;
  readonly category: string;
  readonly title: string;
  readonly signalTier: string | undefined;
  readonly matchKind: 'title' | 'tag' | 'id' | 'source' | 'body';
  readonly snippet: string;
}

export default class ResearchSearch extends Command {
  public static override readonly description =
    'Search research node frontmatter and body for a substring.';

  public static override readonly examples = [
    '<%= config.bin %> research search oclif',
    '<%= config.bin %> research search "object index" --json',
  ];

  public static override readonly args = {
    query: Args.string({
      name: 'query',
      description: 'Substring to search for (case-insensitive).',
      required: true,
    }),
  };

  public static override readonly flags = {
    json: Flags.boolean({
      description: 'Emit JSON instead of a table.',
      default: false,
    }),
    limit: Flags.integer({
      description: 'Max results to return.',
      default: 50,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ResearchSearch);
    const needle = args.query.toLowerCase();
    if (needle.length === 0) {
      this.error('Empty query. Pass at least one character.', { exit: 1 });
    }

    const nodes = await loadAllResearchNodes();
    const hits: SearchHit[] = [];

    for (const node of nodes) {
      const title = node.frontmatter.title ?? '';
      if (title.toLowerCase().includes(needle)) {
        hits.push({
          slug: node.slug,
          category: node.category,
          title,
          signalTier: node.frontmatter.signal_tier,
          matchKind: 'title',
          snippet: title,
        });
        continue;
      }
      const matchingTag = node.frontmatter.tags.find((t) =>
        t.toLowerCase().includes(needle),
      );
      if (matchingTag) {
        hits.push({
          slug: node.slug,
          category: node.category,
          title,
          signalTier: node.frontmatter.signal_tier,
          matchKind: 'tag',
          snippet: `#${matchingTag}`,
        });
        continue;
      }
      if (node.frontmatter.id?.toLowerCase().includes(needle)) {
        hits.push({
          slug: node.slug,
          category: node.category,
          title,
          signalTier: node.frontmatter.signal_tier,
          matchKind: 'id',
          snippet: node.frontmatter.id,
        });
        continue;
      }
      if (node.frontmatter.sourceUrl?.toLowerCase().includes(needle)) {
        hits.push({
          slug: node.slug,
          category: node.category,
          title,
          signalTier: node.frontmatter.signal_tier,
          matchKind: 'source',
          snippet: node.frontmatter.sourceUrl,
        });
        continue;
      }
      // Body fallback — scan once, extract a surrounding window for context.
      const bodyLower = node.body.toLowerCase();
      const idx = bodyLower.indexOf(needle);
      if (idx >= 0) {
        hits.push({
          slug: node.slug,
          category: node.category,
          title,
          signalTier: node.frontmatter.signal_tier,
          matchKind: 'body',
          snippet: extractSnippet(node.body, idx, needle.length),
        });
      }
    }

    const capped = hits.slice(0, flags.limit);

    if (flags.json) {
      printJson(capped);
      return;
    }

    if (capped.length === 0) {
      this.log(`No matches for "${args.query}".`);
      return;
    }

    printTable(
      [
        { header: 'Slug', width: 30 },
        { header: 'Cat', width: 20 },
        { header: 'Tier', align: 'center' },
        { header: 'Matched' },
        { header: 'Snippet' },
      ],
      capped.map((h) => [
        h.slug,
        h.category,
        colorSignalTier(h.signalTier),
        h.matchKind,
        truncate(h.snippet, 60),
      ]),
    );

    const tail = hits.length > capped.length ? ` (capped at ${flags.limit})` : '';
    this.log(`\n${capped.length} of ${hits.length} hits${tail}.`);
  }
}

/**
 * Pull ~80 chars of context around a match in the body. Collapses newlines
 * to spaces so the snippet fits on one table row.
 */
function extractSnippet(body: string, idx: number, matchLen: number): string {
  const window = 40;
  const start = Math.max(0, idx - window);
  const end = Math.min(body.length, idx + matchLen + window);
  const raw = body.slice(start, end).replace(/\s+/g, ' ').trim();
  const prefix = start > 0 ? '…' : '';
  const suffix = end < body.length ? '…' : '';
  return `${prefix}${raw}${suffix}`;
}
