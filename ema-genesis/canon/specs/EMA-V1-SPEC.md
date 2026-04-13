# EMA v1 — Normalized System Specification

> Rewritten 2026-04-11. This document supersedes all prior extractions.
> Purpose: Hand this to a coding/planning agent and have it build EMA.

---

## 1. WHAT EMA IS

EMA is an **execution-governance system over a typed knowledge graph**, with separate human and agent workspaces attached to it.

The graph is the source of truth.
The execution loop is the engine.
The workspaces are interface layers around that core.

EMA exists to solve one problem: **there is no system where an LLM agent and a human operate as co-workers over shared, structured, persistent project state with governed handoffs.** Everything else — the wiki, the apps, the P2P — serves that.

---

## 2. THE CANONICAL SPINE

This is the irreducible system loop. Everything else attaches to it.

```
Intent → Proposal → Approval → Execution → Canon Update → Intent State Update
  ↑                                                                ↓
  └────────────────────────────────────────────────────────────────┘
```

**Intent**: A declared goal, gap, or desired outcome. Durable. Lives in the canonical graph.

**Proposal**: A concrete plan to fulfill an intent. Created by agent or human. Requires approval.

**Approval**: Human reviews and accepts/rejects. (Configurable auto-approve is a v2 concern.)

**Execution**: The work gets done. Agent writes code/docs/configs. Stateless per invocation — the agent assembles context from the graph each time.

**Canon Update**: Results are written back to the canonical graph as new or updated nodes.

**Intent State Update**: The originating intent moves to `completed`, spawns sub-intents, or stays `active` if partially fulfilled.

The loop restarts. The graph is now richer. The next `queue next` call sees updated state.

**Nothing else in EMA is required for the system to function.** The CLI, GUI, vApps, P2P, research ingestion — all attach to this spine. If they disappeared, the spine still works with markdown files and a terminal.

---

## 3. STORAGE BOUNDARY (HARD SPLIT)

Two storage domains. No overlap. No ambiguity.

### Canonical Graph (Durable Truth)

Persisted. Versioned. Decision-relevant. Reusable across sessions, actors, and time.

Contains:
- Intents (goals, gaps, desired outcomes)
- Proposals (plans to fulfill intents)
- Executions (records of completed work, outputs, learnings)
- Canon docs (specs, decisions, schemas, reference material)
- Actor metadata (identity, type, capabilities, memberships)
- Space metadata (membership, nesting, configuration)
- Typed relationships (edges between all of the above)

**Format in v1:** Markdown files with YAML frontmatter in a git-tracked folder. Each node is a file or folder. Edges are stored as `connections` arrays in frontmatter. This is the graph. No separate engine required yet.

### Workspace State (Operational / Transient)

Session-scoped or sync-scoped. UI-facing. Not decision-relevant on its own.

Contains:
- Brain dump buffer (capture mode, not a canonical entity)
- To-do / task views (computed from intents + proposals + approvals)
- Timers, pomodoro state
- Schedules, planner views
- Layout and UI preferences
- CLI history
- Ephemeral planner notes
- Machine telemetry / analytics
- Notification state

**Format in v1:** Local JSON/SQLite per instance. No P2P sync in v1. Sync is a later concern.

### The Rule

If removing a piece of data would cause an agent to lose project-critical context → it belongs in the canonical graph.

If removing it would only degrade a UI experience or lose a local preference → it belongs in workspace state.

---

## 4. CANONICAL ONTOLOGY (v1)

Six entity types. No more until proven necessary.

### Node (Base)

Every canonical entity is a Node. This is the atomic unit.

```yaml
id:          string    # Pattern: TYPE-NNN (e.g., INT-001, EXEC-003)
type:        enum      # intent | proposal | execution | canon | schema
status:      enum      # draft | active | completed | deprecated
title:       string
created:     datetime
updated:     datetime
author:      string    # Actor ID
connections: array     # [{ target: node_id, relation: edge_type }]
tags:        array     # string[]
content:     markdown  # Body
```

Edge types: `fulfills`, `produces`, `references`, `supersedes`, `derived_from`, `blocks`

### Intent

```yaml
extends: node
type: intent
priority:      enum    # critical | high | medium | low | backlog
source:        enum    # human | agent_suggested | derived
parent_intent: string? # For sub-intents
blocked_by:    string[]
```

### Proposal

```yaml
extends: node
type: proposal
intent_id:       string   # What this fulfills
proposed_by:     string   # Actor ID
approved_by:     string?
approval_status: enum     # pending | approved | rejected
plan:            markdown
execution_id:    string?  # Set when execution begins
```

### Execution

