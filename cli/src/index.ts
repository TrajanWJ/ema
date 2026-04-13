import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
import { BackendFlowClient } from './lib/backend-flow.js';
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
  registerBackendCommands(program);
  registerGoalCommands(program);
  registerCalendarCommands(program);
  registerProposalCommands(program);
  registerExecutionCommands(program);
  registerReviewCommands(program);
  registerCanonCommands(program);
  registerGraphCommands(program);
  registerQueueCommands(program);
  registerBlueprintCommands(program);
  registerDumpCommands(program);
  registerVaultCommands(program);
  registerPipeCommands(program);
  registerAgentCommands(program);
  registerChronicleCommands(program);
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

function registerBackendCommands(program: Command): void {
  const backend = program.command('backend').description('Normalized backend inspection and active runtime flow');

  backend.command('manifest')
    .description('Show the normalized backend manifest from the live services runtime')
    .action(runWithContext(async (ctx) => {
      emit(ctx, await ctx.services.request('GET', '/api/backend/manifest'));
    }));

  const flow = backend.command('flow').description('Active intent -> execution -> result loop');

  flow.command('intents')
    .option('--status <status>')
    .option('--level <level>')
    .option('--kind <kind>')
    .option('--phase <phase>')
    .description('List runtime intents from the active backend')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [options] = values as [Record<string, string | undefined>];
      const intents = await client.listIntents({
        ...(options.status ? { status: options.status } : {}),
        ...(options.level ? { level: options.level } : {}),
        ...(options.kind ? { kind: options.kind } : {}),
        ...(options.phase ? { phase: options.phase } : {}),
      });
      emit(
        ctx,
        intents.map((intent) => ({
          id: intent.id,
          status: intent.status,
          level: intent.level,
          kind: intent.kind ?? null,
          title: intent.title,
        })),
        ['id', 'status', 'level', 'kind', 'title'],
      );
    }));

  flow.command('create-intent')
    .requiredOption('--title <title>')
    .requiredOption('--level <level>')
    .option('--slug <slug>')
    .option('--description <description>')
    .option('--status <status>')
    .option('--kind <kind>')
    .option('--phase <phase>')
    .option('--parent-id <parentId>')
    .option('--project-id <projectId>')
    .option('--actor-id <actorId>')
    .option('--exit-condition <exitCondition>')
    .option('--scope <scope...>')
    .option('--space-id <spaceId>')
    .option('--tag <tag...>')
    .description('Create an active runtime intent on the backend')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [options] = values as [Record<string, unknown>];
      emit(
        ctx,
        await client.createIntent({
          title: String(options.title),
          level: String(options.level),
          ...(typeof options.slug === 'string' ? { slug: options.slug } : {}),
          ...(typeof options.description === 'string' ? { description: options.description } : {}),
          ...(typeof options.status === 'string' ? { status: options.status } : {}),
          ...(typeof options.kind === 'string' ? { kind: options.kind } : {}),
          ...(typeof options.phase === 'string' ? { phase: options.phase } : {}),
          ...(typeof options.parentId === 'string' ? { parent_id: options.parentId } : {}),
          ...(typeof options.projectId === 'string' ? { project_id: options.projectId } : {}),
          ...(typeof options.actorId === 'string' ? { actor_id: options.actorId } : {}),
          ...(typeof options.exitCondition === 'string'
            ? { exit_condition: options.exitCondition }
            : {}),
          ...(Array.isArray(options.scope) ? { scope: options.scope.filter(isString) } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
          ...(Array.isArray(options.tag) ? { tags: options.tag.filter(isString) } : {}),
        }),
      );
    }));

  flow.command('intent <slug>')
    .description('Show one runtime intent bundle')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [slug] = values as [string];
      emit(ctx, await client.getIntentRuntime(slug));
    }));

  flow.command('start <slug>')
    .option('--title <title>')
    .option('--objective <objective>')
    .option('--mode <mode>')
    .option('--requires-approval')
    .option('--project-slug <projectSlug>')
    .option('--space-id <spaceId>')
    .description('Create an execution from a runtime intent')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [slug, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await client.startExecutionFromIntent(slug, {
          ...(typeof options.title === 'string' ? { title: options.title } : {}),
          ...(typeof options.objective === 'string' ? { objective: options.objective } : {}),
          ...(typeof options.mode === 'string' ? { mode: options.mode } : {}),
          ...(options.requiresApproval === true ? { requires_approval: true } : {}),
          ...(typeof options.projectSlug === 'string' ? { project_slug: options.projectSlug } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
        }),
      );
    }));

  flow.command('execution <id>')
    .description('Show one execution with transitions')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id] = values as [string];
      emit(ctx, await client.getExecution(id));
    }));

  flow.command('phase <id>')
    .requiredOption('--to <phase>')
    .requiredOption('--reason <reason>')
    .option('--summary <summary>')
    .description('Append an execution phase transition')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await client.transitionExecutionPhase(id, {
          to: String(options.to),
          reason: String(options.reason),
          ...(typeof options.summary === 'string' ? { summary: options.summary } : {}),
        }),
      );
    }));

  flow.command('step <id>')
    .requiredOption('--label <label>')
    .option('--note <note>')
    .description('Append a progress step to an execution')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await client.appendExecutionStep(id, {
          label: String(options.label),
          ...(typeof options.note === 'string' ? { note: options.note } : {}),
        }),
      );
    }));

  flow.command('result <id>')
    .requiredOption('--path <path>')
    .option('--summary <summary>')
    .option('--intent-status <status>')
    .option('--intent-phase <phase>')
    .option('--intent-event <event>')
    .description('Attach result evidence to an execution')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await client.recordExecutionResult(id, {
          result_path: String(options.path),
          ...(typeof options.summary === 'string' ? { result_summary: options.summary } : {}),
          ...(typeof options.intentStatus === 'string' ? { intent_status: options.intentStatus } : {}),
          ...(typeof options.intentPhase === 'string' ? { intent_phase: options.intentPhase } : {}),
          ...(typeof options.intentEvent === 'string' ? { intent_event: options.intentEvent } : {}),
        }),
      );
    }));

  flow.command('complete <id>')
    .option('--summary <summary>')
    .option('--path <path>')
    .option('--intent-status <status>')
    .option('--intent-phase <phase>')
    .option('--intent-event <event>')
    .description('Complete an execution and optionally sync linked intent state')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await client.completeExecution(id, {
          ...(typeof options.summary === 'string' ? { result_summary: options.summary } : {}),
          ...(typeof options.path === 'string' ? { result_path: options.path } : {}),
          ...(typeof options.intentStatus === 'string' ? { intent_status: options.intentStatus } : {}),
          ...(typeof options.intentPhase === 'string' ? { intent_phase: options.intentPhase } : {}),
          ...(typeof options.intentEvent === 'string' ? { intent_event: options.intentEvent } : {}),
        }),
      );
    }));

  const proposals = backend.command('proposal').description(
    'Active durable proposal lifecycle used by the current backend',
  );

  proposals.command('list')
    .option('--status <status>')
    .option('--intent <intentId>')
    .description('List durable backend proposals')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [options] = values as [Record<string, string | undefined>];
      const rows = await client.listProposals({
        ...(options.status ? { status: options.status } : {}),
        ...(options.intent ? { intent_id: options.intent } : {}),
      });
      emit(
        ctx,
        rows.map((proposal) => ({
          id: proposal.id,
          intent_id: proposal.intent_id,
          status: proposal.status,
          revision: proposal.revision,
          title: proposal.title,
        })),
        ['id', 'intent_id', 'status', 'revision', 'title'],
      );
    }));

  proposals.command('view <id>')
    .description('Show one durable backend proposal')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id] = values as [string];
      emit(ctx, await client.getProposal(id));
    }));

  proposals.command('approve <id>')
    .option('--actor-id <actorId>')
    .description('Approve a durable backend proposal so execution can start')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await client.approveProposal(id, {
          ...(typeof options.actorId === 'string' ? { actor_id: options.actorId } : {}),
        }),
      );
    }));

  proposals.command('reject <id>')
    .requiredOption('--reason <reason>')
    .option('--actor-id <actorId>')
    .description('Reject a durable backend proposal')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await client.rejectProposal(id, {
          actor_id:
            typeof options.actorId === 'string' ? options.actorId : 'actor_human_owner',
          reason: String(options.reason),
        }),
      );
    }));

  proposals.command('start <id>')
    .option('--title <title>')
    .option('--objective <objective>')
    .option('--mode <mode>')
    .option('--requires-approval')
    .option('--project-slug <projectSlug>')
    .option('--space-id <spaceId>')
    .description('Start an execution from an approved durable backend proposal')
    .action(runWithContext(async (ctx, values) => {
      const client = new BackendFlowClient(ctx.services);
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await client.startExecutionFromProposal(id, {
          ...(typeof options.title === 'string' ? { title: options.title } : {}),
          ...(typeof options.objective === 'string' ? { objective: options.objective } : {}),
          ...(typeof options.mode === 'string' ? { mode: options.mode } : {}),
          ...(options.requiresApproval === true ? { requires_approval: true } : {}),
          ...(typeof options.projectSlug === 'string' ? { project_slug: options.projectSlug } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
        }),
      );
    }));
}

