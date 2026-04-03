# EMA Feature Specification

Comprehensive spec for all EMA features — what they do, why they matter, how they work, current status, and next steps.

---

## 1. Execution Fabric

**Brain Dump -> Execution -> Delegation -> Result Harvest**

### What It Does

Transforms raw thoughts into tracked, delegated, completed work. The pipeline:

1. **Capture** — User drops anything into Brain Dump (thought, link, idea, task). Zero friction — just a text field.
2. **Triage** — Items are processed: converted to tasks, sent to proposals, archived, or delegated to agents.
3. **Execution** — Tasks live in a Kanban board with status transitions (`backlog -> todo -> in_progress -> review -> done`). Tasks link to projects, goals, responsibilities, and parent/child hierarchies.
4. **Delegation** — Approved proposals or tasks can be dispatched to AI agents. Each agent has its own supervisor, memory, and channel connections. `AgentWorker` handles Claude CLI invocation and tool execution.
5. **Result Harvest** — Agent runs are tracked (`agent_runs` schema: status, duration_ms, exit_code, output_path). Session watcher imports Claude Code session data (tokens, files touched, tool calls) from `~/.claude/projects/**/*.jsonl`.

### Why It Matters

Without this, EMA is just a collection of apps. The fabric connects thinking to doing. Brain dumps that never become tasks are wasted. Tasks without delegation don't scale. Delegation without harvest loses accountability.

### How It Works

**Backend:**
- `Ema.BrainDump` — CRUD for inbox items. Each item has `source`, `processed` flag, optional `project_id`. Processing sets `action` field (e.g., "task", "proposal", "archive").
- `Ema.Tasks` — Full task management with `Task` (title, status, priority, effort, due_date, recurrence, metadata) and `Comment` schemas. Supports parent/child via `parent_id`, blocking relationships via `tasks_blocked_by` join table.
- `Ema.Agents.AgentWorker` — GenServer per agent. `send_message/2` builds prompt with personality + conversation history, calls Claude CLI, executes tool calls, broadcasts responses on PubSub.
- `Ema.Agents.AgentMemory` — Compresses conversation history when >20 messages to keep context windows manageable.
- `Ema.ClaudeSessions.SessionWatcher` — Polls JSONL files every 30s, parses with `SessionParser` (extracts tool_calls, files_touched, tokens), links sessions to projects via `SessionLinker`.
- `Ema.Executions.Dispatcher` — Supervised execution tracking with `Execution` and `AgentSession` schemas.

**Frontend:**
- `BrainDumpApp` — Capture input + inbox queue. REST load on mount, WebSocket sync via `brain_dump:queue` channel.
- `TasksApp` — Kanban board with `TaskCard`, `TaskForm`, `TaskDetail`. Channel: `tasks:lobby` or `tasks:{projectId}`.
- `AgentsApp` — Agent grid, chat interface, conversation history. Channel: `agents:lobby` + `agent_chat:{id}`.

**Pipes Integration:**
- `Ema.Pipes.EventBus` broadcasts domain events (e.g., `tasks:created`, `brain_dump:processed`).
- Stock pipe: "Approved Proposal -> Task" converts approved proposals into actionable tasks automatically.

### Current Status

- **Working:** Brain dump capture/process, task CRUD with status transitions, agent chat via webchat bridge, session watching/parsing, pipe-driven automation.
- **Partial:** Agent tool execution (only `brain_dump:create_item` implemented). Execution dispatcher scaffolded but not fully integrated.
- **Stub:** Discord/Telegram channel adapters (need deps).

### Next Steps

- Implement remaining agent tools (task creation, vault writes, proposal actions)
- Wire execution dispatcher into agent runs for full lifecycle tracking
- Add harvester GenServers (Git, Session, Vault, Usage, BrainDump) — designed in `Ema.Harvesters` but not implemented
- Build "result review" UI showing agent work products with approve/reject

---

## 2. Workflow Observatory

**Genealogy DAG, Intent Logging, Friction Map, Budget Awareness**

### What It Does

