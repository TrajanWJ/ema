// ema now
//
// "What should I be doing right now?" — picks the highest-priority unfinished
// intent and prints just that one. CLI twin of the One Thing card on the
// Launchpad. See [[research/frontend-patterns/launchpad-one-thing-card]].
//
// Ranking: critical > high > medium > low. Excludes completed/answered.
// Within a priority tier, prefers the most recently updated.

import { Command, Flags } from '@oclif/core';
import { loadAllIntents, type Intent } from '../lib/intent-loader.js';
import { printJson } from '../lib/table-printer.js';

export default class Now extends Command {
  public static override readonly description: string =
    'Top priority item right now. The single most urgent thing across all intents.';

  public static override readonly examples = [
    '<%= config.bin %> now',
    '<%= config.bin %> now --json',
  ];

  public static override readonly flags = {
    json: Flags.boolean({
      description: 'Emit JSON instead of a formatted text block.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Now);

    const intents = await loadAllIntents();
    const top = pickOneThing(intents);

    if (!top) {
      if (flags.json) {
        printJson({ ok: true, top: null, reason: 'no unfinished prioritized intents' });
        return;
      }
      this.log('Nothing flagged. The queue is clean.');
      this.log('Try: ema dump "thought"    (capture something to think about)');
      return;
    }

    if (flags.json) {
      printJson({
        ok: true,
        top: {
          slug: top.slug,
          path: top.relPath,
          id: top.frontmatter.id,
          title: top.frontmatter.title,
          kind: top.frontmatter.kind,
          status: top.frontmatter.status,
          priority: top.frontmatter.priority,
          phase: top.frontmatter.phase,
          exit_condition: top.frontmatter.exitCondition,
        },
      });
      return;
    }

    this.log('━━━ Right now ━━━');
    this.log('');
    this.log(`  ${top.slug}`);
    this.log(`  ${top.frontmatter.title ?? '(untitled)'}`);
    this.log('');
    this.log(`  priority: ${top.frontmatter.priority ?? '—'}`);
    this.log(`  kind:     ${top.frontmatter.kind ?? '—'}`);
    this.log(`  status:   ${top.frontmatter.status ?? '—'}`);
    if (top.frontmatter.phase) this.log(`  phase:    ${top.frontmatter.phase}`);
    if (top.frontmatter.exitCondition) {
      this.log('');
      this.log('  Exit when:');
      this.log(`    ${top.frontmatter.exitCondition}`);
    }
    this.log('');
    this.log(`  → ema intent show ${top.slug}    (full detail)`);
  }
}

function pickOneThing(intents: readonly Intent[]): Intent | undefined {
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const candidates = intents
    .filter((i) => {
      const s = i.frontmatter.status;
      if (s === 'completed' || s === 'answered' || s === 'archive') return false;
      return true;
    })
    .filter((i) => priorityOrder[i.frontmatter.priority ?? ''] !== undefined);

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => {
    const aRank = priorityOrder[a.frontmatter.priority ?? ''] ?? 99;
    const bRank = priorityOrder[b.frontmatter.priority ?? ''] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    // Within a priority tier, prefer most recently updated.
    const aDate = a.frontmatter.updated ?? a.frontmatter.created ?? '';
    const bDate = b.frontmatter.updated ?? b.frontmatter.created ?? '';
    return bDate.localeCompare(aDate);
  });

  return candidates[0];
}
