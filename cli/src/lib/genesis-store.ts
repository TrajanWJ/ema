import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

import matter from 'gray-matter';

import { getString, getStringArray, parseFrontmatter } from './frontmatter.js';
import { canonDecisionsRoot, canonSpecsRoot, executionsRoot, findGenesisRoot, genesisPath, intentsRoot, researchRoot } from './genesis-root.js';
import { runRipgrep } from './rg-wrapper.js';

export interface Connection {
  readonly relation: string;
  readonly target: string;
}

export interface MarkdownNode {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  readonly type: string;
  readonly layer: string;
  readonly path: string;
  readonly relPath: string;
  readonly content: string;
  readonly data: Record<string, unknown>;
  readonly connections: readonly Connection[];
}

export interface IntentNode extends MarkdownNode {
  readonly priority: string;
  readonly phase: string;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly scope: readonly string[];
}

export interface ExecutionNode extends MarkdownNode {
  readonly completedAt: string;
}

export interface ProposalNode extends MarkdownNode {
  readonly intentRef: string;
  readonly revision: number;
}

export interface CanonNode extends MarkdownNode {
  readonly subtype: string;
}

export interface DumpNode extends MarkdownNode {}

export interface SessionPrompt {
  readonly timestamp: string;
  readonly project: string;
  readonly prompt: string;
}

export interface AgentConfigSummary {
  readonly agent: string;
  readonly path: string;
  readonly sessions: number;
  readonly projects: readonly string[];
  readonly firstActivity: string;
  readonly lastActivity: string;
}

export interface TimelineEntry {
  readonly timestamp: string;
  readonly agent: string;
  readonly sessionPath: string;
  readonly project: string;
  readonly messageCount: number;
  readonly openingPrompt: string;
}

export interface BackfeedProposal {
  readonly title: string;
  readonly summary: string;
  readonly sourceSession: string;
}

export interface GraphEdge {
  readonly from: string;
  readonly relation: string;
  readonly to: string;
}

export interface GraphExport {
  readonly nodes: readonly {
    id: string;
    title: string;
    type: string;
    layer: string;
    ref: string;
  }[];
  readonly edges: readonly GraphEdge[];
}

export interface GenesisStoreOptions {
  readonly genesisRoot?: string;
}

export interface CreateIntentInput {
  readonly slug?: string;
  readonly title: string;
  readonly kind?: string;
  readonly status?: string;
  readonly phase?: string;
  readonly priority?: string;
  readonly exitCondition?: string;
  readonly scope?: readonly string[];
  readonly tags?: readonly string[];
  readonly body?: string;
}

export interface UpdateIntentInput {
  readonly title?: string;
  readonly status?: string;
  readonly phase?: string;
  readonly priority?: string;
  readonly kind?: string;
  readonly exitCondition?: string;
  readonly scope?: readonly string[];
  readonly tags?: readonly string[];
  readonly body?: string;
}

export interface CreateExecutionInput {
  readonly title: string;
  readonly objective?: string;
  readonly intentSlug?: string;
  readonly body?: string;
}

export interface CreateProposalInput {
  readonly title: string;
  readonly intentRef?: string;
  readonly summary?: string;
  readonly actor?: string;
  readonly body?: string;
}

export class GenesisStore {
  public readonly genesisRoot: string;

  public readonly repoRoot: string;

  constructor(options: GenesisStoreOptions = {}) {
    this.genesisRoot = resolve(options.genesisRoot ?? findGenesisRoot());
    this.repoRoot = dirname(this.genesisRoot);
  }

  listIntents(): IntentNode[] {
    return this.readIntentFiles()
      .map((path) => this.readIntent(path))
      .sort((a, b) => byPriority(a.priority, b.priority) || a.slug.localeCompare(b.slug));
  }

  getIntent(ref: string): IntentNode | null {
    const resolved = this.resolveNodePath(ref, ['intents']);
    if (!resolved) return null;
    return this.readIntent(resolved);
  }

  createIntent(input: CreateIntentInput): IntentNode {
    const slug = normalizeIntentSlug(input.slug ?? input.title);
    const path = join(intentsRoot(), slug, 'README.md');
    if (existsSync(path)) {
      throw new Error(`intent_exists ${slug}`);
    }

    const now = isoNow();
    const data: Record<string, unknown> = {
      id: slug,
      type: slug.startsWith('GAC-') ? 'gac_card' : 'intent',
      layer: 'intents',
      title: input.title,
      status: input.status ?? 'draft',
      kind: input.kind ?? 'new-work',
      phase: input.phase ?? 'plan',
      priority: input.priority ?? 'medium',
      created: now,
      updated: now,
      author: 'ema-cli',
      connections: [],
      tags: [...(input.tags ?? [])],
    };

    if (input.exitCondition) data.exit_condition = input.exitCondition;
    if (input.scope && input.scope.length > 0) data.scope = [...input.scope];

    this.writeMarkdown(path, data, input.body ?? `# ${slug} — ${input.title}\n`);
    return this.readIntent(path);
  }

