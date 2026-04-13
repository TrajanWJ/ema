import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import { genesisPath } from './genesis-root.js';

export type ResearchQueueStatus =
  | 'queued'
  | 'researching'
  | 'extracted'
  | 'done'
  | 'skipped';

export type ResearchQueueKind = 'repo' | 'query' | 'topic' | 'domain';

export interface ResearchQueueItem {
  readonly id: string;
  readonly status: ResearchQueueStatus;
  readonly kind: ResearchQueueKind;
  readonly query: string;
  readonly title: string | undefined;
  readonly domain: string | undefined;
  readonly topics: readonly string[];
  readonly depth: number;
  readonly source_url: string | undefined;
  readonly notes: string | undefined;
  readonly requested_by: string | undefined;
  readonly queued_at: string;
}

export interface AddResearchQueueInput {
  readonly query: string;
  readonly kind: ResearchQueueKind;
  readonly title?: string | undefined;
  readonly domain?: string | undefined;
  readonly topics?: readonly string[] | undefined;
  readonly depth: number;
  readonly source_url?: string | undefined;
  readonly notes?: string | undefined;
  readonly requested_by?: string | undefined;
}

interface ResearchQueueDocument {
  readonly path: string;
  readonly data: Record<string, unknown>;
  readonly content: string;
}

const VALID_STATUSES = new Set<ResearchQueueStatus>([
  'queued',
  'researching',
  'extracted',
  'done',
  'skipped',
]);

const VALID_KINDS = new Set<ResearchQueueKind>([
  'repo',
  'query',
  'topic',
  'domain',
]);

const DEFAULT_BODY = `# Research Queue

> Queue-backed backlog for future clone, extraction, and domain research work.
> This is the operational intake surface for the research graph: agents add
> candidates here first, then promote completed work into durable research nodes
> under \`research/<category>/\` and optional extraction docs under
> \`research/_extractions/\`.

## Workflow

1. Add a queue item when a repo, topic, query, or domain deserves follow-up.
2. Set \`depth\` to the expected research intensity:
   - \`1\` = quick landscape scan
   - \`2\` = focused docs / README pass
   - \`3\` = clone + targeted source extraction
   - \`4+\` = run, trace, compare, synthesize
3. When the work lands as a real research node or extraction, move the queue
   item to \`extracted\` or \`done\`.

## Queue Semantics

- \`kind: repo\` = concrete repository or project target
- \`kind: query\` = plain-language question to answer
- \`kind: topic\` = recurring theme or pattern cluster
- \`kind: domain\` = broad landscape pass across a whole area

## Agent Usage

Agents should prefer:
- \`ema research queue list --json\` for planning the next pass
- \`ema research queue add ...\` when new follow-up work surfaces
- \`ema research search ...\` once a queue item has been promoted into the graph

#research #queue #ingestion #workflow
`;

export function researchQueuePath(): string {
  return genesisPath('research', 'research-ingestion', 'QUEUE.md');
}

export function loadResearchQueue(): readonly ResearchQueueItem[] {
  const doc = loadResearchQueueDocument();
  const raw = Array.isArray(doc.data.queue) ? doc.data.queue : [];
  const items = raw
    .map((entry, index) => normalizeQueueItem(entry, index))
    .filter((entry): entry is ResearchQueueItem => entry !== null)
    .sort((a, b) => compareQueueIds(a.id, b.id));
  return Object.freeze(items);
}

export function addResearchQueueItem(
  input: AddResearchQueueInput,
): ResearchQueueItem {
  const query = input.query.trim();
  if (query.length === 0) {
    throw new Error('Queue item query must not be empty.');
  }

  if (!Number.isInteger(input.depth) || input.depth < 1) {
    throw new Error('Queue item depth must be an integer >= 1.');
  }

  if (!VALID_KINDS.has(input.kind)) {
    throw new Error(`Invalid queue item kind: ${input.kind}`);
  }

  const doc = loadResearchQueueDocument();
  const existing = loadResearchQueue();
  const nextId = nextQueueId(existing);

  const item: ResearchQueueItem = {
    id: nextId,
    status: 'queued',
    kind: input.kind,
    query,
    title: cleanOptional(input.title),
    domain: cleanOptional(input.domain),
    topics: Object.freeze(normalizeTopics(input.topics ?? [])),
    depth: input.depth,
    source_url: cleanOptional(input.source_url),
    notes: cleanOptional(input.notes),
    requested_by: cleanOptional(input.requested_by) ?? 'human',
    queued_at: today(),
  };

  const queueForWrite = [
    ...existing.map(serializeQueueItem),
    serializeQueueItem(item),
  ];

  const data = {
    ...doc.data,
    updated: today(),
    queue: queueForWrite,
  };

  writeFileSync(doc.path, matter.stringify(doc.content, data), 'utf8');
  return item;
}