function registerGoalCommands(program: Command): void {
  const goal = program.command('goal').description('Operational human and agent goals');

  goal.command('list')
    .option('--status <status>')
    .option('--timeframe <timeframe>')
    .option('--owner-kind <ownerKind>')
    .option('--owner-id <ownerId>')
    .option('--project-id <projectId>')
    .option('--intent <intentSlug>')
    .description('List active goals from the current backend runtime')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, string | undefined>];
      const params = new URLSearchParams();
      if (options.status) params.set('status', options.status);
      if (options.timeframe) params.set('timeframe', options.timeframe);
      if (options.ownerKind) params.set('owner_kind', options.ownerKind);
      if (options.ownerId) params.set('owner_id', options.ownerId);
      if (options.projectId) params.set('project_id', options.projectId);
      if (options.intent) params.set('intent_slug', options.intent);
      const suffix = params.size > 0 ? `?${params.toString()}` : '';
      const payload = await ctx.services.request<{ goals: Array<Record<string, unknown>> }>(
        'GET',
        `/api/goals${suffix}`,
      );
      emit(ctx, payload.goals, [
        'id',
        'title',
        'status',
        'timeframe',
        'owner_kind',
        'owner_id',
        'intent_slug',
      ]);
    }));

  goal.command('view <id>')
    .description('Show one goal plus child goals')
    .action(runWithContext(async (ctx, values) => {
      const [id] = values as [string];
      emit(ctx, await ctx.services.request('GET', `/api/goals/${id}/context`));
    }));

  goal.command('context <id>')
    .description('Show full goal context: children, proposals, executions, calendar, buildouts')
    .action(runWithContext(async (ctx, values) => {
      const [id] = values as [string];
      emit(ctx, await ctx.services.request('GET', `/api/goals/${id}/context`));
    }));

  goal.command('create')
    .requiredOption('--title <title>')
    .requiredOption('--timeframe <timeframe>')
    .option('--description <description>')
    .option('--owner-kind <ownerKind>', 'human|agent', 'human')
    .option('--owner-id <ownerId>', 'Opaque owner handle', 'owner')
    .option('--status <status>')
    .option('--parent-id <parentId>')
    .option('--project-id <projectId>')
    .option('--space-id <spaceId>')
    .option('--intent <intentSlug>')
    .option('--target-date <targetDate>')
    .option('--success-criteria <successCriteria>')
    .description('Create a new operational goal')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      emit(
        ctx,
        await ctx.services.request('POST', '/api/goals', {
          title: String(options.title),
          timeframe: String(options.timeframe),
          ...(typeof options.description === 'string' ? { description: options.description } : {}),
          ...(typeof options.ownerKind === 'string' ? { owner_kind: options.ownerKind } : {}),
          ...(typeof options.ownerId === 'string' ? { owner_id: options.ownerId } : {}),
          ...(typeof options.status === 'string' ? { status: options.status } : {}),
          ...(typeof options.parentId === 'string' ? { parent_id: options.parentId } : {}),
          ...(typeof options.projectId === 'string' ? { project_id: options.projectId } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
          ...(typeof options.intent === 'string' ? { intent_slug: options.intent } : {}),
          ...(typeof options.targetDate === 'string' ? { target_date: options.targetDate } : {}),
          ...(typeof options.successCriteria === 'string'
            ? { success_criteria: options.successCriteria }
            : {}),
        }),
      );
    }));

  goal.command('update <id>')
    .option('--title <title>')
    .option('--description <description>')
    .option('--timeframe <timeframe>')
    .option('--status <status>')
    .option('--owner-kind <ownerKind>')
    .option('--owner-id <ownerId>')
    .option('--parent-id <parentId>')
    .option('--project-id <projectId>')
    .option('--space-id <spaceId>')
    .option('--intent <intentSlug>')
    .option('--target-date <targetDate>')
    .option('--success-criteria <successCriteria>')
    .description('Update a goal in place')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await ctx.services.request('PUT', `/api/goals/${id}`, {
          ...(typeof options.title === 'string' ? { title: options.title } : {}),
          ...(typeof options.description === 'string' ? { description: options.description } : {}),
          ...(typeof options.timeframe === 'string' ? { timeframe: options.timeframe } : {}),
          ...(typeof options.status === 'string' ? { status: options.status } : {}),
          ...(typeof options.ownerKind === 'string' ? { owner_kind: options.ownerKind } : {}),
          ...(typeof options.ownerId === 'string' ? { owner_id: options.ownerId } : {}),
          ...(typeof options.parentId === 'string' ? { parent_id: options.parentId } : {}),
          ...(typeof options.projectId === 'string' ? { project_id: options.projectId } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
          ...(typeof options.intent === 'string' ? { intent_slug: options.intent } : {}),
          ...(typeof options.targetDate === 'string' ? { target_date: options.targetDate } : {}),
          ...(typeof options.successCriteria === 'string'
            ? { success_criteria: options.successCriteria }
            : {}),
        }),
      );
    }));

  goal.command('propose <id>')
    .option('--actor-id <actorId>')
    .option('--title <title>')
    .option('--summary <summary>')
    .option('--rationale <rationale>')
    .option('--plan-step <step...>')
    .description('Generate a durable proposal from the goal-linked intent')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await ctx.services.request('POST', `/api/goals/${id}/proposals`, {
          ...(typeof options.actorId === 'string' ? { actor_id: options.actorId } : {}),
          ...(typeof options.title === 'string' ? { title: options.title } : {}),
          ...(typeof options.summary === 'string' ? { summary: options.summary } : {}),
          ...(typeof options.rationale === 'string' ? { rationale: options.rationale } : {}),
          ...(Array.isArray(options.planStep)
            ? { plan_steps: options.planStep.filter(isString) }
            : {}),
        }),
      );
    }));

  goal.command('buildout <id>')
    .requiredOption('--start-at <startAt>')
    .option('--owner-id <ownerId>')
    .option('--title <title>')
    .option('--description <description>')
    .option('--plan-min <minutes>', 'Planning phase duration in minutes', parseInteger)
    .option('--execute-min <minutes>', 'Execution phase duration in minutes', parseInteger)
    .option('--review-min <minutes>', 'Review phase duration in minutes', parseInteger)
    .option('--retro-min <minutes>', 'Retro phase duration in minutes', parseInteger)
    .description('Create a phased agent buildout from a goal')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await ctx.services.request('POST', `/api/goals/${id}/buildouts`, {
          start_at: String(options.startAt),
          ...(typeof options.ownerId === 'string' ? { owner_id: options.ownerId } : {}),
          ...(typeof options.title === 'string' ? { title: options.title } : {}),
          ...(typeof options.description === 'string' ? { description: options.description } : {}),
          ...(typeof options.planMin === 'number' ? { plan_minutes: options.planMin } : {}),
          ...(typeof options.executeMin === 'number' ? { execute_minutes: options.executeMin } : {}),
          ...(typeof options.reviewMin === 'number' ? { review_minutes: options.reviewMin } : {}),
          ...(typeof options.retroMin === 'number' ? { retro_minutes: options.retroMin } : {}),
        }),
      );
    }));

  goal.command('execute <id>')
    .option('--proposal-id <proposalId>')
    .option('--buildout-id <buildoutId>')
    .option('--title <title>')
    .option('--objective <objective>')
    .option('--mode <mode>')
    .option('--requires-approval')
    .option('--project-slug <projectSlug>')
    .option('--space-id <spaceId>')
    .description('Start execution for a goal, preferring an approved proposal when available')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await ctx.services.request('POST', `/api/goals/${id}/executions`, {
          ...(typeof options.proposalId === 'string' ? { proposal_id: options.proposalId } : {}),
          ...(typeof options.buildoutId === 'string' ? { buildout_id: options.buildoutId } : {}),
          ...(typeof options.title === 'string' ? { title: options.title } : {}),
          ...(typeof options.objective === 'string' ? { objective: options.objective } : {}),
          ...(typeof options.mode === 'string' ? { mode: options.mode } : {}),
          ...(options.requiresApproval === true ? { requires_approval: true } : {}),
          ...(typeof options.projectSlug === 'string' ? { project_slug: options.projectSlug } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
        }),
      );
    }));

  goal.command('complete <id>')
    .description('Mark a goal completed')
    .action(runWithContext(async (ctx, values) => {
      const [id] = values as [string];
      emit(ctx, await ctx.services.request('POST', `/api/goals/${id}/complete`));
    }));

  goal.command('delete <id>')
    .description('Delete a goal')
    .action(runWithContext(async (ctx, values) => {
      const [id] = values as [string];
      emit(ctx, await ctx.services.request('DELETE', `/api/goals/${id}`));
    }));
}