Provides visibility into how work flows through EMA — where ideas come from, what they become, where things get stuck, and what they cost.

1. **Genealogy DAG** — Proposals track `parent_proposal_id` and `seed_id`. The Combiner creates cross-pollination seeds from related proposals. This forms a directed acyclic graph showing how ideas evolve, fork, and merge.
2. **Intent Logging** — `IntentMap` maintains a 5-level hierarchy: Product -> Flow -> Action -> System -> Implementation. Each `IntentNode` links to tasks and projects, creating a traceable path from high-level goals to code.
3. **Friction Map** — `GapInbox` scans 7 sources for friction: stale tasks, orphan vault notes, incomplete goals, missing docs, TODOs in code, unlinked proposals, idle responsibilities. `GapScanner` runs every 60 minutes.
4. **Budget Awareness** — `TokenTracker` records every API call (model, input/output tokens, cost). `CostForecaster` detects spikes (>2x daily average) and generates weekly digests. `TokenBudget` sets monthly limits with alert thresholds.

### Why It Matters

Execution without observation is blind. You can't improve what you can't see. The observatory answers: Where did this idea originate? Why is this project stalled? What's eating my API budget? Where are the gaps in my knowledge base?

### How It Works

**Genealogy:**
- `Ema.Proposals.Proposal` — `seed_id` (origin seed), `parent_proposal_id` (evolved from), `generation_log` (pipeline metadata).
- `Ema.ProposalEngine.Combiner` — Hourly scan clusters queued proposals by shared tags, creates new seeds that reference multiple parents.
- REST: `GET /api/proposals/:id/lineage` returns full ancestry chain.

**Intent Map:**
- `Ema.Intelligence.IntentMap` — `list_nodes/1`, `tree/1` (builds hierarchical structure), `create_edge/1` (typed relationships: depends-on, implements, etc.).
- `Ema.Intelligence.IntentNode` — Fields: level (0-4), label, description, linked_task_ids, project_id.
- `Ema.Intelligence.IntentEdge` — Typed edges between nodes.
- Channel: `intent:live` broadcasts node CRUD in real-time.
- Frontend: `IntentMapApp` with tree visualization, project filtering, zoom levels.

**Gap Detection:**
- `Ema.Intelligence.GapInbox` — `scan_all/0` runs 7 scanners: `scan_stale_tasks`, `scan_orphan_notes`, `scan_incomplete_goals`, plus TODO scanning, missing doc detection, unlinked proposal detection, idle responsibility detection.
- `Ema.Intelligence.Gap` — Schema: description, gap_type, severity (1-5), status, source, project_id.
- `Ema.Intelligence.GapScanner` — GenServer polling every 60 minutes, broadcasts gap counts to `gaps:live`.
- REST: `GET /api/gaps` with source/severity/project filters. `POST /api/gaps/:id/resolve`. `POST /api/gaps/:id/create_task`.

**Cost Tracking:**
- `Ema.Intelligence.TokenTracker` — GenServer recording `TokenEvent` entries. `calculate_cost/3` uses per-model pricing (opus: $15/$75 per 1M tokens, sonnet: $3/$15, haiku: $0.25/$1.25).
- `Ema.Intelligence.CostForecaster` — `check_spikes/0` compares today vs 7-day average. `weekly_digest/0` summarizes spend by model/agent.
- `Ema.Intelligence.TokenBudget` — Monthly budget with `alert_threshold` percentage.
- Frontend: `TokenMonitor` component with summary, history charts, forecast, budget management.

### Current Status

- **Working:** Intent map (full CRUD + tree + export), gap scanning (7 sources, real-time broadcast), token tracking with cost calculation, cost forecasting with spike detection.
- **Working:** Proposal lineage tracking (parent_proposal_id, seed_id).
- **Partial:** Genealogy DAG visualization exists as data but no dedicated graph UI — lineage is REST-only.

### Next Steps