```yaml
extends: node
type: execution
proposal_id: string
intent_id:   string
executor:    string   # Actor ID
started:     datetime
completed:   datetime?
outputs:     array    # [{ path, description }]
decisions:   array    # string[] — choices made during execution
learnings:   array    # string[] — what was learned
writes:      array    # Node IDs created or updated
```

### Canon Doc

```yaml
extends: node
type: canon
subtype: enum  # spec | decision | reference | guide
```

Generic knowledge node. Specs, decisions, reference material, guides. Written by executions or directly by humans.

### Actor

```yaml
extends: node
actor_type:   enum    # human | agent
display_name: string
capabilities: string[]
spaces:       string[]  # Space IDs
```

### Space

```yaml
extends: node
parent:  string?       # For nesting (org > team > project)
members: array         # [{ actor_id, role: owner|admin|member|observer }]
```

### What Is NOT a Canonical Entity in v1

| Concept | v1 Treatment |
|---|---|
| Brain Dump | Capture mode in workspace. Produces draft Intents or local notes. Not a graph entity. |
| Task / To-do | View over active intents + pending approvals + execution follow-ups. Not a graph entity. |
| Team | Flattened into Space membership for v1. Add Team entity if/when multi-space team identity is needed. |
| vApp | Future plugin system. v1 has no plugin runtime. |
| Research Node | Future. Ingested research becomes Canon docs (type: reference) when it enters the graph. |
| Channel | Future vApp. Not part of core ontology. |

---

## 5. AGENT MODEL (RESOLVED)

### Identity: Persistent

An agent is an Actor in the canonical graph. It has:
- A stable ID
- A display name
- Capabilities list
- Space memberships
- Authored nodes (intents, proposals, executions, canon docs)

The agent's identity persists across sessions. Its history is the graph.

### Execution: Stateless Per Invocation

Each time an agent works, it receives a context window assembled from the graph:
1. System prompt / genesis context
2. The specific intent being worked on
3. Related canon nodes (traversed via connections)
4. The proposal being executed
5. Prior executions on the same intent
6. Relevant schemas

The agent does not carry hidden state between invocations. **Continuity comes from the graph.** If it's not written to the graph, it doesn't exist next time.

### Workspace State: Synced Locally

The agent's operational state (schedule, planner, CLI history) lives in workspace state. In v1 this is local to the machine. It provides convenience and continuity for the human monitoring the agent, but it is not required for the agent to function.

### Dispatch

In v1, agent invocation is **manual or script-triggered**. The human runs `ema queue next`, gets a suggestion, then triggers the agent (via Claude Code, Cursor, or similar) with the assembled context.

Autonomous dispatch (cron, event-driven, always-on) is a v2+ concern.

### LLM Integration

v1: Single provider (Anthropic Claude via API). BYOK.

The provider abstraction is a function signature:
```typescript
type LLMCall = (messages: Message[], options?: LLMOptions) => Promise<LLMResponse>
```

Multi-provider, local models, host-peer routing — all v2+.

---

## 6. HUMAN / AGENT WORKSPACE SEPARATION

Both sides have their own workspace. Neither wraps the other. Both talk to the same core.

```
Human Workspace                    Agent Workspace
├─ Electron GUI (v2+)              ├─ CLI (ema <noun> <verb>)
├─ Brain dump capture              ├─ Structured graph I/O
├─ Approval interface              ├─ Context assembly
├─ Graph/wiki viewer               ├─ Execution runtime
├─ Schedule, to-do views           ├─ Machine access (sudo, SSH, tmux)
├─ Pomodoro, timers                └─ Queue / suggestion engine
└─ Analytics
        │                                   │
        └───────────┬───────────────────────┘
                    │
          ┌─────────▼─────────┐
          │    EMA CORE (TS)  │
          │                   │
          │  read / write /   │
          │  connect / query  │
          │  on canonical     │
          │  graph (files)    │
          └───────────────────┘
```

**Cross-visibility** (human sees agent state, agent sees human state) is a v2+ feature requiring P2P sync. In v1, the canonical graph is the shared surface — both sides read and write it.

---

## 7. REAL BUILD ORDER

Dependency chain. No aspirational items. Each step unblocks the next.

