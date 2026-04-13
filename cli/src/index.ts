import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Command, InvalidArgumentError } from 'commander';

import { parseFrontmatter, type ParsedMarkdown } from './lib/frontmatter.js';
import {
  findGenesisRoot,
} from './lib/genesis-root.js';
import {
  findResearchNodeBySlug,
  loadAllResearchNodes,
  type ResearchNode,
  type ResearchNodeFrontmatter,
  type SignalTier,
} from './lib/node-loader.js';
import {
  scanClones,
  type CloneEntry,
} from './lib/clones-scanner.js';
import {
  scanExtractions,
  type ExtractionEntry,
} from './lib/extractions-scanner.js';
import {
  runRipgrep,
  type RipgrepHit,
} from './lib/rg-wrapper.js';
import { type OutputFormat, printValue, writeFormattedFile } from './lib/output-format.js';
import {
  type MarkdownNode,
  type IntentNode,
  type CanonNode,
  type TimelineEntry,
  GenesisStore,
} from './lib/genesis-store.js';
import { ServiceConnection } from './lib/service-connection.js';

export { findGenesisRoot } from './lib/genesis-root.js';
export {
  loadAllResearchNodes,
  findResearchNodeBySlug,
  type ResearchNode,
  type ResearchNodeFrontmatter,
  type SignalTier,
} from './lib/node-loader.js';
export {
  parseFrontmatter,
  type ParsedMarkdown,
} from './lib/frontmatter.js';
export {
  scanClones,
  type CloneEntry,
} from './lib/clones-scanner.js';
export {
  scanExtractions,
  type ExtractionEntry,
} from './lib/extractions-scanner.js';
export {
  runRipgrep,
  type RipgrepHit,
} from './lib/rg-wrapper.js';
export { GenesisStore } from './lib/genesis-store.js';
export { ServiceConnection } from './lib/service-connection.js';

interface GlobalOptions {
  readonly format: OutputFormat;
  readonly serviceUrl: string;
  readonly genesisRoot?: string;
}

interface CliContext {
  readonly format: OutputFormat;
  readonly store: GenesisStore;
  readonly services: ServiceConnection;
  readonly serviceUrl: string;
}

type ActionHandler = (context: CliContext, values: readonly unknown[]) => Promise<void>;

const DEFAULT_SERVICE_URL = 'http://localhost:4488';

export async function runCli(argv: readonly string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name('ema')
    .description('EMA CLI — canon-first local surface with service fallback')
    .version('0.2.0')
    .option('--format <format>', 'table|json|yaml', parseFormat, 'table')
    .option('--service-url <url>', 'EMA services base URL', DEFAULT_SERVICE_URL)
    .option('--genesis-root <path>', 'Override ema-genesis root');

  registerIntentCommands(program);
  registerProposalCommands(program);
  registerExecutionCommands(program);
  registerCanonCommands(program);
  registerGraphCommands(program);
  registerQueueCommands(program);
  registerBlueprintCommands(program);
  registerDumpCommands(program);
  registerVaultCommands(program);
  registerPipeCommands(program);
  registerAgentCommands(program);
  registerIngestCommands(program);
  registerServiceCommands(program);

  program
    .command('status')
    .description('Show CLI + canon + service health')
    .action(runWithContext(async (ctx) => {
      const probe = await ctx.services.probe();
      emit(ctx, {
        genesis_root: ctx.store.genesisRoot,
        service_url: ctx.serviceUrl,
        service_available: probe.available,
        service_health: probe.health ?? probe.error ?? 'offline',
        intents: ctx.store.listIntents().length,
        executions: ctx.store.listExecutions().length,
        proposals: ctx.store.listProposals().length,
        canon_docs: ctx.store.listCanonDocs().length,
        agent_configs: ctx.store.agentConfigs().length,
        vault: ctx.store.vaultStatus(),
      });
    }));

  return program;
}

