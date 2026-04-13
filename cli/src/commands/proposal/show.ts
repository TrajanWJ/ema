// ema proposal show <slug>
//
// Print the frontmatter + body for a single proposal by slug.

import { Args, Command, Flags } from '@oclif/core';
import { loadAllProposals, findProposalBySlug } from '../../lib/proposal-loader.js';
import { printJson } from '../../lib/table-printer.js';

export default class ProposalShow extends Command {
  public static override readonly description: string =
    'Show a single proposal by slug.';

  public static override readonly examples = [
    '<%= config.bin %> proposal show PROP-001',
    '<%= config.bin %> proposal show PROP-001 --json',
  ];

  public static override readonly args = {
    slug: Args.string({
      description: 'Proposal slug.',
      required: true,
    }),
  };

  public static override readonly flags = {
    json: Flags.boolean({
      description: 'Emit JSON instead of formatted text.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ProposalShow);
    const proposal = await findProposalBySlug(args.slug);

    if (!proposal) {
      const all = await loadAllProposals();
      if (all.length === 0) {
        this.log('No proposals exist yet. ema-genesis/proposals/ is empty or missing.');
        this.exit(1);
      }
      const suggestions = all
        .filter((p) => p.slug.toLowerCase().includes(args.slug.toLowerCase()))
        .slice(0, 5);
      this.log(`No proposal with slug "${args.slug}".`);
      if (suggestions.length > 0) {
        this.log('\nDid you mean:');
        for (const s of suggestions) this.log(`  ${s.slug}`);
      }
      this.exit(1);
    }

    if (flags.json) {
      printJson({
        slug: proposal.slug,
        path: proposal.relPath,
        frontmatter: proposal.frontmatter,
        body: proposal.body,
      });
      return;
    }

    const fm = proposal.frontmatter;
    this.log(`━━━ ${proposal.slug} ━━━`);
    this.log(`Path:      ${proposal.relPath}`);
    if (fm.id) this.log(`ID:        ${fm.id}`);
    if (fm.status) this.log(`Status:    ${fm.status}`);
    if (fm.priority) this.log(`Priority:  ${fm.priority}`);
    if (fm.intentSlug) this.log(`Intent:    ${fm.intentSlug}`);
    if (fm.proposedBy) this.log(`Proposed:  ${fm.proposedBy}`);
    if (fm.created) this.log(`Created:   ${fm.created}`);
    if (fm.title) this.log(`Title:     ${fm.title}`);
    if (fm.tags.length > 0) this.log(`Tags:      ${fm.tags.join(', ')}`);
    this.log('');
    this.log('━━━ Body ━━━');
    this.log(proposal.body.trim());
  }
}