```
Phase 0: FOUNDATION (done)
──────────────────────────
✓ Genesis folder structure
✓ YAML entity schemas (v0.1)
✓ Genesis prompt (node zero)
✓ Schematic v0
✓ First intent, proposal, execution records
✓ CLI command surface designed (ema <noun> <verb>)

Phase 1: CORE LIBRARY
──────────────────────
  ema-core TypeScript package
  ├─ Read node from folder (parse MD + YAML frontmatter)
  ├─ Write node to folder (serialize MD + YAML frontmatter)
  ├─ List nodes by type/status/layer
  ├─ Connect nodes (add/remove edges)
  ├─ Simple query: find by ID, filter by type/status/tag
  └─ Validate against schemas

  Storage: folder of markdown files. No DB. No engine.
  Test: unit tests that CRUD nodes in a temp directory.

Phase 2: CLI
────────────
  ema CLI (TypeScript, Node.js)
  ├─ ema intent list|create|view|update
  ├─ ema proposal list|create|approve|reject
  ├─ ema exec list|create|complete
  ├─ ema canon list|read|write
  └─ ema graph connect|traverse

  Uses ema-core. Outputs to stdout (tables, YAML, JSON).
  Test: run each command against the genesis folder.

Phase 3: THE LOOP
─────────────────
  Wire the spine end-to-end:
  1. Create an intent via CLI
  2. Agent creates a proposal via CLI
  3. Human approves via CLI
  4. Agent executes (writes code/docs using machine access)
  5. Agent completes execution via CLI (writes outputs + learnings)
  6. Canon is updated, intent status changes
  7. Run `ema intent list` — state has advanced

  Test: complete one real intent (e.g., "add a README to ema-core").

Phase 4: LLM INTEGRATION
─────────────────────────
  ├─ Context assembly function (reads graph, builds prompt)
  ├─ Single LLM provider (Claude API, BYOK)
  ├─ `ema queue next` — LLM evaluates intents, suggests priority
  ├─ `ema queue suggest` — LLM suggests new intents from graph state
  └─ Prompt templates for proposal generation

  Test: `ema queue next` returns a ranked intent list.
  Test: LLM generates a proposal for an intent automatically.

Phase 5: SELF-BUILDING
──────────────────────
  EMA uses its own loop to build itself:
  1. Intents describe remaining EMA features
  2. Agent proposes implementations
  3. Human approves
  4. Agent executes, writes code into the EMA codebase
  5. Canon documents the decisions and learnings
  6. Repeat

  This is the proof that the system works.

── LATER (v2+) ──────────────────────────────────

Phase 6:  Graph engine (replace folder-as-graph with real query engine)
Phase 7:  Electron shell + IPC
Phase 8:  Workspace state persistence (local SQLite)
Phase 9:  vApp runtime + SDK
Phase 10: P2P sync (CRDT selection, networking)
Phase 11: Cross-workspace visibility (human ↔ agent)
Phase 12: Multi-agent support
Phase 13: Research ingestion pipeline
Phase 14: Configurable auto-approve
Phase 15: Old Elixir codebase audit + data migration
```

**What EMA is NOT blocked by:**
- P2P, CRDTs, or sync (v1 is single-machine, single-user)
- Plugin SDKs or vApp runtimes (v1 features are hardcoded)
- Electron or GUI (v1 is CLI-only)
- Graph engine upgrades (v1 uses folder-as-graph)
- Multi-agent orchestration (v1 has one agent)
- Advanced workspace mirroring (v1 shares state via the canonical graph)

---

## 8. FOLDER STRUCTURE (v1 CANONICAL GRAPH)

```
ema-project/                        # A Space, rooted in a folder
├── .ema/                           # EMA metadata
│   ├── config.yaml                 # Space config, actor registrations
│   └── workspace/                  # Workspace state (local, not canonical)
│       ├── brain-dump.json         # Capture buffer
│       ├── cli-history.json        # Command history
│       └── ui-state.json           # Layout, preferences
├── canon/                          # Canon docs (durable knowledge)
│   ├── CANON-001.md                # Spec, decision, reference, guide
│   └── ...
├── intents/                        # Intents (goals, gaps)
│   ├── INT-001/
│   │   └── README.md               # Intent document with YAML frontmatter
│   └── ...
├── proposals/                      # Proposals (plans)
│   ├── PROP-001/
│   │   └── README.md
│   └── ...
├── executions/                     # Execution records
│   ├── EXEC-001/
│   │   ├── README.md               # Record with outputs, decisions, learnings
│   │   └── ...                     # Attached artifacts
│   └── ...
└── schemas/                        # Entity schemas (YAML)
    ├── node.yaml
    ├── intent.yaml
    ├── proposal.yaml
    ├── execution.yaml
    ├── canon.yaml
    ├── actor.yaml
    └── space.yaml
```

**The `.ema/workspace/` directory is explicitly NOT canonical.** It is local, gitignored, and disposable. Losing it loses convenience, not truth.

**Everything outside `.ema/workspace/` IS the canonical graph.** It is git-tracked, versioned, and the source of truth for all decisions.

---

## 9. CORE LIBRARY API SURFACE (v1)