function registerIntentCommands(program: Command): void {
  const intent = program.command('intent').description('Intent graph commands');

  intent.command('list')
    .option('--status <status>')
    .option('--phase <phase>')
    .option('--kind <kind>')
    .description('List intents from ema-genesis/intents')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, string | undefined>];
      const rows = ctx.store.listIntents()
        .filter((node) => !options.status || node.status === options.status)
        .filter((node) => !options.phase || node.phase === options.phase)
        .filter((node) => !options.kind || node.kind === options.kind)
        .map(intentRow);
      emit(ctx, rows, ['slug', 'status', 'phase', 'priority', 'title']);
    }));

  intent.command('view <ref>')
    .description('View one intent')
    .action(runWithContext(async (ctx, values) => {
      const [ref] = values as [string];
      const node = ctx.store.getIntent(ref);
      if (!node) throw new Error(`intent_not_found ${ref}`);
      emitNode(ctx, node);
    }));

  intent.command('create')
    .requiredOption('--title <title>')
    .option('--slug <slug>')
    .option('--kind <kind>')
    .option('--status <status>')
    .option('--phase <phase>')
    .option('--priority <priority>')
    .option('--exit-condition <text>')
    .option('--scope <paths...>')
    .option('--tags <tags...>')
    .description('Create a canon-backed intent file')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      const node = ctx.store.createIntent({
        title: String(options.title),
        ...(typeof options.slug === 'string' ? { slug: options.slug } : {}),
        ...(typeof options.kind === 'string' ? { kind: options.kind } : {}),
        ...(typeof options.status === 'string' ? { status: options.status } : {}),
        ...(typeof options.phase === 'string' ? { phase: options.phase } : {}),
        ...(typeof options.priority === 'string' ? { priority: options.priority } : {}),
        ...(typeof options.exitCondition === 'string' ? { exitCondition: options.exitCondition } : {}),
        ...(Array.isArray(options.scope) ? { scope: options.scope.filter(isString) } : {}),
        ...(Array.isArray(options.tags) ? { tags: options.tags.filter(isString) } : {}),
      });
      emitNode(ctx, node);
    }));

  intent.command('update <ref>')
    .option('--title <title>')
    .option('--status <status>')
    .option('--phase <phase>')
    .option('--priority <priority>')
    .option('--kind <kind>')
    .option('--exit-condition <text>')
    .option('--scope <paths...>')
    .option('--tags <tags...>')
    .description('Update frontmatter on an existing intent')
    .action(runWithContext(async (ctx, values) => {
      const [ref, options] = values as [string, Record<string, unknown>];
      const node = ctx.store.updateIntent(ref, {
        ...(typeof options.title === 'string' ? { title: options.title } : {}),
        ...(typeof options.status === 'string' ? { status: options.status } : {}),
        ...(typeof options.phase === 'string' ? { phase: options.phase } : {}),
        ...(typeof options.priority === 'string' ? { priority: options.priority } : {}),
        ...(typeof options.kind === 'string' ? { kind: options.kind } : {}),
        ...(typeof options.exitCondition === 'string' ? { exitCondition: options.exitCondition } : {}),
        ...(Array.isArray(options.scope) ? { scope: options.scope.filter(isString) } : {}),
        ...(Array.isArray(options.tags) ? { tags: options.tags.filter(isString) } : {}),
      });
      emitNode(ctx, node);
    }));

  intent.command('tree [root]')
    .description('Show an intent and its nearby linked intents')
    .action(runWithContext(async (ctx, values) => {
      const [root] = values as [string | undefined];
      const tree = ctx.store.getIntentTree(root);
      emit(ctx, {
        root: tree.root ? intentRow(tree.root) : null,
        nodes: tree.nodes,
      });
    }));

  intent.command('runtime <ref>')
    .description('Show runtime bundle assembled from linked canon and executions')
    .action(runWithContext(async (ctx, values) => {
      const [ref] = values as [string];
      emit(ctx, ctx.store.getIntentRuntime(ref));
    }));

  intent.command('link <ref>')
    .requiredOption('--target <target>')
    .requiredOption('--relation <relation>')
    .description('Attach a graph edge to an intent')
    .action(runWithContext(async (ctx, values) => {
      const [ref, options] = values as [string, { target: string; relation: string }];
      const node = ctx.store.linkIntent(ref, options.relation, options.target);
      emitNode(ctx, node);
    }));
}

