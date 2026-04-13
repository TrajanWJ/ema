// ema intent show <slug>
//
// Print the full frontmatter + body for a single intent by slug.
//
//   ema intent show INT-RECOVERY-WAVE-1
//   ema intent show GAC-001
//   ema intent show INT-CANON-REPAIR-CLAUDE-MD --json
//
// When the slug doesn't match, suggest the closest matches.

import { Args, Command, Flags } from '@oclif/core';
import { loadAllIntents, findIntentBySlug } from '../../lib/intent-loader.js';
import { printJson } from '../../lib/table-printer.js';

export default class IntentShow extends Command {
  public static override readonly description =
    'Show a single intent by slug (frontmatter + body).';

  public static override readonly examples = [
    '<%= config.bin %> intent show INT-RECOVERY-WAVE-1',
    '<%= config.bin %> intent show GAC-001',
    '<%= config.bin %> intent show INT-CANON-REPAIR-CLAUDE-MD --json',
  ];

  public static override readonly args = {
    slug: Args.string({
      description: 'Intent slug (e.g. INT-RECOVERY-WAVE-1 or GAC-001).',
      required: true,
    }),
  };

  public static override readonly flags = {
    json: Flags.boolean({
      description: 'Emit JSON instead of formatted markdown.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(IntentShow);
    const intent = await findIntentBySlug(args.slug);

    if (!intent) {
      const all = await loadAllIntents();
      const suggestions = all
        .filter((i) => i.slug.toLowerCase().includes(args.slug.toLowerCase()))
        .slice(0, 5);

      this.log(`No intent with slug "${args.slug}".`);
      if (suggestions.length > 0) {
        this.log('\nDid you mean one of these?');
        for (const s of suggestions) {
          this.log(`  ${s.slug}`);
        }
      }
      this.exit(1);
    }

    if (flags.json) {
      printJson({
        slug: intent.slug,
        path: intent.relPath,
        is_folder: intent.isFolder,
        frontmatter: intent.frontmatter,
        body: intent.body,
      });
      return;
    }

    const fm = intent.frontmatter;
    this.log(`━━━ ${intent.slug} ━━━`);
    this.log(`Path:      ${intent.relPath}`);
    if (fm.id) this.log(`ID:        ${fm.id}`);
    if (fm.type) this.log(`Type:      ${fm.type}`);
    if (fm.kind) this.log(`Kind:      ${fm.kind}`);
    if (fm.status) this.log(`Status:    ${fm.status}`);
    if (fm.phase) this.log(`Phase:     ${fm.phase}`);
    if (fm.priority) this.log(`Priority:  ${fm.priority}`);
    if (fm.author) this.log(`Author:    ${fm.author}`);
    if (fm.created) this.log(`Created:   ${fm.created}`);
    if (fm.updated) this.log(`Updated:   ${fm.updated}`);
    if (fm.title) this.log(`Title:     ${fm.title}`);
    if (fm.exitCondition) {
      this.log('');
      this.log('Exit condition:');
      this.log(`  ${fm.exitCondition}`);
    }
    if (fm.tags.length > 0) {
      this.log('');
      this.log(`Tags: ${fm.tags.join(', ')}`);
    }
    this.log('');
    this.log('━━━ Body ━━━');
    this.log(intent.body.trim());
  }
}