- Build genealogy DAG visualization using `react-force-graph-2d` (installed but unused)
- Add friction heatmap overlay to project views showing gap density
- Wire cost alerts to notification system (currently broadcasts but no user-facing alerts)
- Add "why is this stalled?" analysis combining gap data + task staleness + responsibility health

---

## 3. Proposal Intelligence

**Validation Loop, Auto-Approve Safe Ones, Outcome Feedback**

### What It Does

An autonomous idea factory that generates, critiques, debates, scores, and queues proposals for human review. The pipeline ensures quality through multi-stage validation. Safe proposals can be auto-approved. Outcome tracking feeds back into future generation.

### Why It Matters

Good ideas die in backlogs. Bad ideas waste execution time. The proposal engine maintains a continuous stream of refined, debated, scored ideas — each one pre-vetted before a human ever sees it. Auto-approval for safe proposals reduces bottleneck. Outcome feedback creates a learning loop.

### How It Works

**Pipeline (5 stages, PubSub-linked via `proposals:pipeline`):**

1. **Scheduler** (`Ema.ProposalEngine.Scheduler`) — Ticks every 60s. Checks active seeds against their schedules. Dispatches matching seeds to Generator.

2. **Generator** (`Ema.ProposalEngine.Generator`) — Builds context-enriched prompt via `ContextManager` (injects project context, recent proposals, active tasks). Calls Claude CLI. Creates raw proposal with title, summary, body, risks, benefits. Broadcasts `{:proposals, :generated, proposal}`.

3. **Refiner** (`Ema.ProposalEngine.Refiner`) — Subscribes to `:generated`. Runs critique pass: sharpens body, identifies weak points, strengthens risks/benefits analysis. Broadcasts `{:proposals, :refined, proposal}`.

4. **Debater** (`Ema.ProposalEngine.Debater`) — Subscribes to `:refined`. Three-phase debate: steelman (strongest case for), red-team (strongest case against), synthesis (balanced verdict). Sets `confidence` score (0.0-1.0). Broadcasts `{:proposals, :debated, proposal}`.

5. **Scorer** (`Ema.ProposalEngine.Scorer`) — Scores on 4 dimensions: `codebase_coverage`, `architectural_coherence`, `impact`, `prompt_specificity`. Produces `idea_score` and `prompt_quality_score` (1-10 each). Detects duplicates via cosine similarity on embeddings (>0.85 threshold). Broadcasts `{:proposals, :scored, proposal}`.

6. **Tagger** (`Ema.ProposalEngine.Tagger`) — Subscribes to `:debated`. Auto-assigns tags via Claude haiku. Sets status to "queued". Broadcasts `{:proposals, :queued, proposal}`.

**User Actions:**
- **Approve** — Converts proposal to task (via stock pipe "Approved Proposal -> Task")
- **Redirect** — Generates 3 new seeds from the proposal's core idea, exploring different angles
- **Kill** — Logs pattern in `KillMemory` (Jaccard similarity on titles + tag overlap). Future similar proposals are flagged.

**Cross-Pollination:**
- `Ema.ProposalEngine.Combiner` — Hourly scan clusters queued proposals by shared tags. Creates cross-pollination seeds that synthesize related but distinct ideas.

**Context Injection:**
- `Ema.Claude.ContextManager` — `build_prompt/1` assembles: base prompt + project context doc (from `~/.local/share/ema/projects/{slug}/context.md`) + last 10 proposals + top 10 active tasks.

### Current Status

- **Working:** Full pipeline (Generator -> Refiner -> Debater -> Scorer -> Tagger) wired via PubSub. Scheduler dispatching seeds. KillMemory tracking patterns. Combiner cross-pollination. Context injection.
- **Working:** User actions (approve/redirect/kill) with pipe-driven task creation.
- **Not implemented:** Auto-approve for safe proposals (no confidence threshold automation). Outcome feedback loop (no tracking of whether approved proposals succeeded).

### Next Steps

- Add auto-approve threshold: proposals with confidence >0.85 AND idea_score >8 AND no high-severity risks get auto-approved
- Build outcome feedback: track task completion rates for proposal-sourced tasks, feed success/failure signals back into ContextManager prompts
- Add "proposal quality over time" dashboard showing pipeline health metrics
- Wire Combiner results to a dedicated "cross-pollination review" UI