function registerProposalCommands(program: Command): void {
  const proposal = program.command('proposal').description('File-backed proposal queue');

  proposal.command('list')
    .description('List proposals')
    .action(runWithContext(async (ctx) => {
      emit(
        ctx,
        ctx.store.listProposals().map((node) => ({
          id: node.id,
          status: node.status,
          revision: node.revision,
          intent: node.intentRef,
          title: node.title,
        })),
        ['id', 'status', 'revision', 'intent', 'title'],
      );
    }));

  proposal.command('view <ref>')
    .description('View a proposal')
    .action(runWithContext(async (ctx, values) => {
      const [ref] = values as [string];
      const node = ctx.store.getProposal(ref);
      if (!node) throw new Error(`proposal_not_found ${ref}`);
      emitNode(ctx, node);
    }));

  proposal.command('create')
    .requiredOption('--title <title>')
    .option('--intent <intent>')
    .option('--summary <summary>')
    .option('--actor <actor>')
    .description('Create a reviewable file-backed proposal')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      const node = ctx.store.createProposal({
        title: String(options.title),
        ...(typeof options.intent === 'string' ? { intentRef: options.intent } : {}),
        ...(typeof options.summary === 'string' ? { summary: options.summary } : {}),
        ...(typeof options.actor === 'string' ? { actor: options.actor } : {}),
      });
      emitNode(ctx, node);
    }));

  proposal.command('approve <ref>')
    .description('Mark a proposal approved')
    .action(runWithContext(async (ctx, values) => {
      const [ref] = values as [string];
      emitNode(ctx, ctx.store.updateProposalStatus(ref, 'approved'));
    }));

  proposal.command('reject <ref>')
    .requiredOption('--reason <reason>')
    .description('Mark a proposal rejected')
    .action(runWithContext(async (ctx, values) => {
      const [ref, options] = values as [string, { reason: string }];
      emitNode(ctx, ctx.store.updateProposalStatus(ref, 'rejected', options.reason));
    }));

  proposal.command('revise <ref>')
    .option('--title <title>')
    .option('--summary <summary>')
    .description('Revise an existing proposal')
    .action(runWithContext(async (ctx, values) => {
      const [ref, options] = values as [string, { title?: string; summary?: string }];
      emitNode(ctx, ctx.store.reviseProposal(ref, options.title, options.summary));
    }));
}

function registerExecutionCommands(program: Command): void {
  const exec = program.command('exec').description('Execution record commands');

  exec.command('list')
    .option('--status <status>')
    .description('List execution records')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, string | undefined>];
      const rows = ctx.store.listExecutions()
        .filter((node) => !options.status || node.status === options.status)
        .map((node) => ({
          id: node.id,
          status: node.status,
          completed_at: node.completedAt,
          title: node.title,
        }));
      emit(ctx, rows, ['id', 'status', 'completed_at', 'title']);
    }));

  exec.command('view <ref>')
    .description('View an execution record')
    .action(runWithContext(async (ctx, values) => {
      const [ref] = values as [string];
      const node = ctx.store.getExecution(ref);
      if (!node) throw new Error(`execution_not_found ${ref}`);
      emitNode(ctx, node);
    }));

  exec.command('create')
    .requiredOption('--title <title>')
    .option('--objective <objective>')
    .option('--intent <intent>')
    .description('Create a canon execution record')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      const node = ctx.store.createExecution({
        title: String(options.title),
        ...(typeof options.objective === 'string' ? { objective: options.objective } : {}),
        ...(typeof options.intent === 'string' ? { intentSlug: options.intent } : {}),
      });
      emitNode(ctx, node);
    }));

  exec.command('complete <ref>')
    .option('--summary <summary>')
    .description('Complete an execution record')
    .action(runWithContext(async (ctx, values) => {
      const [ref, options] = values as [string, { summary?: string }];
      emitNode(ctx, ctx.store.completeExecution(ref, options.summary));
    }));

  exec.command('checkpoint <ref>')
    .requiredOption('--label <label>')
    .option('--note <note>')
    .description('Append a checkpoint note to an execution')
    .action(runWithContext(async (ctx, values) => {
      const [ref, options] = values as [string, { label: string; note?: string }];
      emitNode(ctx, ctx.store.checkpointExecution(ref, options.label, options.note));
    }));
}