function registerCalendarCommands(program: Command): void {
  const calendar = program.command('calendar').description('Human schedule and agent virtual planning calendar');

  calendar.command('list')
    .option('--owner-kind <ownerKind>')
    .option('--owner-id <ownerId>')
    .option('--status <status>')
    .option('--kind <entryKind>')
    .option('--goal-id <goalId>')
    .option('--intent <intentSlug>')
    .option('--from <from>')
    .option('--to <to>')
    .option('--buildout-id <buildoutId>')
    .description('List calendar entries from the current backend runtime')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, string | undefined>];
      const params = new URLSearchParams();
      if (options.ownerKind) params.set('owner_kind', options.ownerKind);
      if (options.ownerId) params.set('owner_id', options.ownerId);
      if (options.status) params.set('status', options.status);
      if (options.kind) params.set('entry_kind', options.kind);
      if (options.goalId) params.set('goal_id', options.goalId);
      if (options.intent) params.set('intent_slug', options.intent);
      if (options.from) params.set('from', options.from);
      if (options.to) params.set('to', options.to);
      if (options.buildoutId) params.set('buildout_id', options.buildoutId);
      const suffix = params.size > 0 ? `?${params.toString()}` : '';
      const payload = await ctx.services.request<{ entries: Array<Record<string, unknown>> }>(
        'GET',
        `/api/calendar${suffix}`,
      );
      emit(ctx, payload.entries, [
        'id',
        'title',
        'entry_kind',
        'status',
        'owner_kind',
        'owner_id',
        'phase',
        'starts_at',
        'ends_at',
      ]);
    }));

  calendar.command('view <id>')
    .description('Show one calendar entry')
    .action(runWithContext(async (ctx, values) => {
      const [id] = values as [string];
      emit(ctx, await ctx.services.request('GET', `/api/calendar/${id}`));
    }));

  calendar.command('create')
    .requiredOption('--title <title>')
    .requiredOption('--kind <entryKind>')
    .requiredOption('--start-at <startAt>')
    .option('--end-at <endAt>')
    .option('--description <description>')
    .option('--owner-kind <ownerKind>', 'human|agent', 'human')
    .option('--owner-id <ownerId>', 'Opaque owner handle', 'owner')
    .option('--status <status>')
    .option('--phase <phase>')
    .option('--goal-id <goalId>')
    .option('--project-id <projectId>')
    .option('--space-id <spaceId>')
    .option('--intent <intentSlug>')
    .option('--execution-id <executionId>')
    .option('--location <location>')
    .description('Create a human schedule item or agent virtual block')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      emit(
        ctx,
        await ctx.services.request('POST', '/api/calendar', {
          title: String(options.title),
          entry_kind: String(options.kind),
          starts_at: String(options.startAt),
          ...(typeof options.endAt === 'string' ? { ends_at: options.endAt } : {}),
          ...(typeof options.description === 'string' ? { description: options.description } : {}),
          ...(typeof options.ownerKind === 'string' ? { owner_kind: options.ownerKind } : {}),
          ...(typeof options.ownerId === 'string' ? { owner_id: options.ownerId } : {}),
          ...(typeof options.status === 'string' ? { status: options.status } : {}),
          ...(typeof options.phase === 'string' ? { phase: options.phase } : {}),
          ...(typeof options.goalId === 'string' ? { goal_id: options.goalId } : {}),
          ...(typeof options.projectId === 'string' ? { project_id: options.projectId } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
          ...(typeof options.intent === 'string' ? { intent_slug: options.intent } : {}),
          ...(typeof options.executionId === 'string' ? { execution_id: options.executionId } : {}),
          ...(typeof options.location === 'string' ? { location: options.location } : {}),
        }),
      );
    }));

  calendar.command('update <id>')
    .option('--title <title>')
    .option('--kind <entryKind>')
    .option('--start-at <startAt>')
    .option('--end-at <endAt>')
    .option('--description <description>')
    .option('--owner-kind <ownerKind>')
    .option('--owner-id <ownerId>')
    .option('--status <status>')
    .option('--phase <phase>')
    .option('--goal-id <goalId>')
    .option('--project-id <projectId>')
    .option('--space-id <spaceId>')
    .option('--intent <intentSlug>')
    .option('--execution-id <executionId>')
    .option('--location <location>')
    .description('Update an existing calendar entry')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(
        ctx,
        await ctx.services.request('PUT', `/api/calendar/${id}`, {
          ...(typeof options.title === 'string' ? { title: options.title } : {}),
          ...(typeof options.kind === 'string' ? { entry_kind: options.kind } : {}),
          ...(typeof options.startAt === 'string' ? { starts_at: options.startAt } : {}),
          ...(typeof options.endAt === 'string' ? { ends_at: options.endAt } : {}),
          ...(typeof options.description === 'string' ? { description: options.description } : {}),
          ...(typeof options.ownerKind === 'string' ? { owner_kind: options.ownerKind } : {}),
          ...(typeof options.ownerId === 'string' ? { owner_id: options.ownerId } : {}),
          ...(typeof options.status === 'string' ? { status: options.status } : {}),
          ...(typeof options.phase === 'string' ? { phase: options.phase } : {}),
          ...(typeof options.goalId === 'string' ? { goal_id: options.goalId } : {}),
          ...(typeof options.projectId === 'string' ? { project_id: options.projectId } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
          ...(typeof options.intent === 'string' ? { intent_slug: options.intent } : {}),
          ...(typeof options.executionId === 'string' ? { execution_id: options.executionId } : {}),
          ...(typeof options.location === 'string' ? { location: options.location } : {}),
        }),
      );
    }));

  calendar.command('delete <id>')
    .description('Delete a calendar entry')
    .action(runWithContext(async (ctx, values) => {
      const [id] = values as [string];
      emit(ctx, await ctx.services.request('DELETE', `/api/calendar/${id}`));
    }));

  calendar.command('buildout')
    .requiredOption('--owner-id <ownerId>')
    .requiredOption('--start-at <startAt>')
    .option('--goal-id <goalId>')
    .option('--title <title>')
    .option('--description <description>')
    .option('--plan-min <minutes>', 'Planning phase duration in minutes', parseInteger)
    .option('--execute-min <minutes>', 'Execution phase duration in minutes', parseInteger)
    .option('--review-min <minutes>', 'Review phase duration in minutes', parseInteger)
    .option('--retro-min <minutes>', 'Retro phase duration in minutes', parseInteger)
    .option('--project-id <projectId>')
    .option('--space-id <spaceId>')
    .option('--intent <intentSlug>')
    .description('Create a phased agent virtual buildout linked to a goal or intent')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      emit(
        ctx,
        await ctx.services.request('POST', '/api/calendar/buildouts', {
          owner_id: String(options.ownerId),
          start_at: String(options.startAt),
          ...(typeof options.goalId === 'string' ? { goal_id: options.goalId } : {}),
          ...(typeof options.title === 'string' ? { title: options.title } : {}),
          ...(typeof options.description === 'string' ? { description: options.description } : {}),
          ...(typeof options.planMin === 'number' ? { plan_minutes: options.planMin } : {}),
          ...(typeof options.executeMin === 'number' ? { execute_minutes: options.executeMin } : {}),
          ...(typeof options.reviewMin === 'number' ? { review_minutes: options.reviewMin } : {}),
          ...(typeof options.retroMin === 'number' ? { retro_minutes: options.retroMin } : {}),
          ...(typeof options.projectId === 'string' ? { project_id: options.projectId } : {}),
          ...(typeof options.spaceId === 'string' ? { space_id: options.spaceId } : {}),
          ...(typeof options.intent === 'string' ? { intent_slug: options.intent } : {}),
        }),
      );
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