---

## 4. Decision Memory

**Mine Vault/Discord, Link Decisions to Outcomes, Surface Precedents**

### What It Does

Captures decisions from multiple sources (conversations, vault notes, explicit logging), links them to their outcomes, and surfaces relevant precedents when similar decisions arise.

### Why It Matters

Decisions are the most valuable knowledge artifact — they encode context, tradeoffs, and judgment. Without decision memory, you repeat mistakes, re-debate settled questions, and lose the "why" behind architectural choices.

### How It Works

**Decision Capture:**
- `Ema.Decisions.Decision` — Ecto schema for explicit decision logging. REST CRUD at `/api/decisions`.
- `Ema.Intelligence.SessionMemory` — Extracts decision-type `MemoryFragment` from Claude sessions. `extract_fragments_for_session/1` identifies decisions, insights, code_changes, and blockers.
- `Ema.Intelligence.WikiSync` — `analyze/1` scans git commits for architectural decisions, suggests vault note updates.

**Vault Mining:**
- `Ema.SecondBrain.GraphBuilder` — Parses `[[wikilinks]]` with 9 typed edges: depends-on, implements, contradicts, blocks, enables, supersedes, part-of, related-to, references. Decision notes linked via these edges form a decision graph.
- `Ema.SecondBrain.VaultWatcher` — Polls vault every 5s. New/changed decision notes trigger graph rebuild.

**Context Injection:**
- `Ema.Intelligence.SessionMemory.context_for_project/1` — Returns relevant memory fragments for a project, including past decisions. Injected into new Claude sessions to prevent re-litigation.
- `Ema.Intelligence.SessionMemory.search_sessions/1` — Full-text search across session memory for precedent lookup.

**Git Integration:**
- `Ema.Intelligence.GitWatcher` — Polls repos every 60s, detects commits, extracts diffs. Triggers WikiSync analysis which identifies decisions embedded in commit messages and code changes.
- `Ema.Intelligence.WikiSyncAction` — Actions: `create_stub` (new module needs a note), `flag_outdated` (changed code invalidates existing note), `update_content` (new info should be added).

### Current Status

- **Working:** Decision schema with CRUD API. Session memory extraction (decisions, insights, blockers). WikiSync analyzing git commits for decision content. Vault graph with typed edges. Git watcher detecting commits.
- **Partial:** Session memory context injection exists but isn't automatically wired into all Claude calls. WikiSync actions are suggested but require manual application.
- **Not implemented:** Discord mining. Automatic precedent surfacing when similar decisions arise. Decision-to-outcome linking.

### Next Steps

- Add automatic precedent surfacing: when creating a new proposal or task, search decision memory for related past decisions and inject as context
- Build decision-outcome linking: connect decisions to downstream tasks/proposals and track whether outcomes matched expectations
- Wire WikiSync auto-apply for low-risk actions (create_stub, flag_outdated)
- Add Discord/Telegram message mining via channel adapters (blocked on nostrum/ex_gram deps)

---

## 5. Intent-Driven Analysis

**IntentMap <-> Superman, Flow-to-Code Swimlanes, Intent Search**

### What It Does

Maps high-level user intentions down to code-level implementation, creating a traceable path from "why" to "what." Integrates with Superman code intelligence for codebase awareness.

### Why It Matters

Code without intent documentation becomes unmaintainable. "What does this module do?" is easy — read the code. "Why does it exist?" requires intent context. This feature bridges the gap between product thinking and implementation reality.

### How It Works

**Intent Hierarchy (5 levels):**

| Level | Name | Example |
|-------|------|---------|
| 0 | Product | "Personal AI operating system" |
| 1 | Flow | "Proposal generation pipeline" |
| 2 | Action | "Refine raw proposals through critique" |
| 3 | System | "Refiner GenServer subscribes to PubSub" |
| 4 | Implementation | "Calls Claude CLI with critique prompt" |

