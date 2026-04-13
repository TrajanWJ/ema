// ema intent create
//
// Create a new intent file at ema-genesis/intents/<ID>/README.md.
// Flag-driven (non-interactive). The body is a stub the user fills in by editing.
//
// Usage:
//   ema intent create --id INT-FOO --title "..." --kind new-work --priority high
//   ema intent create --id INT-BAR --title "..." --kind canon-repair --priority medium --author human
//
// Refuses to overwrite an existing intent. Use a different ID or delete first.

import { Command, Flags } from '@oclif/core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { intentsRoot } from '../../lib/genesis-root.js';

const VALID_KINDS = [
  'port',
  'wiring',
  'new-work',
  'reconciliation',
  'canon-repair',
  'process',
  'historical-sprint',
  'recovery',
];

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];

export default class IntentCreate extends Command {
  public static override readonly description: string =
    'Create a new intent under ema-genesis/intents/<ID>/README.md (flag-driven, non-interactive).';

  public static override readonly examples = [
    '<%= config.bin %> intent create --id INT-FOO --title "Build the foo widget" --kind new-work --priority high',
    '<%= config.bin %> intent create --id INT-BAR --title "Fix the bar" --kind canon-repair --priority medium',
  ];

  public static override readonly flags = {
    id: Flags.string({
      description: 'Intent ID (e.g. INT-FOO-WIDGET). Must be unique under intents/.',
      required: true,
    }),
    title: Flags.string({
      description: 'Short human-readable title.',
      required: true,
    }),
    kind: Flags.string({
      description: `Intent kind. One of: ${VALID_KINDS.join(', ')}`,
      required: true,
    }),
    priority: Flags.string({
      description: `Priority. One of: ${VALID_PRIORITIES.join(', ')}`,
      default: 'medium',
    }),
    author: Flags.string({
      description: 'Author of the intent (default: human).',
      default: 'human',
    }),
    'exit-condition': Flags.string({
      description: 'Exit condition — what "done" looks like for this intent.',
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(IntentCreate);

    if (!VALID_KINDS.includes(flags.kind)) {
      this.log(`Invalid --kind "${flags.kind}". Must be one of: ${VALID_KINDS.join(', ')}`);
      this.exit(2);
    }

    if (!VALID_PRIORITIES.includes(flags.priority)) {
      this.log(`Invalid --priority "${flags.priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}`);
      this.exit(2);
    }

    const dir = join(intentsRoot(), flags.id);
    const filepath = join(dir, 'README.md');

    if (existsSync(filepath)) {
      this.log(`Intent already exists: ${filepath}`);
      this.log('Refusing to overwrite. Use a different --id or delete the existing one first.');
      this.exit(1);
    }

    mkdirSync(dir, { recursive: true });

    const today = new Date().toISOString().slice(0, 10);
    const exitCondition = flags['exit-condition'] ?? 'TBD — fill this in to match what "done" means.';

    const content = [
      '---',
      `id: ${flags.id}`,
      'type: intent',
      'layer: intents',
      `title: ${JSON.stringify(flags.title)}`,
      'status: active',
      `kind: ${flags.kind}`,
      'phase: discover',
      `priority: ${flags.priority}`,
      `created: ${today}`,
      `updated: ${today}`,
      `author: ${flags.author}`,
      `exit_condition: ${JSON.stringify(exitCondition)}`,
      'connections: []',
      `tags: [intent, ${flags.kind}, ${flags.priority}]`,
      '---',
      '',
      `# ${flags.id}`,
      '',
      `## What this is`,
      '',
      `${flags.title}`,
      '',
      `## Why it matters`,
      '',
      `(fill in)`,
      '',
      `## Exit condition`,
      '',
      exitCondition,
      '',
      `## Open questions`,
      '',
      `(fill in)`,
      '',
      `## Related`,
      '',
      `(fill in wikilinks)`,
      '',
      `#intent #${flags.kind} #${flags.priority}`,
      '',
    ].join('\n');

    writeFileSync(filepath, content, 'utf-8');
    this.log(`✓ Created intent: ${filepath}`);
    this.log(`  ID:       ${flags.id}`);
    this.log(`  Title:    ${flags.title}`);
    this.log(`  Kind:     ${flags.kind}`);
    this.log(`  Priority: ${flags.priority}`);
    this.log('');
    this.log(`Edit the file to flesh out the body, then: ema intent show ${flags.id}`);
  }
}