  updateIntent(ref: string, patch: UpdateIntentInput): IntentNode {
    const node = this.requireNode(ref, ['intents']);
    const next = { ...node.data };
    if (patch.title) next.title = patch.title;
    if (patch.status) next.status = patch.status;
    if (patch.phase) next.phase = patch.phase;
    if (patch.priority) next.priority = patch.priority;
    if (patch.kind) next.kind = patch.kind;
    if (patch.exitCondition) next.exit_condition = patch.exitCondition;
    if (patch.scope) next.scope = [...patch.scope];
    if (patch.tags) next.tags = [...patch.tags];
    next.updated = isoNow();
    this.writeMarkdown(node.path, next, patch.body ?? node.content);
    return this.readIntent(node.path);
  }

  linkIntent(ref: string, relation: string, target: string): IntentNode {
    return this.connectNodes(ref, target, relation) as IntentNode;
  }

  getIntentTree(rootRef?: string): {
    readonly root: IntentNode | null;
    readonly nodes: readonly {
      slug: string;
      title: string;
      status: string;
      priority: string;
      relation: string;
    }[];
  } {
    const intents = this.listIntents();
    const root = rootRef ? this.getIntent(rootRef) : intents[0] ?? null;
    if (!root) {
      return { root: null, nodes: [] };
    }

    const nodes = intents
      .filter((intent) =>
        intent.slug === root.slug ||
        intent.connections.some((connection) => sameTarget(connection.target, root.slug)) ||
        root.connections.some((connection) => sameTarget(connection.target, intent.slug)),
      )
      .map((intent) => ({
        slug: intent.slug,
        title: intent.title,
        status: intent.status,
        priority: intent.priority,
        relation: relationToRoot(intent, root),
      }));

    return { root, nodes };
  }

  getIntentRuntime(ref: string): {
    readonly intent: IntentNode;
    readonly linkedExecutions: readonly ExecutionNode[];
    readonly linkedCanon: readonly CanonNode[];
    readonly linkedNodes: readonly MarkdownNode[];
  } {
    const intent = this.requireIntent(ref);
    const executions = this.listExecutions().filter((execution) =>
      execution.connections.some((connection) => sameTarget(connection.target, intent.slug)) ||
      sameTarget(getString(execution.data, 'intent_slug') ?? '', intent.slug),
    );
    const canon = this.listCanonDocs().filter((node) =>
      intent.connections.some((connection) => sameTarget(connection.target, node.id) || sameTarget(connection.target, node.relPath)),
    );
    const linkedNodes = intent.connections
      .map((connection) => this.findNode(connection.target))
      .filter((node): node is MarkdownNode => node !== null);

    return {
      intent,
      linkedExecutions: executions,
      linkedCanon: canon,
      linkedNodes,
    };
  }

  listExecutions(): ExecutionNode[] {
    return this.readExecutionFiles()
      .map((path) => this.readExecution(path))
      .sort((a, b) => b.id.localeCompare(a.id));
  }

  getExecution(ref: string): ExecutionNode | null {
    const resolved = this.resolveNodePath(ref, ['executions']);
    if (!resolved) return null;
    return this.readExecution(resolved);
  }

  createExecution(input: CreateExecutionInput): ExecutionNode {
    const id = this.nextExecutionId(input.title);
    const path = join(executionsRoot(), id, 'README.md');
    const now = isoNowDate();
    const connections = input.intentSlug
      ? [{ target: `[[intents/${normalizeIntentSlug(input.intentSlug)}]]`, relation: 'implements' }]
      : [];
    const data: Record<string, unknown> = {
      id,
      type: 'execution',
      layer: 'executions',
      title: input.title,
      status: 'active',
      created: now,
      updated: now,
      connections,
      tags: ['execution'],
    };
    if (input.objective) data.objective = input.objective;
    if (input.intentSlug) data.intent_slug = normalizeIntentSlug(input.intentSlug);
    this.writeMarkdown(path, data, input.body ?? `# ${id} — ${input.title}\n`);
    return this.readExecution(path);
  }

  completeExecution(ref: string, summary?: string): ExecutionNode {
    const node = this.requireNode(ref, ['executions']);
    const next = { ...node.data };
    next.status = 'completed';
    next.completed_at = isoNowDate();
    next.updated = isoNowDate();
    const content = summary
      ? `${node.content.trim()}\n\n## Completion Summary\n\n${summary}\n`
      : node.content;
    this.writeMarkdown(node.path, next, content);
    return this.readExecution(node.path);
  }