**IntentMap Module:**
- `Ema.Intelligence.IntentMap` — Context module: `list_nodes/1` (with project filter), `tree/1` (builds hierarchical structure from level 0 down), `create_edge/1` (typed: depends-on, implements, enables, blocks).
- `Ema.Intelligence.IntentNode` — Schema: level (0-4), label, description, linked_task_ids (array), project_id. `level_name/1` maps integer to human-readable name.
- `Ema.Intelligence.IntentEdge` — Schema: source_id, target_id, relationship type.

**Superman Integration:**
- `Ema.Intelligence.SupermanClient` — HTTP client to Superman API at localhost:3000:
  - `index_repo/1` — Index a repository for code intelligence
  - `ask_codebase/2` — Natural language questions about code
  - `get_gaps/1` — Find gaps in code coverage/documentation
  - `get_flows/1` — Extract code flow diagrams
  - `apply_task/2` — Execute code modifications
  - `autonomous_run/1` — Run autonomous code improvement sessions
- REST: `/api/superman/*` endpoints wrap all Superman client methods.

**Frontend:**
- `IntentMapApp` — Tree visualization with project filtering, zoom levels, node selection. Real-time updates via `intent:live` channel.
- `CodeHealthDashboard` — Displays Superman code analysis results.

### Current Status

- **Working:** Full IntentMap CRUD with 5-level hierarchy. Tree construction and export to markdown. Real-time channel sync. Superman client with all HTTP methods.
- **Working:** Frontend tree visualization with project filtering.
- **Not implemented:** Flow-to-code swimlane visualization. Automatic intent-to-code linking (currently manual via linked_task_ids). Intent search across the hierarchy.

### Next Steps

- Build swimlane visualization: render intent levels as horizontal lanes, show how intents flow down to code
- Add automatic intent linking: when a task references code files, auto-link to relevant implementation-level intent nodes
- Implement intent search: full-text across all levels, returning the full path from product intent to implementation
- Wire Superman `get_flows` output into intent map as auto-generated System/Implementation level nodes

---

## 6. Autonomous Reasoning

**Auto Improvement Loop, Threat Model Automaton, Health Dashboard**

### What It Does

Background intelligence that monitors system health, identifies threats, learns from patterns, and proposes improvements — without being asked.

1. **Auto Improvement Loop** — The proposal engine runs continuously. Seeds fire on schedule. The pipeline generates, critiques, and queues improvements. Combiner cross-pollinates. KillMemory prevents recycling bad ideas.
2. **Threat Model Automaton** — `SecurityAuditor` calculates security posture score (0-100) from VM config, OpenClaw deployment health, SSH access, and known threat patterns.
3. **Health Dashboard** — Multiple monitors feed a real-time health picture:
   - `VmMonitor` — Pings agent-vm (192.168.122.10) every 30s. Checks SSH, OpenClaw status, Docker containers, latency.
   - `TrustScorer` — Recalculates agent reliability daily: completion rate (40%), latency (20%), error rate (20%), activity (20%).
   - `CostForecaster` — Detects cost spikes, generates weekly digests.
   - `GapScanner` — Scans for system gaps every 60 minutes.

### Why It Matters

A personal OS should think for you, not just react. Autonomous reasoning means EMA is always working in the background — surfacing ideas, catching threats, monitoring health, and learning what works.

### How It Works

**Auto Improvement:**
- Proposal engine pipeline runs as supervised OTP processes. Seeds have schedules (cron-like). Scheduler dispatches on time. Generator -> Refiner -> Debater -> Scorer -> Tagger runs without human intervention.
- `KillMemory` prevents repetition: killed proposals are indexed by title/tag pattern. New proposals are checked against this index (Jaccard similarity). Similar ones are flagged.
- `Combiner` creates novel seeds by clustering related queued proposals.

**Security:**
- `Ema.Intelligence.SecurityAuditor.audit/0` — Returns scored assessment:
  - VM accessibility (ping, SSH, latency)
  - OpenClaw deployment health
  - Container status
  - Known vulnerability patterns
