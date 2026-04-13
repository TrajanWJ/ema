// ema dump "<text>"
//
// Brain dump capture. Writes a markdown file under .ema/workspace/brain-dumps/
// per EMA-V1-SPEC §9 (workspace state is local, non-canonical, gitignored).
//
// Usage:
//   ema dump "the thought I want to remember"
//   ema dump "..." --tag=urgent --tag=meeting
//
// Filename: <YYYY-MM-DD>-<slug-from-first-words>.md
// Frontmatter: id, type=brain-dump, created, tags

import { Command, Flags, Args } from '@oclif/core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findGenesisRoot } from '../lib/genesis-root.js';

export default class Dump extends Command {
  public static override readonly description: string =
    'Brain dump capture. Writes a workspace-state markdown file under .ema/workspace/brain-dumps/.';

  public static override readonly examples = [
    '<%= config.bin %> dump "fix the dispatcher reflexion injector wire"',
    '<%= config.bin %> dump "thought" --tag=urgent --tag=meeting',
  ];

  public static override readonly args = {
    text: Args.string({
      description: 'The thought to capture.',
      required: true,
    }),
  };

  public static override readonly flags = {
    tag: Flags.string({
      char: 't',
      description: 'Tag to attach. Repeatable.',
      multiple: true,
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Dump);
    const text = args.text.trim();

    if (text.length === 0) {
      this.log('Empty dump. Nothing written.');
      this.exit(1);
    }

    // Resolve workspace root: sibling of ema-genesis at repo root.
    const genesisRoot = findGenesisRoot();
    const repoRoot = join(genesisRoot, '..');
    const dumpsDir = join(repoRoot, '.ema', 'workspace', 'brain-dumps');
    if (!existsSync(dumpsDir)) {
      mkdirSync(dumpsDir, { recursive: true });
    }

    const date = isoDate();
    const slug = slugify(text, 6);
    const id = `BD-${date}-${slug}`;
    const filename = `${date}-${slug}.md`;
    const filepath = join(dumpsDir, filename);

    const tags = flags.tag ?? [];
    const frontmatter = [
      '---',
      `id: ${id}`,
      'type: brain-dump',
      'layer: workspace-state',
      `created: ${date}`,
      `created_at: ${new Date().toISOString()}`,
      'status: unprocessed',
      tags.length > 0 ? `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]` : 'tags: []',
      '---',
      '',
    ].join('\n');

    const body = `${text}\n`;
    writeFileSync(filepath, frontmatter + body, 'utf-8');

    this.log(`✓ Captured: ${filepath}`);
    this.log(`  ID: ${id}`);
    if (tags.length > 0) this.log(`  Tags: ${tags.join(', ')}`);
  }
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(text: string, maxWords: number): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join('-')
    .slice(0, 60) || 'untitled';
}