function registerCanonCommands(program: Command): void {
  const canon = program.command('canon').description('Canon file operations');

  canon.command('list')
    .option('--kind <kind>', 'spec|decision')
    .description('List canon documents')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, string | undefined>];
      const docs = ctx.store.listCanonDocs()
        .filter((doc) => !options.kind || doc.subtype === options.kind || doc.relPath.includes(`/${options.kind}s/`))
        .map(canonRow);
      emit(ctx, docs, ['id', 'status', 'subtype', 'ref', 'title']);
    }));

  canon.command('view <ref>')
    .description('Show one canon document')
    .action(runWithContext(async (ctx, values) => {
      const [ref] = values as [string];
      const doc = ctx.store.getCanonDoc(ref);
      if (!doc) throw new Error(`canon_not_found ${ref}`);
      emitNode(ctx, doc);
    }));

  canon.command('write <path>')
    .option('--title <title>')
    .option('--content <content>')
    .description('Write or update a canon markdown file')
    .action(runWithContext(async (ctx, values) => {
      const [path, options] = values as [string, { title?: string; content?: string }];
      const body = options.content ?? await readBodyFromStdin();
      if (!body) {
        throw new Error('canon_write_requires_content');
      }
      const doc = ctx.store.writeCanonDoc(path, options.title, body);
      emitNode(ctx, doc);
    }));

  canon.command('search <query>')
    .description('Search canon markdown for text')
    .action(runWithContext(async (ctx, values) => {
      const [query] = values as [string];
      emit(ctx, ctx.store.searchCanon(query), ['ref', 'line', 'text']);
    }));
}

function registerGraphCommands(program: Command): void {
  const graph = program.command('graph').description('Lightweight graph operations over canon frontmatter');

  graph.command('connect <source> <target>')
    .requiredOption('--relation <relation>')
    .description('Add an edge to a canonical node')
    .action(runWithContext(async (ctx, values) => {
      const [source, target, options] = values as [string, string, { relation: string }];
      emitNode(ctx, ctx.store.connectNodes(source, target, options.relation));
    }));

  graph.command('disconnect <source> <target>')
    .option('--relation <relation>')
    .description('Remove a graph edge')
    .action(runWithContext(async (ctx, values) => {
      const [source, target, options] = values as [string, string, { relation?: string }];
      emitNode(ctx, ctx.store.disconnectNodes(source, target, options.relation));
    }));

  graph.command('traverse <start>')
    .option('--depth <depth>', 'Traversal depth', parseInteger, 2)
    .description('Breadth-first traversal from a node')
    .action(runWithContext(async (ctx, values) => {
      const [start, options] = values as [string, { depth: number }];
      emit(ctx, ctx.store.traverseGraph(start, options.depth));
    }));

  graph.command('layers')
    .description('Count canonical markdown files by layer')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.graphLayers(), ['layer', 'nodes']);
    }));

  graph.command('export')
    .option('--path <path>', 'Write graph export to a file')
    .description('Export the graph as JSON/YAML')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      const payload = ctx.store.graphExport();
      if (typeof options.path === 'string') {
        const format = options.path.endsWith('.yaml') || options.path.endsWith('.yml')
          ? 'yaml'
          : 'json';
        writeFormattedFile(options.path, payload, format);
      }
      emit(ctx, payload);
    }));

  graph.command('reindex')
    .description('Re-scan markdown graph layers')
    .action(runWithContext(async (ctx) => {
      emit(ctx, {
        layers: ctx.store.graphLayers(),
        nodes: ctx.store.graphExport().nodes.length,
      });
    }));
}

function registerQueueCommands(program: Command): void {
  const queue = program.command('queue').description('Queue and prioritization helpers');

  queue.command('next')
    .description('Suggest the next active intent')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.queueNext());
    }));

  queue.command('suggest')
    .description('Show a short suggested queue')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.queueSuggest());
    }));

  queue.command('backlog')
    .description('List backlog intents')
    .action(runWithContext(async (ctx) => {
      emit(
        ctx,
        ctx.store.queueBacklog().map(intentRow),
        ['slug', 'status', 'phase', 'priority', 'title'],
      );
    }));
}

