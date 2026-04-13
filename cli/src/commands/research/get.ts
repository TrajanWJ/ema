// research get — print a single research node's markdown content.
//
// Usage:
//   ema research get oclif-oclif
//   ema research get RES-oclif
//
// Matching is slug-first, then frontmatter id, then slug-prefix. See
// `findResearchNodeBySlug` in lib/node-loader.ts for rules.

import { Args, Command, Flags } from '@oclif/core';
import { readFileSync } from 'node:fs';
import { findResearchNodeBySlug } from '../../lib/node-loader.js';
import { printJson } from '../../lib/table-printer.js';

export default class ResearchGet extends Command {
  public static override readonly description =
    'Print a single research node by slug or id.';

  public static override readonly examples = [
    '<%= config.bin %> research get oclif-oclif',
    '<%= config.bin %> research get RES-oclif --json',
  ];

  public static override readonly args = {
    slug: Args.string({
      name: 'slug',
      description: 'Slug (filename without .md) or frontmatter id.',
      required: true,
    }),
  };

  public static override readonly flags = {
    json: Flags.boolean({
      description: 'Emit JSON instead of raw markdown.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ResearchGet);
    const node = await findResearchNodeBySlug(args.slug);
    if (!node) {
      this.error(`No research node matched "${args.slug}".`, { exit: 1 });
    }

    if (flags.json) {
      printJson({
        slug: node.slug,
        id: node.frontmatter.id,
        category: node.category,
        title: node.frontmatter.title,
        signal_tier: node.frontmatter.signal_tier,
        source_url: node.frontmatter.sourceUrl,
        source_stars: node.frontmatter.sourceStars,
        last_activity: node.frontmatter.sourceLastActivity,
        tags: node.frontmatter.tags,
        path: node.path,
        body: node.body,
      });
      return;
    }

    // Print the raw markdown file verbatim. Keeps YAML frontmatter, links,
    // and tags intact so the output can be piped into glow, bat, etc.
    this.log(readFileSync(node.path, 'utf8'));
  }
}
