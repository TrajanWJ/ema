// ema briefing
//
// Morning briefing — aggregate view of canon, intents, proposals, executions.
// Reads everything from the genesis filesystem directly. Designed for the
// daily-validation ritual per [[canon/decisions/DEC-008-daily-validation-ritual]].

import { Command, Flags } from '@oclif/core';
import { loadAllIntents, type Intent } from '../lib/intent-loader.js';
import { loadAllProposals } from '../lib/proposal-loader.js';
import { findGenesisRoot } from '../lib/genesis-root.js';
import { printJson } from '../lib/table-printer.js';

export default class Briefing extends Command {
  public static override readonly description: string =
    'Morning briefing — aggregated view of intents, proposals, and current focus.';

  public static override readonly examples = [
    '<%= config.bin %> briefing',
    '<%= config.bin %> briefing --json',
  ];

  public static override readonly flags = {
    json: Flags.boolean({
      description: 'Emit JSON instead of a human-readable summary.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Briefing);

    const genesisRoot = findGenesisRoot();
    const intents = await loadAllIntents();
    const proposals = await loadAllProposals();

    const activeIntents = intents.filter((i) => i.frontmatter.status === 'active');
    const preliminaryIntents = intents.filter((i) => i.frontmatter.status === 'preliminary');
    const criticalIntents = intents.filter((i) => i.frontmatter.priority === 'critical');
    const highIntents = intents.filter((i) => i.frontmatter.priority === 'high');

    const queuedProposals = proposals.filter((p) => p.frontmatter.status === 'queued');
    const approvedProposals = proposals.filter((p) => p.frontmatter.status === 'approved');

    const topPriority = pickTop(intents);

    const greeting = greetingForHour(new Date().getHours());

    if (flags.json) {
      printJson({
        greeting,
        date: new Date().toISOString().slice(0, 10),
        genesis_root: genesisRoot,
        counts: {
          intents_total: intents.length,
          intents_active: activeIntents.length,
          intents_preliminary: preliminaryIntents.length,
          intents_critical: criticalIntents.length,
          intents_high: highIntents.length,
          proposals_total: proposals.length,
          proposals_queued: queuedProposals.length,
          proposals_approved: approvedProposals.length,
        },
        top_priority: topPriority
          ? {
              slug: topPriority.slug,
              title: topPriority.frontmatter.title,
              priority: topPriority.frontmatter.priority,
              status: topPriority.frontmatter.status,
              kind: topPriority.frontmatter.kind,
            }
          : null,
      });
      return;
    }

    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.log(`  ${greeting}`);
    this.log(`  ${new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.log('');

    this.log('Intents:');
    this.log(`  ${intents.length} total · ${activeIntents.length} active · ${preliminaryIntents.length} preliminary`);
    this.log(`  ${criticalIntents.length} critical · ${highIntents.length} high priority`);
    this.log('');

    this.log('Proposals:');
    if (proposals.length === 0) {
      this.log('  none yet (proposal pipeline not bootstrapped)');
    } else {
      this.log(`  ${proposals.length} total · ${queuedProposals.length} queued · ${approvedProposals.length} approved`);
    }
    this.log('');

    if (topPriority) {
      this.log('Top priority right now:');
      this.log(`  ${topPriority.slug}`);
      this.log(`  ${topPriority.frontmatter.title ?? '(untitled)'}`);
      this.log(`  priority: ${topPriority.frontmatter.priority ?? '—'}  ·  kind: ${topPriority.frontmatter.kind ?? '—'}  ·  status: ${topPriority.frontmatter.status ?? '—'}`);
    } else {
      this.log('Top priority: nothing flagged. The queue is clean or quiet.');
    }
    this.log('');
    this.log('Try: ema now    (just the top item)');
    this.log('     ema dump "thought"    (capture)');
    this.log('     ema intent list --priority=critical    (drill in)');
  }
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Pick the top-priority unfinished intent. Critical > high > medium > low. */
function pickTop(
  intents: readonly Intent[],
) {
  const order = ['critical', 'high', 'medium', 'low'];
  const ranked = intents
    .filter((i) => i.frontmatter.status !== 'completed' && i.frontmatter.status !== 'answered')
    .map((i) => ({
      i,
      rank: order.indexOf(i.frontmatter.priority ?? ''),
    }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank);
  return ranked[0]?.i;
}