function registerBlueprintCommands(program: Command): void {
  const blueprint = program.command('blueprint').description('Blueprint/GAC queue access');
  const gac = blueprint.command('gac').description('GAC queue');

  gac.command('list')
    .option('--status <status>')
    .description('List GAC cards from canon')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, string | undefined>];
      const rows = ctx.store.listGacCards()
        .filter((node) => !options.status || node.status === options.status)
        .map(intentRow);
      emit(ctx, rows, ['slug', 'status', 'priority', 'title']);
    }));

  gac.command('answer <ref>')
    .option('--selected <label>')
    .option('--freeform <text>')
    .option('--actor <actor>', 'answering actor', 'human')
    .description('Answer a GAC card in canon')
    .action(runWithContext(async (ctx, values) => {
      const [ref, options] = values as [string, { selected?: string; freeform?: string; actor: string }];
      emitNode(ctx, ctx.store.answerGac(ref, options.selected, options.freeform, options.actor));
    }));

  gac.command('defer <ref>')
    .requiredOption('--reason <reason>')
    .option('--actor <actor>', 'actor', 'human')
    .description('Defer a GAC card')
    .action(runWithContext(async (ctx, values) => {
      const [ref, options] = values as [string, { reason: string; actor: string }];
      emitNode(ctx, ctx.store.deferGac(ref, options.actor, options.reason));
    }));

  blueprint.command('blockers')
    .description('List blocker nodes if any exist')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.listBlockers().map(nodeRow), ['id', 'type', 'status', 'title']);
    }));

  blueprint.command('aspirations')
    .description('List aspiration nodes if any exist')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.listAspirations().map(nodeRow), ['id', 'type', 'status', 'title']);
    }));
}

function registerDumpCommands(program: Command): void {
  const dump = program.command('dump [text]').description('Raw dump capture and promotion');

  dump
    .action(runWithContext(async (ctx, values) => {
      const [text] = values as [string | undefined];
      if (!text) {
        emit(
          ctx,
          {
            help: 'Pass text to create a dump, or use `ema dump list` / `ema dump promote`.',
          },
        );
        return;
      }
      emitNode(ctx, ctx.store.createDump(text));
    }));

  dump.command('list')
    .description('List captured dumps')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.listDumps().map(nodeRow), ['id', 'status', 'title']);
    }));

  dump.command('promote <ref>')
    .description('Promote a dump into a draft intent')
    .action(runWithContext(async (ctx, values) => {
      const [ref] = values as [string];
      emitNode(ctx, ctx.store.promoteDump(ref));
    }));
}

function registerVaultCommands(program: Command): void {
  const vault = program.command('vault').description('Vault helpers');

  vault.command('status')
    .description('Show vault availability')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.vaultStatus());
    }));

  vault.command('seed')
    .description('Read live proposal seeds via the services layer when available')
    .action(runWithContext(async (ctx) => {
      const payload = await ctx.services.get<{ seeds: unknown[] }>('/api/proposals/seeds');
      if (!payload) {
        emit(ctx, {
          status: 'offline',
          detail: 'Services unavailable. File-backed seeding is not implemented yet.',
        });
        return;
      }
      emit(ctx, payload);
    }));

  vault.command('watch')
    .description('Reserved for a future watch-mode vault stream')
    .action(runWithContext(async (ctx) => {
      emit(ctx, {
        status: 'deferred',
        detail: 'Not yet implemented. Use workers/src/vault-watcher.ts for the current watcher path.',
      });
    }));
}

function registerPipeCommands(program: Command): void {
  const pipe = program.command('pipe').description('Pipes registry access');

  pipe.command('list')
    .description('List registered pipes or fallback catalog counts')
    .action(runWithContext(async (ctx) => {
      const payload = await ctx.services.get<{ pipes: unknown[] }>('/api/pipes');
      if (payload) {
        emit(ctx, payload);
        return;
      }
      emit(ctx, ctx.store.pipeCatalogFallback());
    }));

  pipe.command('fire <trigger>')
    .option('--payload <json>')
    .description('Reserved for explicit trigger injection')
    .action(runWithContext(async (ctx, values) => {
      const [trigger, options] = values as [string, { payload?: string }];
      emit(ctx, {
        status: 'deferred',
        trigger,
        payload: options.payload ?? '',
        detail: 'Not yet implemented. The current services surface exposes catalog/history but not direct trigger injection.',
      });
    }));

  pipe.command('history')
    .option('--pipe-id <id>')
    .description('Show pipe run history')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      const suffix = typeof options.pipeId === 'string'
        ? `?pipe_id=${encodeURIComponent(options.pipeId)}`
        : '';
      const payload = await ctx.services.get(`/api/pipes/history${suffix}`);
      if (!payload) {
        emit(ctx, {
          status: 'offline',
          detail: 'Services unavailable. Pipe history is only exposed by the live service.',
        });
        return;
      }
      emit(ctx, payload);
    }));
}