function registerChronicleCommands(program: Command): void {
  const chronicle = program.command('chronicle').description('Chronicle landing zone access');

  chronicle.command('list')
    .option('--source-kind <kind>')
    .option('--source-id <id>')
    .option('--limit <n>', 'maximum sessions', parseInteger, 25)
    .description('List Chronicle sessions from the services layer')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      const query = new URLSearchParams();
      if (typeof options.sourceKind === 'string') query.set('source_kind', options.sourceKind);
      if (typeof options.sourceId === 'string') query.set('source_id', options.sourceId);
      if (typeof options.limit === 'number') query.set('limit', String(options.limit));
      const suffix = query.size > 0 ? `?${query.toString()}` : '';
      const payload = await ctx.services.get<{ sessions: unknown[] }>(`/api/chronicle/sessions${suffix}`);
      if (!payload) {
        emit(ctx, {
          status: 'offline',
          detail: 'Chronicle requires the services layer. Start services and retry.',
        });
        return;
      }
      emit(ctx, payload.sessions, [
        'id',
        'source_kind',
        'source_label',
        'status',
        'project_hint',
        'entry_count',
        'artifact_count',
        'title',
      ]);
    }));

  chronicle.command('view <id>')
    .description('Inspect one Chronicle session with entries and artifacts')
    .action(runWithContext(async (ctx, values) => {
      const [id] = values as [string];
      emit(ctx, await ctx.services.request('GET', `/api/chronicle/sessions/${encodeURIComponent(id)}`));
    }));

  chronicle.command('import-file <path>')
    .option('--agent <agent>')
    .option('--source-kind <kind>')
    .option('--label <label>')
    .description('Import a local transcript/log file into Chronicle')
    .action(runWithContext(async (ctx, values) => {
      const [path, options] = values as [string, Record<string, unknown>];
      emit(ctx, await ctx.services.request('POST', '/api/chronicle/import-file', {
        path,
        ...(typeof options.agent === 'string' ? { agent: options.agent } : {}),
        ...(typeof options.sourceKind === 'string' ? { source_kind: options.sourceKind } : {}),
        ...(typeof options.label === 'string' ? { source_label: options.label } : {}),
      }));
    }));

  chronicle.command('import-bundle <path>')
    .description('Import a Chronicle JSON bundle into the services layer')
    .action(runWithContext(async (ctx, values) => {
      const [path] = values as [string];
      const raw = readFileSync(path, 'utf8');
      const payload = JSON.parse(raw) as unknown;
      emit(ctx, await ctx.services.request('POST', '/api/chronicle/import', payload));
    }));

}