  checkpointExecution(ref: string, label: string, note?: string): ExecutionNode {
    const node = this.requireNode(ref, ['executions']);
    const next = { ...node.data };
    next.updated = isoNowDate();
    const block = `\n## Checkpoint — ${label}\n\n${note ?? 'Progress checkpoint recorded via ema exec checkpoint.'}\n`;
    this.writeMarkdown(node.path, next, `${node.content.trimEnd()}${block}`);
    return this.readExecution(node.path);
  }

  listProposals(): ProposalNode[] {
    return this.readProposalFiles()
      .map((path) => this.readProposal(path))
      .sort((a, b) => b.id.localeCompare(a.id));
  }

  getProposal(ref: string): ProposalNode | null {
    const resolved = this.resolveNodePath(ref, ['proposals']);
    if (!resolved) return null;
    return this.readProposal(resolved);
  }

  createProposal(input: CreateProposalInput): ProposalNode {
    const id = this.nextProposalId(input.title);
    const path = join(this.proposalsRoot(), id, 'README.md');
    const now = isoNowDate();
    const intentRef = input.intentRef ? normalizeIntentSlug(input.intentRef) : '';
    const connections = intentRef
      ? [{ target: `[[intents/${intentRef}]]`, relation: 'derived_from' }]
      : [];
    const data: Record<string, unknown> = {
      id,
      type: 'proposal',
      layer: 'proposals',
      title: input.title,
      status: 'draft',
      created: now,
      updated: now,
      intent_ref: intentRef,
      revision: 1,
      author: input.actor ?? 'ema-cli',
      connections,
      tags: ['proposal'],
    };
    if (input.summary) data.summary = input.summary;
    this.writeMarkdown(path, data, input.body ?? `# ${id} — ${input.title}\n`);
    return this.readProposal(path);
  }

  updateProposalStatus(ref: string, status: string, detail?: string): ProposalNode {
    const node = this.requireNode(ref, ['proposals']);
    const next = { ...node.data };
    next.status = status;
    next.updated = isoNowDate();
    const content = detail
      ? `${node.content.trimEnd()}\n\n## ${status}\n\n${detail}\n`
      : node.content;
    this.writeMarkdown(node.path, next, content);
    return this.readProposal(node.path);
  }

  reviseProposal(ref: string, title?: string, summary?: string): ProposalNode {
    const node = this.requireNode(ref, ['proposals']);
    const next = { ...node.data };
    if (title) next.title = title;
    if (summary) next.summary = summary;
    next.status = 'revised';
    next.updated = isoNowDate();
    next.revision = typeof next.revision === 'number' ? next.revision + 1 : 2;
    this.writeMarkdown(node.path, next, node.content);
    return this.readProposal(node.path);
  }

  listCanonDocs(): CanonNode[] {
    return [
      ...this.readMarkdownTree(canonSpecsRoot()),
      ...this.readMarkdownTree(canonDecisionsRoot()),
    ]
      .map((path) => this.readCanon(path))
      .sort((a, b) => a.relPath.localeCompare(b.relPath));
  }

  getCanonDoc(ref: string): CanonNode | null {
    const direct = this.resolveNodePath(ref, ['canon']);
    if (direct) return this.readCanon(direct);

    const cleaned = stripWikiRef(ref);
    const docs = this.listCanonDocs();
    return docs.find((doc) =>
      doc.id === cleaned ||
      doc.slug === cleaned ||
      doc.relPath === cleaned ||
      doc.relPath === `${cleaned}.md` ||
      doc.relPath.endsWith(`/${cleaned}.md`),
    ) ?? null;
  }

  writeCanonDoc(relPath: string, title: string | undefined, body: string): CanonNode {
    const normalised = relPath.endsWith('.md') ? relPath : `${relPath}.md`;
    const clean = normalised.replace(/^\/+/, '');
    const absPath = join(this.genesisRoot, clean.startsWith('canon/') ? clean : join('canon', clean));
    const existing = existsSync(absPath) ? this.readCanon(absPath) : null;
    const nextData: Record<string, unknown> = existing ? { ...existing.data } : {
      id: slugToUpperId(clean),
      type: 'canon',
      layer: 'canon',
      status: 'active',
      created: isoNowDate(),
      updated: isoNowDate(),
      author: 'ema-cli',
      tags: ['canon'],
    };
    if (title) nextData.title = title;
    nextData.updated = isoNowDate();
    this.writeMarkdown(absPath, nextData, body);
    return this.readCanon(absPath);
  }

  searchCanon(query: string): {
    readonly ref: string;
    readonly line: number;
    readonly text: string;
  }[] {
    return runRipgrep(query, [join(this.genesisRoot, 'canon')], { hidden: true, maxCount: 200 })
      .map((hit) => ({
        ref: relative(this.genesisRoot, hit.path),
        line: hit.line,
        text: hit.text,
      }));
  }

