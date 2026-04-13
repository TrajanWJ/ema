import { Args, Command, Flags } from '@oclif/core';
import {
  addResearchQueueItem,
  type ResearchQueueKind,
  researchQueuePath,
} from '../../../lib/research-queue.js';
import { printJson } from '../../../lib/table-printer.js';

const VALID_KINDS = new Set<ResearchQueueKind>([
  'repo',
  'query',
  'topic',
  'domain',
]);

export default class ResearchQueueAdd extends Command {
  public static override readonly description =
    'Append a repo, query, topic, or domain target to the research queue.';

  public static override readonly examples = [
    '<%= config.bin %> research queue add "Open-source RSS + AI curation landscape" --kind=domain --domain=research-ingestion --topic=rss --topic=curation --depth=2',
    '<%= config.bin %> research queue add "Assess Miniflux as EMA feed collector" --kind=repo --domain=research-ingestion --topic=rss --depth=3 --source-url=https://github.com/miniflux/v2',
  ];

  public static override readonly args = {
    query: Args.string({
      name: 'query',
      description: 'The natural-language research target to queue.',
      required: true,
    }),
  };

  public static override readonly flags = {
    kind: Flags.string({
      char: 'k',
      description: 'Queue kind: repo, query, topic, or domain.',
      default: 'query',
    }),
    title: Flags.string({
      description: 'Optional short display title; defaults to the query.',
      required: false,
    }),
    domain: Flags.string({
      char: 'd',
      description: 'Primary domain label (e.g. research-ingestion, knowledge-graphs).',
      required: false,
    }),
    topic: Flags.string({
      char: 't',
      description: 'Topic tag; repeat to add multiple topics.',
      multiple: true,
      required: false,
    }),
    depth: Flags.integer({
      description: 'Research depth: 1 = scan, 2 = docs, 3 = clone+extract, 4+ = deep pass.',
      default: 2,
    }),
    'source-url': Flags.string({
      description: 'Optional canonical repo/spec URL for repo-style queue items.',
      required: false,
    }),
    notes: Flags.string({
      description: 'Optional notes for the next agent or future self.',
      required: false,
    }),
    'requested-by': Flags.string({
      description: 'Who queued it. Defaults to human.',
      required: false,
    }),
    json: Flags.boolean({
      description: 'Emit JSON instead of a human-readable confirmation.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ResearchQueueAdd);

    if (!VALID_KINDS.has(flags.kind as ResearchQueueKind)) {
      this.error(
        `Invalid --kind "${flags.kind}". Expected one of: repo, query, topic, domain.`,
        { exit: 1 },
      );
    }

    if (!Number.isInteger(flags.depth) || flags.depth < 1) {
      this.error('Invalid --depth. Expected an integer >= 1.', { exit: 1 });
    }

    const item = addResearchQueueItem({
      query: args.query,
      kind: flags.kind as ResearchQueueKind,
      title: flags.title,
      domain: flags.domain,
      topics: flags.topic ?? [],
      depth: flags.depth,
      source_url: flags['source-url'],
      notes: flags.notes,
      requested_by: flags['requested-by'],
    });

    if (flags.json) {
      printJson({
        queue_path: researchQueuePath(),
        item,
      });
      return;
    }

    this.log(`Queued ${item.id} in ${researchQueuePath()}`);
    this.log(`  kind:   ${item.kind}`);
    this.log(`  domain: ${item.domain ?? '—'}`);
    this.log(`  depth:  ${item.depth}`);
    this.log(`  topics: ${item.topics.length > 0 ? item.topics.join(', ') : '—'}`);
    this.log(`  query:  ${item.query}`);
  }
}
