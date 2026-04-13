import { Command, Flags } from '@oclif/core';
import { loadResearchQueue, researchQueuePath } from '../../../lib/research-queue.js';
import {
  printJson,
  printTable,
  truncate,
} from '../../../lib/table-printer.js';

export default class ResearchQueueList extends Command {
  public static override readonly description =
    'List queued research work by status, kind, domain, topic, or depth.';

  public static override readonly examples = [
    '<%= config.bin %> research queue list',
    '<%= config.bin %> research queue list --domain=research-ingestion --topic=rss',
    '<%= config.bin %> research queue list --kind=repo --min-depth=3 --json',
  ];

  public static override readonly flags = {
    status: Flags.string({
      char: 's',
      description: 'Filter to a queue status (queued, researching, extracted, done, skipped).',
      required: false,
    }),
    kind: Flags.string({
      char: 'k',
      description: 'Filter to a queue kind (repo, query, topic, domain).',
      required: false,
    }),
    domain: Flags.string({
      char: 'd',
      description: 'Filter to a single domain label.',
      required: false,
    }),
    topic: Flags.string({
      char: 't',
      description: 'Filter to queue items that include this topic.',
      required: false,
    }),
    depth: Flags.integer({
      description: 'Filter to an exact depth number.',
      required: false,
    }),
    'min-depth': Flags.integer({
      description: 'Minimum depth to include.',
      required: false,
    }),
    'max-depth': Flags.integer({
      description: 'Maximum depth to include.',
      required: false,
    }),
    contains: Flags.string({
      description: 'Case-insensitive substring match across title, query, notes, and source_url.',
      required: false,
    }),
    json: Flags.boolean({
      description: 'Emit JSON instead of a formatted table.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ResearchQueueList);
    const needle = flags.contains?.toLowerCase().trim();
    const items = loadResearchQueue().filter((item) => {
      if (flags.status && item.status !== flags.status) return false;
      if (flags.kind && item.kind !== flags.kind) return false;
      if (flags.domain && item.domain !== flags.domain) return false;
      if (flags.topic && !item.topics.includes(flags.topic)) return false;
      if (typeof flags.depth === 'number' && item.depth !== flags.depth) return false;
      if (
        typeof flags['min-depth'] === 'number' &&
        item.depth < flags['min-depth']
      ) {
        return false;
      }
      if (
        typeof flags['max-depth'] === 'number' &&
        item.depth > flags['max-depth']
      ) {
        return false;
      }
      if (needle && !matchesNeedle(item, needle)) return false;
      return true;
    });

    if (flags.json) {
      printJson({
        queue_path: researchQueuePath(),
        items,
      });
      return;
    }

    if (items.length === 0) {
      this.log('No research queue items match the given filters.');
      return;
    }

    printTable(
      [
        { header: 'ID', width: 8 },
        { header: 'Status', width: 12 },
        { header: 'Kind', width: 8 },
        { header: 'Domain', width: 22 },
        { header: 'Depth', align: 'right', width: 7 },
        { header: 'Topics', width: 24 },
        { header: 'Query / Title' },
      ],
      items.map((item) => [
        item.id,
        item.status,
        item.kind,
        item.domain ?? '—',
        String(item.depth),
        truncate(item.topics.join(', '), 24) || '—',
        truncate(item.title ?? item.query, 72),
      ]),
    );

    this.log(`\n${items.length} queue items from ${researchQueuePath()}.`);
  }
}

function matchesNeedle(
  item: {
    readonly title: string | undefined;
    readonly query: string;
    readonly notes: string | undefined;
    readonly source_url: string | undefined;
    readonly topics: readonly string[];
  },
  needle: string,
): boolean {
  const haystacks = [
    item.title ?? '',
    item.query,
    item.notes ?? '',
    item.source_url ?? '',
    item.topics.join(' '),
  ];
  return haystacks.some((haystack) => haystack.toLowerCase().includes(needle));
}