  graphLayers(): {
    readonly layer: string;
    readonly nodes: number;
  }[] {
    const counts = new Map<string, number>();
    const roots = ['intents', 'executions', 'canon', 'research', 'proposals', 'dumps'] as const;
    for (const layer of roots) {
      const dir = join(this.genesisRoot, layer);
      if (!existsSync(dir)) continue;
      counts.set(layer, this.readMarkdownTree(dir).length);
    }
    return [...counts.entries()].map(([layer, nodes]) => ({ layer, nodes }));
  }

  graphExport(): GraphExport {
    const nodes = this.allGraphNodes();
    const edges: GraphEdge[] = [];
    for (const node of nodes) {
      for (const connection of node.connections) {
        edges.push({
          from: node.id,
          relation: connection.relation,
          to: stripWikiRef(connection.target),
        });
      }
    }
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        title: node.title,
        type: node.type,
        layer: node.layer,
        ref: node.relPath,
      })),
      edges,
    };
  }

  traverseGraph(startRef: string, depth = 2): {
    readonly nodes: readonly {
      id: string;
      title: string;
      depth: number;
      ref: string;
    }[];
    readonly edges: readonly GraphEdge[];
  } {
    const start = this.findNode(startRef);
    if (!start) {
      throw new Error(`graph_node_not_found ${startRef}`);
    }

    const all = this.allGraphNodes();
    const byKey = new Map<string, MarkdownNode>();
    for (const node of all) {
      byKey.set(node.id, node);
      byKey.set(node.slug, node);
      byKey.set(node.relPath, node);
    }

    const queue: Array<{ node: MarkdownNode; depth: number }> = [{ node: start, depth: 0 }];
    const seen = new Set<string>();
    const nodes: Array<{ id: string; title: string; depth: number; ref: string }> = [];
    const edges: GraphEdge[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (seen.has(current.node.id) || current.depth > depth) continue;
      seen.add(current.node.id);
      nodes.push({
        id: current.node.id,
        title: current.node.title,
        depth: current.depth,
        ref: current.node.relPath,
      });

      for (const connection of current.node.connections) {
        const targetKey = stripWikiRef(connection.target);
        const target = byKey.get(targetKey) ?? byKey.get(basename(targetKey));
        edges.push({
          from: current.node.id,
          relation: connection.relation,
          to: targetKey,
        });
        if (target && current.depth < depth) {
          queue.push({ node: target, depth: current.depth + 1 });
        }
      }
    }

    return { nodes, edges };
  }

  connectNodes(sourceRef: string, targetRef: string, relation: string): MarkdownNode {
    const source = this.requireNode(sourceRef);
    const next = { ...source.data };
    const current = normaliseConnections(next.connections);
    const target = this.findNode(targetRef);
    const targetValue = target ? `[[${target.relPath.replace(/\.md$/u, '')}]]` : targetRef;
    if (!current.some((connection) => connection.relation === relation && sameTarget(connection.target, targetValue))) {
      current.push({ relation, target: targetValue });
    }
    next.connections = current;
    next.updated = isoNowDate();
    this.writeMarkdown(source.path, next, source.content);
    return this.readAnyNode(source.path);
  }

  disconnectNodes(sourceRef: string, targetRef: string, relation?: string): MarkdownNode {
    const source = this.requireNode(sourceRef);
    const next = { ...source.data };
    next.connections = normaliseConnections(next.connections).filter((connection) => {
      if (!sameTarget(connection.target, targetRef)) return true;
      if (relation && connection.relation !== relation) return true;
      return false;
    });
    next.updated = isoNowDate();
    this.writeMarkdown(source.path, next, source.content);
    return this.readAnyNode(source.path);
  }

  queueNext(): IntentNode | null {
    return this.listIntents()
      .filter((intent) => intent.status === 'active' || intent.status === 'draft')
      .sort((a, b) => byPriority(a.priority, b.priority) || a.slug.localeCompare(b.slug))[0] ?? null;
  }

  queueSuggest(): {
    readonly intents: readonly IntentNode[];
    readonly gacs: readonly IntentNode[];
  } {
    const intents = this.listIntents()
      .filter((intent) => intent.status === 'draft' || intent.status === 'active')
      .slice(0, 5);
    const gacs = this.listGacCards()
      .filter((card) => card.status === 'pending' || card.status === 'active')
      .slice(0, 5);
    return { intents, gacs };
  }

  queueBacklog(): IntentNode[] {
    return this.listIntents().filter((intent) =>
      intent.status === 'draft' || intent.status === 'active' || intent.status === 'blocked',
    );
  }

  listGacCards(): IntentNode[] {
    return this.listIntents().filter((intent) => intent.type === 'gac_card' || intent.slug.startsWith('GAC-'));
  }

  answerGac(ref: string, selected: string | undefined, freeform: string | undefined, actor: string): IntentNode {
    const node = this.requireIntent(ref);
    const next = { ...node.data };
    next.status = 'answered';
    next.answered_at = isoNowDate();
    next.answered_by = actor;
    if (selected) next.selected = selected;
    if (freeform) next.freeform = freeform;
    next.updated = isoNowDate();
    this.writeMarkdown(node.path, next, node.content);
    return this.readIntent(node.path);
  }

  deferGac(ref: string, actor: string, reason: string): IntentNode {
    const node = this.requireIntent(ref);
    const next = { ...node.data };
    next.status = 'deferred';
    next.updated = isoNowDate();
    const content = `${node.content.trimEnd()}\n\n## Deferred by ${actor}\n\n${reason}\n`;
    this.writeMarkdown(node.path, next, content);
    return this.readIntent(node.path);
  }

  listBlockers(): MarkdownNode[] {
    return this.allGraphNodes().filter((node) => node.id.startsWith('BLOCK-'));
  }

  listAspirations(): MarkdownNode[] {
    return this.allGraphNodes().filter((node) => node.id.startsWith('ASP-'));
  }

  createDump(text: string): DumpNode {
    const root = this.dumpsRoot();
    const id = `DUMP-${compactTimestamp()}`;
    const path = join(root, `${id}.md`);
    const data: Record<string, unknown> = {
      id,
      type: 'brain_dump',
      layer: 'dumps',
      title: text.slice(0, 72),
      status: 'captured',
      created: isoNowDate(),
      updated: isoNowDate(),
      author: 'ema-cli',
      tags: ['dump'],
    };
    this.writeMarkdown(path, data, text);
    return this.readDump(path);
  }

  listDumps(): DumpNode[] {
    return this.readMarkdownTree(this.dumpsRoot()).map((path) => this.readDump(path));
  }

  promoteDump(ref: string): IntentNode {
    const dump = this.findDump(ref);
    if (!dump) {
      throw new Error(`dump_not_found ${ref}`);
    }
    const lines = dump.content.trim().split('\n');
    return this.createIntent({
      title: lines[0] || dump.title || dump.id,
      body: `# Draft intent from ${dump.id}\n\n${dump.content}\n`,
      kind: 'new-work',
      status: 'draft',
      priority: 'medium',
    });
  }

  vaultStatus(): {
    readonly root: string;
    readonly exists: boolean;
    readonly markdownFiles: number;
  } {
    const root = this.vaultRoot();
    if (!root) {
      return { root: join(homedir(), '.local/share/ema/vault'), exists: false, markdownFiles: 0 };
    }
    return {
      root,
      exists: true,
      markdownFiles: this.readMarkdownTree(root).length,
    };
  }

  pipeCatalogFallback(): {
    readonly triggers: number;
    readonly actions: number;
    readonly transforms: number;
  } {
    const registryPath = join(this.repoRoot, 'services/core/pipes/registry.ts');
    const raw = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : '';
    return {
      triggers: countLiteral(raw, 'eventType:'),
      actions: countLiteral(raw, 'action('),
      transforms: countLiteral(raw, 'transform('),
    };
  }

  agentConfigs(): AgentConfigSummary[] {
    const candidates = [
      { agent: 'claude', path: join(homedir(), '.claude') },
      { agent: 'codex', path: join(homedir(), '.codex') },
      { agent: 'cursor', path: join(homedir(), '.cursor') },
      { agent: 'superpowers', path: join(homedir(), '.superpowers') },
      { agent: 'superman', path: join(homedir(), '.superman') },
      { agent: 'windsurf', path: join(homedir(), '.windsurf') },
      { agent: 'claude', path: join(this.repoRoot, '.claude') },
      { agent: 'superpowers', path: join(this.repoRoot, '.superpowers') },
      { agent: 'superman', path: join(this.repoRoot, '.superman') },
    ];

    return candidates
      .filter((candidate) => existsSync(candidate.path))
      .map((candidate) => this.summariseAgentConfig(candidate.agent, candidate.path));
  }

  parseAgentTimeline(agentFilter?: string): TimelineEntry[] {
    const summaries = this.agentConfigs().filter((summary) => !agentFilter || summary.agent === agentFilter);
    const entries: TimelineEntry[] = [];

    for (const summary of summaries) {
      if (summary.agent === 'codex') {
        entries.push(...this.parseCodexSessions(summary.path));
      } else if (summary.agent === 'claude') {
        entries.push(...this.parseClaudeSessions(summary.path));
      }
    }

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  backfeedFromTimeline(agentFilter?: string): {
    readonly timeline: readonly TimelineEntry[];
    readonly proposals: readonly BackfeedProposal[];
  } {
    const timeline = this.parseAgentTimeline(agentFilter).slice(0, 100);
    const proposals = timeline
      .filter((entry) => entry.openingPrompt.length > 20)
      .slice(0, 10)
      .map((entry) => ({
        title: toTitle(entry.openingPrompt),
        summary: entry.openingPrompt,
        sourceSession: entry.sessionPath,
      }));
    return { timeline, proposals };
  }

  findNode(ref: string): MarkdownNode | null {
    const direct = this.resolveNodePath(ref);
    if (direct) return this.readAnyNode(direct);

    const cleaned = stripWikiRef(ref);
    return this.allGraphNodes().find((node) =>
      node.id === cleaned ||
      node.slug === cleaned ||
      node.relPath === cleaned ||
      node.relPath === `${cleaned}.md` ||
      node.relPath.replace(/\.md$/u, '') === cleaned,
    ) ?? null;
  }

  private allGraphNodes(): MarkdownNode[] {
    return [
      ...this.listIntents(),
      ...this.listExecutions(),
      ...this.listProposals(),
      ...this.listCanonDocs(),
      ...this.listDumps(),
    ];
  }

  private summariseAgentConfig(agent: string, path: string): AgentConfigSummary {
    const timestamps: string[] = [];
    const projects = new Set<string>();
    let sessions = 0;

    for (const file of this.walkFiles(path)) {
      const lower = file.toLowerCase();
      const isSession = lower.endsWith('.jsonl') || lower.endsWith('.json') || lower.endsWith('.md');
      if (!isSession) continue;
      sessions += 1;
      const stamp = fileTimestamp(file);
      if (stamp) timestamps.push(stamp);
      const project = projectFromPath(file);
      if (project) projects.add(project);
    }

    timestamps.sort();
    return {
      agent,
      path,
      sessions,
      projects: [...projects],
      firstActivity: timestamps[0] ?? '',
      lastActivity: timestamps[timestamps.length - 1] ?? '',
    };
  }

  private parseCodexSessions(root: string): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    for (const file of this.walkFiles(root)) {
      if (!file.endsWith('.jsonl')) continue;
      const raw = safeRead(file);
      if (!raw) continue;
      const lines = raw.split('\n').filter(Boolean);
      const opening = lines
        .map((line) => safeJson(line))
        .find((row) => {
          if (!isRecord(row)) return false;
          return extractRole(row) === 'user';
        });
      if (!opening || !isRecord(opening)) continue;
      const prompt = extractText(opening);
      if (!prompt) continue;
      entries.push({
        timestamp: fileTimestamp(file) || '',
        agent: 'codex',
        sessionPath: file,
        project: projectFromPath(file),
        messageCount: lines.length,
        openingPrompt: prompt,
      });
    }
    return entries;
  }

  private parseClaudeSessions(root: string): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    for (const file of this.walkFiles(root)) {
      if (!file.endsWith('.jsonl')) continue;
      const raw = safeRead(file);
      if (!raw) continue;
      const lines = raw.split('\n').filter(Boolean);
      const opening = lines
        .map((line) => safeJson(line))
        .find((row) => {
          if (!isRecord(row)) return false;
          return extractRole(row) === 'user';
        });
      if (!opening || !isRecord(opening)) continue;
      const prompt = extractText(opening);
      if (!prompt) continue;
      entries.push({
        timestamp: fileTimestamp(file) || '',
        agent: 'claude',
        sessionPath: file,
        project: projectFromPath(file),
        messageCount: lines.length,
        openingPrompt: prompt,
      });
    }
    return entries;
  }

  private requireIntent(ref: string): IntentNode {
    return this.readIntent(this.requirePath(ref, ['intents']));
  }

  private requireNode(ref: string, roots?: readonly string[]): MarkdownNode {
    return this.readAnyNode(this.requirePath(ref, roots));
  }

  private requirePath(ref: string, roots?: readonly string[]): string {
    const resolved = this.resolveNodePath(ref, roots);
    if (!resolved) throw new Error(`node_not_found ${ref}`);
    return resolved;
  }

  private resolveNodePath(ref: string, roots?: readonly string[]): string | null {
    const cleaned = stripWikiRef(ref);
    const candidates: string[] = [];

    if (cleaned.startsWith('/')) {
      candidates.push(cleaned);
    } else {
      candidates.push(join(this.genesisRoot, cleaned));
      candidates.push(join(this.genesisRoot, `${cleaned}.md`));
      const scopeRoots = roots ?? ['intents', 'executions', 'canon', 'proposals', 'dumps'];
      for (const root of scopeRoots) {
        if (root === 'intents') {
          candidates.push(join(intentsRoot(), cleaned, 'README.md'));
          candidates.push(join(intentsRoot(), `${cleaned}.md`));
        } else if (root === 'executions') {
          candidates.push(join(executionsRoot(), cleaned, 'README.md'));
          candidates.push(join(executionsRoot(), `${cleaned}.md`));
        } else if (root === 'proposals') {
          candidates.push(join(this.proposalsRoot(), cleaned, 'README.md'));
          candidates.push(join(this.proposalsRoot(), `${cleaned}.md`));
        } else if (root === 'dumps') {
          candidates.push(join(this.dumpsRoot(), cleaned));
          candidates.push(join(this.dumpsRoot(), `${cleaned}.md`));
        } else if (root === 'canon') {
          candidates.push(join(this.genesisRoot, 'canon', cleaned));
          candidates.push(join(this.genesisRoot, 'canon', `${cleaned}.md`));
          candidates.push(join(canonSpecsRoot(), `${cleaned}.md`));
          candidates.push(join(canonDecisionsRoot(), `${cleaned}.md`));
        }
      }
    }

    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  }

  private proposalsRoot(): string {
    const root = join(this.genesisRoot, 'proposals');
    mkdirSync(root, { recursive: true });
    return root;
  }

  private dumpsRoot(): string {
    const root = join(this.genesisRoot, 'dumps');
    mkdirSync(root, { recursive: true });
    return root;
  }

  private readIntent(path: string): IntentNode {
    const node = this.readAnyNode(path);
    return {
      ...node,
      priority: getString(node.data, 'priority') ?? '',
      phase: getString(node.data, 'phase') ?? '',
      kind: getString(node.data, 'kind') ?? '',
      tags: getStringArray(node.data, 'tags'),
      scope: toStringArray(node.data.scope),
    };
  }

  private readExecution(path: string): ExecutionNode {
    const node = this.readAnyNode(path);
    return {
      ...node,
      completedAt: getString(node.data, 'completed_at') ?? '',
    };
  }

  private readProposal(path: string): ProposalNode {
    const node = this.readAnyNode(path);
    return {
      ...node,
      intentRef: getString(node.data, 'intent_ref') ?? '',
      revision: typeof node.data.revision === 'number' ? node.data.revision : 1,
    };
  }

  private readCanon(path: string): CanonNode {
    const node = this.readAnyNode(path);
    return {
      ...node,
      subtype: getString(node.data, 'subtype') ?? '',
    };
  }

  private readDump(path: string): DumpNode {
    return this.readAnyNode(path);
  }

  private findDump(ref: string): DumpNode | null {
    const resolved = this.resolveNodePath(ref, ['dumps']);
    if (!resolved) return null;
    return this.readDump(resolved);
  }

  private readAnyNode(path: string): MarkdownNode {
    const parsed = parseFrontmatter(path);
    const relPath = relative(this.genesisRoot, path).split('\\').join('/');
    const slug = basename(path, extname(path)) === 'README'
      ? basename(dirname(path))
      : basename(path, extname(path));
    return {
      id: getString(parsed.data, 'id') ?? slug,
      slug,
      title: getString(parsed.data, 'title') ?? slug,
      status: getString(parsed.data, 'status') ?? '',
      type: getString(parsed.data, 'type') ?? '',
      layer: getString(parsed.data, 'layer') ?? layerFromPath(relPath),
      path,
      relPath,
      content: parsed.content,
      data: parsed.data,
      connections: normaliseConnections(parsed.data.connections),
    };
  }

  private readMarkdownTree(root: string): string[] {
    if (!existsSync(root)) return [];
    const results: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const abs = join(root, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.readMarkdownTree(abs));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(abs);
      }
    }
    return results;
  }

  private readIntentFiles(): string[] {
    const root = intentsRoot();
    if (!existsSync(root)) return [];
    const files: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const abs = join(root, entry.name);
      if (entry.isDirectory()) {
        const readme = join(abs, 'README.md');
        if (existsSync(readme)) files.push(readme);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(abs);
      }
    }
    return files;
  }

  private readExecutionFiles(): string[] {
    const root = executionsRoot();
    if (!existsSync(root)) return [];
    const files: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const abs = join(root, entry.name);
      if (entry.isDirectory()) {
        const readme = join(abs, 'README.md');
        if (existsSync(readme)) files.push(readme);
      }
    }
    return files;
  }

  private readProposalFiles(): string[] {
    return this.readMarkdownTree(this.proposalsRoot()).filter((path) => path.endsWith('README.md'));
  }

  private nextExecutionId(title: string): string {
    const ids = this.listExecutions()
      .map((node) => node.id.match(/^EXE-(\d{3,})/u)?.[1])
      .filter((value): value is string => value !== undefined)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const next = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
    return `EXE-${String(next).padStart(3, '0')}-${slugify(title)}`;
  }

  private nextProposalId(title: string): string {
    const ids = this.listProposals()
      .map((node) => node.id.match(/^PRO-(\d{3,})/u)?.[1])
      .filter((value): value is string => value !== undefined)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const next = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
    return `PRO-${String(next).padStart(3, '0')}-${slugify(title)}`;
  }

  private writeMarkdown(path: string, data: Record<string, unknown>, content: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const body = matter.stringify(content.trimEnd().length > 0 ? content.trimEnd() : '', data);
    writeFileSync(path, `${body}\n`, 'utf8');
  }

  private walkFiles(root: string): string[] {
    if (!existsSync(root)) return [];
    const files: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.codex' && entry.name !== '.claude') continue;
      const abs = join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.walkFiles(abs));
      } else if (entry.isFile()) {
        files.push(abs);
      }
    }
    return files;
  }

  private vaultRoot(): string | null {
    const envRoot = process.env.EMA_VAULT_ROOT;
    if (envRoot && existsSync(envRoot)) return envRoot;
    const candidate = join(homedir(), '.local/share/ema/vault');
    return existsSync(candidate) ? candidate : null;
  }
}