function registerReviewCommands(program: Command): void {
  const review = program.command('review').description('Chronicle-backed review queue and promotion receipts');

  review.command('list')
    .option('--status <status>')
    .option('--session-id <id>')
    .option('--entry-id <id>')
    .option('--decision <decision>')
    .option('--limit <n>', 'maximum items', parseInteger, 25)
    .description('List review items from the services layer')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      const query = new URLSearchParams();
      if (typeof options.status === 'string') query.set('status', options.status);
      if (typeof options.sessionId === 'string') query.set('chronicle_session_id', options.sessionId);
      if (typeof options.entryId === 'string') query.set('chronicle_entry_id', options.entryId);
      if (typeof options.decision === 'string') query.set('decision', options.decision);
      if (typeof options.limit === 'number') query.set('limit', String(options.limit));
      emit(ctx, await ctx.services.request('GET', `/api/review/items${query.size > 0 ? `?${query.toString()}` : ''}`));
    }));

  review.command('view <id>')
    .description('Inspect one review item with Chronicle linkage, decisions, and receipts')
    .action(runWithContext(async (ctx, values) => {
      const [id] = values as [string];
      emit(ctx, await ctx.services.request('GET', `/api/review/items/${encodeURIComponent(id)}`));
    }));

  review.command('create')
    .requiredOption('--session-id <id>')
    .option('--entry-id <id>')
    .option('--title <title>')
    .option('--summary <summary>')
    .option('--source-excerpt <text>')
    .option('--suggested-target-kind <kind>')
    .option('--actor <actor>', 'creator actor id', 'actor_human_owner')
    .description('Create or reuse a review item from Chronicle session or entry provenance')
    .action(runWithContext(async (ctx, values) => {
      const [options] = values as [Record<string, unknown>];
      emit(ctx, await ctx.services.request('POST', '/api/review/items', {
        chronicle_session_id: String(options.sessionId),
        ...(typeof options.entryId === 'string' ? { chronicle_entry_id: options.entryId } : {}),
        ...(typeof options.title === 'string' ? { title: options.title } : {}),
        ...(typeof options.summary === 'string' ? { summary: options.summary } : {}),
        ...(typeof options.sourceExcerpt === 'string' ? { source_excerpt: options.sourceExcerpt } : {}),
        ...(typeof options.suggestedTargetKind === 'string'
          ? { suggested_target_kind: options.suggestedTargetKind }
          : {}),
        created_by_actor_id: String(options.actor),
      }));
    }));

  review.command('approve <id>')
    .requiredOption('--actor <actor>')
    .option('--rationale <text>')
    .description('Approve a review item')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(ctx, await ctx.services.request('POST', `/api/review/items/${encodeURIComponent(id)}/approve`, {
        actor_id: String(options.actor),
        ...(typeof options.rationale === 'string' ? { rationale: options.rationale } : {}),
      }));
    }));

  review.command('reject <id>')
    .requiredOption('--actor <actor>')
    .option('--rationale <text>')
    .description('Reject a review item')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(ctx, await ctx.services.request('POST', `/api/review/items/${encodeURIComponent(id)}/reject`, {
        actor_id: String(options.actor),
        ...(typeof options.rationale === 'string' ? { rationale: options.rationale } : {}),
      }));
    }));

  review.command('defer <id>')
    .requiredOption('--actor <actor>')
    .option('--rationale <text>')
    .description('Defer a review item')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(ctx, await ctx.services.request('POST', `/api/review/items/${encodeURIComponent(id)}/defer`, {
        actor_id: String(options.actor),
        ...(typeof options.rationale === 'string' ? { rationale: options.rationale } : {}),
      }));
    }));

  review.command('receipt <id>')
    .requiredOption('--target-kind <kind>')
    .option('--decision-id <id>')
    .option('--target-id <id>')
    .option('--status <status>', 'recorded|linked', 'recorded')
    .option('--summary <summary>')
    .description('Record a promotion receipt for an approved review item')
    .action(runWithContext(async (ctx, values) => {
      const [id, options] = values as [string, Record<string, unknown>];
      emit(ctx, await ctx.services.request('POST', `/api/review/items/${encodeURIComponent(id)}/receipts`, {
        target_kind: String(options.targetKind),
        ...(typeof options.decisionId === 'string' ? { review_decision_id: options.decisionId } : {}),
        ...(typeof options.targetId === 'string' ? { target_id: options.targetId } : {}),
        ...(typeof options.status === 'string' ? { status: options.status } : {}),
        ...(typeof options.summary === 'string' ? { summary: options.summary } : {}),
      }));
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