function registerAgentCommands(program: Command): void {
  const agent = program.command('agent').description('Agent config and runtime overview');

  agent.command('list')
    .description('List discovered agent config roots')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.agentConfigs(), ['agent', 'path', 'sessions', 'firstActivity', 'lastActivity']);
    }));

  agent.command('status')
    .description('Show agent-related service status')
    .action(runWithContext(async (ctx) => {
      const probe = await ctx.services.probe();
      emit(ctx, {
        service_available: probe.available,
        runtime_endpoint: `${ctx.serviceUrl}/api/agents/runtime-transition`,
        configs: ctx.store.agentConfigs(),
      });
    }));

  agent.command('config')
    .description('Show local agent configuration inventory')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.agentConfigs());
    }));
}

function registerIngestCommands(program: Command): void {
  const ingest = program.command('ingest').description('Agent session ingestion and archaeology');

  ingest.command('scan')
    .description('Discover local agent configs')
    .action(runWithContext(async (ctx) => {
      emit(ctx, ctx.store.agentConfigs(), ['agent', 'path', 'sessions', 'firstActivity', 'lastActivity']);
    }));

  ingest.command('sessions')
    .option('--agent <agent>')
    .description('Parse local session histories into a timeline')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      const timeline = ctx.store.parseAgentTimeline(
        typeof options.agent === 'string' ? options.agent : undefined,
      );
      emit(
        ctx,
        timeline.map(timelineRow),
        ['timestamp', 'agent', 'project', 'messages', 'opening_prompt', 'session'],
      );
    }));

  ingest.command('backfeed')
    .option('--agent <agent>')
    .description('Generate draft backfeed proposals from session openings')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      emit(ctx, ctx.store.backfeedFromTimeline(
        typeof options.agent === 'string' ? options.agent : undefined,
      ));
    }));

  ingest.command('status')
    .description('Show ingestion coverage status')
    .action(runWithContext(async (ctx) => {
      const timeline = ctx.store.parseAgentTimeline();
      emit(ctx, {
        configs: ctx.store.agentConfigs().length,
        sessions: timeline.length,
        latest: timeline[0] ?? null,
      });
    }));

  const link = ingest.command('link').description('Future external conversation sources');

  link.command('claude.ai')
    .description('Future claude.ai session linking')
    .action(runWithContext(async (ctx) => {
      await ensureIntent(ctx, 'INT-CHANNEL-INTEGRATIONS', 'Channel integrations for external conversation imports');
      emit(ctx, {
        status: 'deferred',
        detail: 'Not yet implemented — requires OAuth/API integration. See INT-CHANNEL-INTEGRATIONS.',
      });
    }));

  link.command('chatgpt')
    .description('Future ChatGPT session linking')
    .action(runWithContext(async (ctx) => {
      await ensureIntent(ctx, 'INT-CHANNEL-INTEGRATIONS', 'Channel integrations for external conversation imports');
      emit(ctx, {
        status: 'deferred',
        detail: 'Not yet implemented — requires OAuth/API integration. See INT-CHANNEL-INTEGRATIONS.',
      });
    }));

  link.command('discord <channel>')
    .description('Future Discord history linking')
    .action(runWithContext(async (ctx, values) => {
      const [channel] = values as [string];
      await ensureIntent(ctx, 'INT-CHANNEL-INTEGRATIONS', 'Channel integrations for external conversation imports');
      emit(ctx, {
        status: 'deferred',
        channel,
        detail: 'Not yet implemented — requires OAuth/API integration. See INT-CHANNEL-INTEGRATIONS.',
      });
    }));

  link.command('imessage')
    .description('Future iMessage history linking')
    .action(runWithContext(async (ctx) => {
      await ensureIntent(ctx, 'INT-CHANNEL-INTEGRATIONS', 'Channel integrations for external conversation imports');
      emit(ctx, {
        status: 'deferred',
        detail: 'Not yet implemented — requires API/OS integration. See INT-CHANNEL-INTEGRATIONS.',
      });
    }));
}