```typescript
// ema-core — the shared library that CLI (and later GUI) calls

interface EmaCore {
  // Node CRUD
  readNode(id: string): Node | null
  writeNode(node: Node): void
  deleteNode(id: string): void  // marks deprecated, doesn't remove file
  listNodes(filter?: { type?: NodeType, status?: Status, tag?: string }): Node[]

  // Graph operations
  connect(sourceId: string, targetId: string, relation: EdgeType): void
  disconnect(sourceId: string, targetId: string): void
  traverse(startId: string, relation?: EdgeType, depth?: number): Node[]

  // Pipeline operations
  createIntent(fields: IntentInput): Intent
  createProposal(intentId: string, fields: ProposalInput): Proposal
  approveProposal(proposalId: string, approverId: string): Proposal
  rejectProposal(proposalId: string, approverId: string, reason: string): Proposal
  startExecution(proposalId: string, executorId: string): Execution
  completeExecution(executionId: string, results: ExecutionResults): Execution

  // Context assembly (for LLM)
  assembleContext(intentId: string): ContextWindow
  queueNext(): RankedIntent[]

  // Workspace state (local, non-canonical)
  workspace: {
    getBrainDumps(): BrainDumpEntry[]
    addBrainDump(text: string): BrainDumpEntry
    promoteBrainDump(entryId: string): Intent  // converts to draft intent
    getCliHistory(): CliEntry[]
  }
}
```

---

## 10. WHAT v1 ACTUALLY IS

**EMA v1 is a CLI tool and TypeScript library that governs an intent-proposal-execution loop over a folder of markdown files, with LLM-powered prioritization and context assembly.**

It has:
- 6 canonical entity types (Node, Intent, Proposal, Execution, Canon, Actor/Space)
- A folder-as-graph storage layer (markdown + YAML frontmatter, git-tracked)
- A CLI (`ema <noun> <verb>`) for both human and agent interaction
- A core library (`ema-core`) that the CLI calls
- LLM integration (single provider) for queue prioritization and proposal generation
- A local workspace state buffer (brain dumps, CLI history, not canonical)

It does not have:
- A GUI
- P2P sync
- A plugin/vApp system
- A graph query engine beyond folder listing + frontmatter parsing
- Multi-agent support
- Cross-workspace visibility
- Research ingestion
- Auto-approve
- Electron anything

**v1 is complete when EMA can use its own loop to build itself.**

---

## 11. REMAINING OPEN QUESTIONS (v1 SCOPE ONLY)

Only questions that must be answered before or during Phase 1–5 implementation.

1. **Schema validation strictness:** Does `ema-core` enforce schema validation on write, or is it advisory? Recommendation: enforce on write, warn on read (graceful with legacy data).

2. **ID generation:** Auto-increment per type (INT-001, INT-002...) or UUID-based? Recommendation: auto-increment, human-readable, sequential per type per space.

3. **Edge symmetry:** When A→B with `fulfills`, does B automatically get a reverse reference? Recommendation: yes, store bidirectionally.

4. **Frontmatter parser:** Which library for YAML frontmatter in markdown? Options: `gray-matter` (most popular), `front-matter`, or hand-rolled. Recommendation: `gray-matter`.

5. **CLI framework:** Commander.js vs Oclif vs yargs? Recommendation: Commander.js (lightweight, sufficient for v1).

6. **Context window budget:** How much of the graph does `assembleContext` include? Needs a token budget strategy. Recommendation: include intent + direct connections + 1-hop canon nodes, truncate to 80k tokens.

7. **Execution artifacts:** Where do code files produced by an execution live? In `executions/EXEC-NNN/` or in a separate source tree? Recommendation: execution folder for records/docs, actual code goes into the codebase with a reference in the execution record.

---

## 12. GLOSSARY (NORMALIZED)

| Term | Meaning | NOT |
|---|---|---|
| Canonical graph | The folder of markdown+YAML files that constitutes durable truth | Not "graph wiki", "context graph", or "wiki" |
| Workspace state | Local, non-canonical, disposable operational state | Not part of the graph. Not synced in v1. |
| Canon doc | A knowledge node (spec, decision, reference) in the canonical graph | Not a "wiki page" — it's a typed graph node |
| Wiki view | A human-readable rendering of canon docs (future GUI feature) | Not a separate system — just a view |
| Brain dump | A local capture buffer that produces draft intents | Not a canonical entity |
| Task / To-do | A computed view over intents + proposals + approvals | Not a canonical entity |
| Actor | A persistent identity (human or agent) in the graph | Not an LLM session |
| Execution run | A stateless, time-bounded unit of agent work | Not the actor itself |
| Space | A project boundary (folder) containing canonical graph nodes | Not an "organization" — spaces nest for that |
| The spine | Intent → Proposal → Approval → Execution → Canon Update → Intent Update | The core loop. Everything else attaches to this. |
