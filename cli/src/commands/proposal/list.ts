// ema proposal list
//
// Tabular view of every proposal in ema-genesis/proposals/.
// Returns gracefully if the proposals directory doesn't exist yet (bootstrap state).

import { Command, Flags } from '@oclif/core';
import { loadAllProposals } from '../../lib/proposal-loader.js';
import { printTable, truncate, printJson } from '../../lib/table-printer.js';

export default class ProposalList extends Command {
  public static override readonly description: string =
    'List proposals. Filter by --status or --priority.';

  public static override readonly examples = [
    '<%= config.bin %> proposal list',
    '<%= config.bin %> proposal list --status=queued',
    '<%= config.bin %> proposal list --priority=critical --json',
  ];

  public static override readonly flags = {
    status: Flags.string({
      char: 's',
      description: 'Filter to a single status (queued, approved, rejected, ...).',
      required: false,
    }),
    priority: Flags.string({
      char: 'p',
      description: 'Filter to a single priority (critical, high, medium, low).',
      required: false,
    }),
    json: Flags.boolean({
      description: 'Emit JSON instead of a formatted table.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ProposalList);

    const all = await loadAllProposals();
    const filtered = all.filter((p) => {
      if (flags.status && p.frontmatter.status !== flags.status) return false;
      if (flags.priority && p.frontmatter.priority !== flags.priority) return false;
      return true;
    });

    if (flags.json) {
      printJson(
        filtered.map((p) => ({
          slug: p.slug,
          id: p.frontmatter.id,
          status: p.frontmatter.status,
          priority: p.frontmatter.priority,
          intent_slug: p.frontmatter.intentSlug,
          title: p.frontmatter.title,
          proposed_by: p.frontmatter.proposedBy,
          created: p.frontmatter.created,
          rel_path: p.relPath,
        })),
      );
      return;
    }

    if (all.length === 0) {
      this.log('No proposals yet. (ema-genesis/proposals/ is empty or missing — expected during bootstrap.)');
      return;
    }

    if (filtered.length === 0) {
      this.log('No proposals match the given filters.');
      return;
    }

    printTable(
      [
        { header: 'Slug', width: 32 },
        { header: 'Status', width: 12 },
        { header: 'Priority', width: 10 },
        { header: 'Intent', width: 28 },
        { header: 'Title' },
      ],
      filtered.map((p) => [
        p.slug,
        p.frontmatter.status ?? '—',
        p.frontmatter.priority ?? '—',
        truncate(p.frontmatter.intentSlug, 28),
        truncate(p.frontmatter.title, 60),
      ]),
    );

    this.log(`\n${filtered.length} of ${all.length} proposals.`);
  }
}