function registerServiceCommands(program: Command): void {
  const services = program.command('services').description('Manage EMA services');

  services.command('start')
    .description('Spawn the services process in the background')
    .action(runWithContext(async (ctx) => {
      const packageJson = `${ctx.store.repoRoot}/package.json`;
      if (!existsSync(packageJson)) {
        throw new Error(`repo_root_not_found ${ctx.store.repoRoot}`);
      }
      const child = spawn(
        'pnpm',
        ['--filter', '@ema/services', 'dev'],
        {
          cwd: ctx.store.repoRoot,
          detached: true,
          stdio: 'ignore',
        },
      );
      child.unref();
      emit(ctx, {
        status: 'started',
        pid: child.pid ?? null,
        cwd: ctx.store.repoRoot,
      });
    }));

  services.command('status')
    .description('Show services health endpoint status')
    .action(runWithContext(async (ctx) => {
      emit(ctx, await ctx.services.probe());
    }));
}

function runWithContext(handler: ActionHandler) {
  return async (...args: unknown[]): Promise<void> => {
    const command = args[args.length - 1] as Command;
    try {
      const context = await createContext(command);
      await handler(context, args.slice(0, -1));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(message);
      process.exitCode = 1;
    }
  };
}

async function createContext(command: Command): Promise<CliContext> {
  const options = command.optsWithGlobals() as GlobalOptions;
  return {
    format: options.format,
    store: new GenesisStore(
      typeof options.genesisRoot === 'string' && options.genesisRoot.length > 0
        ? { genesisRoot: options.genesisRoot }
        : {},
    ),
    services: new ServiceConnection({ baseUrl: options.serviceUrl }),
    serviceUrl: options.serviceUrl,
  };
}

function emit(
  context: CliContext,
  value: unknown,
  columns?: readonly string[],
): void {
  printValue(value, context.format, columns ? { columns } : {});
}

function emitNode(context: CliContext, node: MarkdownNode): void {
  emit(context, {
    id: node.id,
    title: node.title,
    status: node.status,
    type: node.type,
    layer: node.layer,
    ref: node.relPath,
    connections: node.connections,
    body: node.content.trim(),
  });
}

function intentRow(node: IntentNode): Record<string, unknown> {
  return {
    slug: node.slug,
    status: node.status,
    phase: node.phase,
    priority: node.priority,
    title: node.title,
  };
}

function canonRow(node: CanonNode): Record<string, unknown> {
  return {
    id: node.id,
    status: node.status,
    subtype: node.subtype || node.type,
    ref: node.relPath,
    title: node.title,
  };
}

function nodeRow(node: MarkdownNode): Record<string, unknown> {
  return {
    id: node.id,
    type: node.type,
    status: node.status,
    title: node.title,
  };
}

function timelineRow(node: TimelineEntry): Record<string, unknown> {
  return {
    timestamp: node.timestamp,
    agent: node.agent,
    project: node.project,
    messages: node.messageCount,
    opening_prompt: node.openingPrompt,
    session: node.sessionPath,
  };
}

async function ensureIntent(context: CliContext, slug: string, title: string): Promise<void> {
  if (context.store.getIntent(slug)) return;
  context.store.createIntent({
    slug,
    title,
    kind: 'process',
    status: 'draft',
    priority: 'medium',
  });
}

async function readBodyFromStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  return await new Promise<string>((resolve, reject) => {
    let body = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      body += chunk;
    });
    process.stdin.on('end', () => resolve(body));
    process.stdin.on('error', reject);
  });
}

function parseFormat(value: string): OutputFormat {
  if (value === 'table' || value === 'json' || value === 'yaml') return value;
  throw new InvalidArgumentError('format must be one of: table, json, yaml');
}

function parseInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError('value must be a non-negative integer');
  }
  return parsed;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  await runCli(process.argv);
}