function layerFromPath(relPath: string): string {
  return relPath.split('/')[0] ?? '';
}

function normaliseConnections(value: unknown): Connection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const relation = typeof entry.relation === 'string'
        ? entry.relation
        : typeof entry.type === 'string'
          ? entry.type
          : '';
      const target = typeof entry.target === 'string' ? entry.target : '';
      if (!relation || !target) return null;
      return { relation, target };
    })
    .filter((entry): entry is Connection => entry !== null);
}

function isoNow(): string {
  return new Date().toISOString();
}

function isoNowDate(): string {
  return isoNow().slice(0, 10);
}

function compactTimestamp(): string {
  return isoNow().replace(/[-:TZ.]/gu, '').slice(0, 14);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64) || 'untitled';
}

function normalizeIntentSlug(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
  if (cleaned.startsWith('INT-') || cleaned.startsWith('GAC-') || cleaned.startsWith('BLOCK-')) {
    return cleaned;
  }
  return `INT-${cleaned}`;
}

function relationToRoot(intent: IntentNode, root: IntentNode): string {
  if (intent.slug === root.slug) return 'self';
  const toRoot = intent.connections.find((connection) => sameTarget(connection.target, root.slug));
  if (toRoot) return toRoot.relation;
  const fromRoot = root.connections.find((connection) => sameTarget(connection.target, intent.slug));
  return fromRoot?.relation ?? '';
}

