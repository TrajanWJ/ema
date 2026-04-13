// research list — tabular view of all research nodes.
//
// Filters:
//   --category=<name>   limit to one category dir
//   --signal=<S|A|B>    limit to one signal tier
//   --json              emit JSON instead of a table
//
// The default (no filter) lists every node sorted by category → slug.

import { Command, Flags } from '@oclif/core';
import { loadAllResearchNodes } from '../../lib/node-loader.js';
import {
  printTable,
  colorSignalTier,
  truncate,
  printJson,
} from '../../lib/table-printer.js';

export default class ResearchList extends Command {
  public static override readonly description =
    'List research nodes. Filter by --category or --signal.';

  public static override readonly examples = [
    '<%= config.bin %> research list',
    '<%= config.bin %> research list --category=cli-terminal',
    '<%= config.bin %> research list --signal=S --json',
  ];

  public static override readonly flags = {
    category: Flags.string({
      char: 'c',
      description: 'Filter to a single research category (e.g. cli-terminal).',
      required: false,
    }),
    signal: Flags.string({
      char: 's',
      description: 'Filter to a signal tier: S, A, or B.',
      required: false,
    }),
    json: Flags.boolean({
      description: 'Emit JSON instead of a formatted table.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ResearchList);

    const all = await loadAllResearchNodes();
    const filtered = all.filter((node) => {
      if (flags.category && node.category !== flags.category) return false;
      if (flags.signal) {
        const want = flags.signal.toUpperCase();
        if (node.frontmatter.signal_tier !== want) return false;
      }
      return true;
    });

    if (flags.json) {
      printJson(
        filtered.map((n) => ({
          slug: n.slug,
          id: n.frontmatter.id,
          category: n.category,
          title: n.frontmatter.title,
          signal_tier: n.frontmatter.signal_tier,
          source_url: n.frontmatter.sourceUrl,
          source_stars: n.frontmatter.sourceStars,
          last_activity: n.frontmatter.sourceLastActivity,
          tags: n.frontmatter.tags,
          rel_path: n.relPath,
        })),
      );
      return;
    }

    if (filtered.length === 0) {
      this.log('No research nodes match the given filters.');
      return;
    }

    printTable(
      [
        { header: 'Slug', width: 34 },
        { header: 'Category', width: 22 },
        { header: 'Tier', align: 'center' },
        { header: 'Stars', align: 'right' },
        { header: 'Last activity' },
        { header: 'Title' },
      ],
      filtered.map((n) => [
        n.slug,
        n.category,
        colorSignalTier(n.frontmatter.signal_tier),
        formatStars(n.frontmatter.sourceStars),
        n.frontmatter.sourceLastActivity ?? '',
        truncate(n.frontmatter.title, 60),
      ]),
    );

    this.log(`\n${filtered.length} of ${all.length} research nodes.`);
  }
}

function formatStars(n: number | undefined): string {
  if (typeof n !== 'number') return '';
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}