function loadResearchQueueDocument(): ResearchQueueDocument {
  const path = researchQueuePath();
  if (!existsSync(path)) {
    const initialData = {
      id: 'RES-research-queue',
      type: 'research',
      layer: 'research',
      category: 'research-ingestion',
      title: 'Research Queue — clone targets and query backlog',
      status: 'active',
      created: today(),
      updated: today(),
      author: 'system',
      signal_tier: 'A',
      tags: ['research', 'queue', 'ingestion', 'backlog'],
      connections: [
        { target: '[[research/research-ingestion/_MOC]]', relation: 'references' },
        { target: '[[research/_moc/RESEARCH-MOC]]', relation: 'references' },
        { target: '[[research/_clones/INDEX]]', relation: 'references' },
      ],
      queue: [],
    };
    writeFileSync(path, matter.stringify(DEFAULT_BODY, initialData), 'utf8');
  }

  const raw = readFileSync(path, 'utf8');
  const parsed = matter(raw);
  return {
    path,
    data: (parsed.data ?? {}) as Record<string, unknown>,
    content: parsed.content ?? DEFAULT_BODY,
  };
}

function normalizeQueueItem(
  value: unknown,
  index: number,
): ResearchQueueItem | null {
  if (value === null || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;

  const id = asString(item.id) ?? `RQ-${String(index + 1).padStart(3, '0')}`;
  const rawStatus = asString(item.status);
  const rawKind = asString(item.kind);
  const depth = typeof item.depth === 'number' ? item.depth : Number(item.depth);

  const status: ResearchQueueStatus = VALID_STATUSES.has(
    rawStatus as ResearchQueueStatus,
  )
    ? (rawStatus as ResearchQueueStatus)
    : 'queued';

  const kind: ResearchQueueKind = VALID_KINDS.has(rawKind as ResearchQueueKind)
    ? (rawKind as ResearchQueueKind)
    : 'query';

  return {
    id,
    status,
    kind,
    query: asString(item.query) ?? '',
    title: asString(item.title),
    domain: asString(item.domain),
    topics: Object.freeze(normalizeTopics(item.topics)),
    depth: Number.isFinite(depth) && depth >= 1 ? Math.trunc(depth) : 1,
    source_url: asString(item.source_url),
    notes: asString(item.notes),
    requested_by: asString(item.requested_by),
    queued_at: asDateString(item.queued_at) ?? '',
  };
}

function nextQueueId(items: readonly ResearchQueueItem[]): string {
  let max = 0;
  for (const item of items) {
    const match = /^RQ-(\d+)$/.exec(item.id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `RQ-${String(max + 1).padStart(3, '0')}`;
}

function compareQueueIds(a: string, b: string): number {
  const aNum = numericQueueId(a);
  const bNum = numericQueueId(b);
  if (aNum !== null && bNum !== null) return aNum - bNum;
  return a.localeCompare(b);
}

function numericQueueId(value: string): number | null {
  const match = /^RQ-(\d+)$/.exec(value);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function normalizeTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    out.add(trimmed);
  }
  return Array.from(out);
}

function serializeQueueItem(
  item: ResearchQueueItem,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: item.id,
    status: item.status,
    kind: item.kind,
    query: item.query,
    topics: [...item.topics],
    depth: item.depth,
    queued_at: item.queued_at,
  };

  if (item.title !== undefined) out.title = item.title;
  if (item.domain !== undefined) out.domain = item.domain;
  if (item.source_url !== undefined) out.source_url = item.source_url;
  if (item.notes !== undefined) out.notes = item.notes;
  if (item.requested_by !== undefined) out.requested_by = item.requested_by;

  return out;
}

function cleanOptional(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asDateString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