function sameTarget(left: string, right: string): boolean {
  return stripWikiRef(left) === stripWikiRef(right);
}

function stripWikiRef(value: string): string {
  return value
    .trim()
    .replace(/^\[\[/u, '')
    .replace(/\]\]$/u, '')
    .replace(/\/README$/u, '');
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function byPriority(left: string, right: string): number {
  const order = ['critical', 'high', 'medium', 'low', ''];
  return order.indexOf(left) - order.indexOf(right);
}

function slugToUpperId(value: string): string {
  return value
    .replace(/\.md$/u, '')
    .replace(/[\\/]+/gu, '-')
    .replace(/[^a-zA-Z0-9-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toUpperCase();
}

function countLiteral(raw: string, token: string): number {
  return raw.length === 0 ? 0 : raw.split(token).length - 1;
}

function fileTimestamp(path: string): string {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return '';
  }
}

function projectFromPath(path: string): string {
  const parts = path.split('/');
  const projectsIndex = parts.indexOf('projects');
  if (projectsIndex >= 0 && parts[projectsIndex + 1]) {
    return parts[projectsIndex + 1] ?? '';
  }
  return basename(dirname(path));
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractRole(row: Record<string, unknown>): string {
  if (typeof row.role === 'string') return row.role;
  const message = row.message;
  if (isRecord(message) && typeof message.role === 'string') {
    return message.role;
  }
  return '';
}

function extractText(row: Record<string, unknown>): string {
  if (typeof row.text === 'string') return row.text;
  const message = row.message;
  if (isRecord(message)) {
    if (typeof message.content === 'string') return message.content;
    const content = message.content;
    if (Array.isArray(content)) {
      const text = content
        .map((entry) => {
          if (!isRecord(entry)) return '';
          if (typeof entry.text === 'string') return entry.text;
          return '';
        })
        .filter(Boolean)
        .join('\n');
      if (text) return text;
    }
  }
  if (typeof row.content === 'string') return row.content;
  return '';
}

function toTitle(prompt: string): string {
  return (prompt
    .split('\n')[0] ?? '')
    .replace(/^#+\s*/u, '')
    .trim()
    .slice(0, 96) || 'Imported session proposal';
}