- Frontend: `SecurityPanel` displays posture score with individual check details.

**Health Monitoring:**
- `Ema.Intelligence.VmMonitor` — GenServer state: `%{status, openclaw_up, ssh_up, latency_ms, containers}`. Broadcasts to `intelligence:vm`. REST: `/api/vm/health`, `/api/vm/containers`, `/api/vm/check`.
- `Ema.Intelligence.TrustScorer` — GenServer recalculating daily. Scoring formula: `0.4 * completion + 0.2 * latency + 0.2 * errors + 0.2 * activity`. Badge levels based on score ranges. Broadcasts to `intelligence:trust`.
- `Ema.Responsibilities.HealthCalculator` — Computes responsibility health (0.0-1.0) from task completion rates per responsibility.

**Evolution Engine:**
- `Ema.Evolution.Supervisor` — Conditional startup. `BehaviorRule` schema for learned patterns. REST: `/api/evolution/rules` with activate, rollback, version, scan, propose endpoints.

### Current Status

- **Working:** Proposal engine auto-improvement loop (full pipeline). VM health monitoring with real-time broadcast. Trust scoring with daily recalculation. Cost forecasting with spike detection. Gap scanning. Security auditor.
- **Working:** KillMemory pattern tracking. Combiner cross-pollination.
- **Partial:** Evolution engine has schema and API but limited rule learning. Health dashboard exists as individual panels, not unified view.

### Next Steps

- Build unified health dashboard aggregating VM health, trust scores, gap counts, cost trends, security posture into single view
- Wire evolution engine to actually learn from proposal outcomes (which proposals led to completed tasks?)
- Add proactive notifications: surface high-confidence proposals, alert on trust score drops, warn on budget threshold breach
- Implement threat model automation: periodic security scan that creates gaps for new vulnerabilities

---

## 7. Pattern Crystallizer

**Detect Patterns at 5+ Successes / 70%+, Propose Crystallization, Approval Queue**

### What It Does

Identifies recurring successful patterns across EMA's operation and proposes turning them into permanent automations (pipes), knowledge (vault notes), or practices (responsibilities).

### Why It Matters

Humans are bad at noticing their own patterns. When you've successfully handled the same type of task 5+ times with a consistent approach, that's a pattern worth crystallizing into a reusable automation or documented practice.

### How It Works

**Detection Sources:**
- `Ema.Pipes.PipeRun` — Tracks every pipe execution with status, duration, output. Patterns emerge from repeated successful runs with similar trigger/action combinations.
- `Ema.ProposalEngine.KillMemory` — Tracks killed proposal patterns. The inverse — patterns of rejection — is also valuable.
- `Ema.Responsibilities.HealthCalculator` — High health scores (>0.7) on recurring responsibilities indicate crystallized practices.
- `Ema.Tasks.Task` — Completed tasks with `source_type` tracking origin. Repeated task types from the same source suggest automation opportunities.

**Crystallization Pipeline (designed, partially built):**
1. **Detect** — Scan pipe runs, task completions, responsibility health for patterns with 5+ occurrences and 70%+ success rate.
2. **Propose** — Generate a crystallization proposal: "You've done X successfully 7 times. Should I create a pipe/responsibility/vault note to formalize this?"
3. **Review** — Queue in proposal system for human approval.
4. **Crystallize** — On approval, create the automation (pipe), practice (responsibility), or knowledge (vault note).

**Evolution Engine Integration:**
- `Ema.Evolution.BehaviorRule` — Schema for crystallized patterns. Fields include activation conditions, confidence score, version history.
- REST: `/api/evolution/rules` with CRUD + activate/rollback/version endpoints.
- `/api/evolution/scan` — Triggers pattern scan.
- `/api/evolution/propose` — Creates crystallization proposal from detected pattern.

### Current Status

