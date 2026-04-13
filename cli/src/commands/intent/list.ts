// ema intent list
//
// Tabular view of every intent and GAC card in ema-genesis/intents/.
// Filters:
//   --status=<name>    limit to a single status value
//   --kind=<name>      limit to a single kind (port | wiring | new-work | ...)
//   --priority=<name>  limit to a single priority level
//   --json             emit JSON instead of a table
//
// Default sort: GACs first by number, then INTs alphabetically.

import { Command, Flags } from '@oclif/core';
import { loadAllIntents } from '../../lib/intent-loader.js';
import { printTable, truncate, printJson } from '../../lib/table-printer.js';

export default class IntentList extends Command {
  public static override readonly description =
    'List intents and GAC cards. Filter by --status, --kind, or --priority.';

  public static override readonly examples = [
    '<%= config.bin %> intent list',
    '<%= config.bin %> intent list --status=active',
    '<%= config.bin %> intent list --kind=canon-repair',
    '<%= config.bin %> intent list --priority=critical --json',
  ];

  public static override readonly flags = {
    status: Flags.string({
      char: 's',
      description: 'Filter to a single status (active, preliminary, answered, ...).',
      required: false,
    }),
    kind: Flags.string({
      char: 'k',
      description: 'Filter to a single intent kind (port, wiring, new-work, canon-repair, ...).',
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
    const { flags } = await this.parse(IntentList);

    const all = await loadAllIntents();
    const filtered = all.filter((intent) => {
      if (flags.status && intent.frontmatter.status !== flags.status) return false;
      if (flags.kind && intent.frontmatter.kind !== flags.kind) return false;
      if (flags.priority && intent.frontmatter.priority !== flags.priority) return false;
      return true;
    });

    if (flags.json) {
      printJson(
        filtered.map((i) => ({
          slug: i.slug,
          id: i.frontmatter.id,
          type: i.frontmatter.type,
          kind: i.frontmatter.kind,
          status: i.frontmatter.status,
          phase: i.frontmatter.phase,
          priority: i.frontmatter.priority,
          title: i.frontmatter.title,
          author: i.frontmatter.author,
          created: i.frontmatter.created,
          updated: i.frontmatter.updated,
          rel_path: i.relPath,
        })),
      );
      return;
    }

    if (filtered.length === 0) {
      this.log('No intents match the given filters.');
      return;
    }

    printTable(
      [
        { header: 'Slug', width: 40 },
        { header: 'Type', width: 10 },
        { header: 'Kind', width: 16 },
        { header: 'Status', width: 12 },
        { header: 'Priority', width: 10 },
        { header: 'Title' },
      ],
      filtered.map((i) => [
        i.slug,
        i.frontmatter.type ?? '—',
        i.frontmatter.kind ?? '—',
        i.frontmatter.status ?? '—',
        i.frontmatter.priority ?? '—',
        truncate(i.frontmatter.title, 60),
      ]),
    );

    this.log(`\n${filtered.length} of ${all.length} intents.`);
  }
}