- **Working:** Pipe run tracking with success/failure metrics. Task source tracking. Responsibility health calculation. Evolution rule schema and API.
- **Scaffolded:** Evolution engine supervisor, rule versioning, scan endpoint.
- **Not implemented:** Automatic pattern detection (scan logic is stubbed). Crystallization proposal generation. Approval-to-creation pipeline.

### Next Steps

- Implement pattern detection in evolution scan: query pipe_runs for repeated success patterns, tasks for recurring source types, responsibilities for sustained high health
- Wire detection output to proposal engine: create seeds from detected patterns
- Build crystallization actions: on approval, auto-create pipe (from repeated manual actions), responsibility (from repeated tasks), or vault note (from repeated decisions)
- Add pattern dashboard showing detected patterns, their success rates, and crystallization status

---

## 8. Project Graph Visualization

**Live Knowledge Graph Across Projects, Repos, Decisions, Proposals**

### What It Does

Renders a live, interactive force-directed graph showing relationships between all major EMA entities: projects, proposals, tasks, vault notes, decisions, intent nodes, agents, and their connections.

### Why It Matters

EMA accumulates hundreds of interconnected entities. List views lose the big picture. A graph reveals hidden connections: which proposals feed which projects, which decisions block which tasks, which intent nodes lack implementation, which vault notes are orphaned.

### How It Works

**Data Sources:**
- `Ema.SecondBrain.Link` — Vault note connections with 9 typed edges (depends-on, implements, contradicts, blocks, enables, supersedes, part-of, related-to, references).
- `Ema.Proposals.Proposal` — Links to project (project_id), seed (seed_id), parent proposal (parent_proposal_id), tags.
- `Ema.Tasks.Task` — Links to project, goal, responsibility, parent task, blocking relationships.
- `Ema.Intelligence.IntentEdge` — Intent node relationships.
- `Ema.Projects.Project` — Parent/child hierarchy, linked proposals, tasks, seeds, responsibilities, sessions.

**Existing Graph Infrastructure:**
- `Ema.SecondBrain.GraphBuilder` — GenServer that parses `[[wikilinks]]` from vault markdown. Maintains `vault_links` table. `rebuild/0` reprocesses all notes. `rebuild_note/1` processes single note changes.
- REST: `GET /api/vault/graph` returns full node/edge graph for vault.
- Channel: `vault:graph` room returns link graph and broadcasts changes.

**Frontend (current):**
- `VaultGraph.tsx` — Custom Canvas 2D force-directed graph. Implements its own physics simulation (node repulsion, edge attraction, center gravity). 800x600 canvas with drag, hover labels, edge type filtering.
- `react-force-graph-2d` v1.29.1 — Installed in package.json but **not currently used**.

**Frontend (target):**
- Replace custom Canvas implementation with `react-force-graph-2d` for better performance and interaction
- Extend beyond vault-only to a unified graph pulling from all entity types
- Node types: project (large), proposal (medium), task (small), vault note (small), decision (diamond), intent node (triangle), agent (hexagon)
- Edge types: color-coded by relationship type
- Filtering: by entity type, project scope, time range
- Click-through: clicking a node opens its detail view in the appropriate app window

### Current Status

- **Working:** Vault graph with full link parsing, 9 edge types, real-time updates via channel. Custom Canvas renderer with physics simulation and filtering.
- **Working:** All entity relationship data exists in the database (project->task, project->proposal, proposal->seed, task->goal, intent edges, vault links).
- **Not used:** `react-force-graph-2d` is installed but the vault graph uses a custom Canvas implementation.
- **Not implemented:** Unified cross-entity graph. Only vault notes are currently graphed.

### Next Steps

- Build unified graph API endpoint: `GET /api/graph` that aggregates nodes/edges from projects, proposals, tasks, vault, decisions, intents
- Replace custom Canvas graph with `react-force-graph-2d` for better zoom/pan/performance at scale
- Add node type differentiation (size, shape, color by entity type)
- Implement graph filtering: scope to project, filter by entity type, time-range slider
- Add click-through navigation: clicking a graph node opens the relevant app window via `window-manager.ts`
- Build "graph neighborhood" view: select any entity and see its immediate connections across all types
