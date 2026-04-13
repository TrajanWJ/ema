# EMA Genesis Prompt — v0.2

> **This document is EMA's first canonical node.**
> It is simultaneously: an LLM prompt, a system design spec, a project plan, and
> the first intent/execution/project record in EMA's own graph. When EMA becomes
> self-aware enough to read its own knowledge store, this is what it finds first.
>
> This document was produced through a structured brainstorming session that itself
> mirrors the Blueprint vApp — one of EMA's core modules. Every decision, deferral,
> and aspiration from that session is captured here.

---

## §0 — What This Document Is

This file bootstraps EMA into existence. An agent (Claude Code, Codex, or similar)
reads this document and the accompanying `ema-genesis/` folder to understand:

1. What EMA is
2. What exists today (old Tauri/Elixir build)
3. What the target is (Electron/TypeScript rebuild)
4. How every layer of the system works
5. What to build first, second, third
6. How to write results back so the next run is smarter

**This document grows.** Each execution appends learnings, decisions, and links
to new canon nodes. It never shrinks — only gains structure.

**Agent instructions:** When working from this document, read it fully before
starting. Check `intents/` for open work. Check `proposals/` before duplicating.
Write all outputs to canonical locations. See §12 for full agent rules.

---

## §1 — What Is EMA

EMA (Executive Management Assistant — working title) is a **shared workspace for
agents and humans**, built as an **open-source, self-hosted, P2P platform**.

### Why EMA Exists

The tools we use to think, plan, and build are fragmented. Notes in one app.
Tasks in another. Code in a third. Research scattered across browser tabs.
Agents trapped in ephemeral chat sessions that forget everything. Machines
managed through disconnected SSH sessions. Team knowledge locked in Slack
threads that disappear into noise.

EMA exists because **humans and AI agents need a shared home** — a single
environment where knowledge persists, work is tracked, machines are managed,
research is structured, and both humans and agents can see what the other is
doing. Not another tool in the stack. The environment that replaces the stack.

The driving beliefs:

- **Agents deserve workspace, not just sessions.** Today's AI agents start from
  zero every conversation. EMA gives them persistent context, planning tools,
  and a workspace that accumulates intelligence over time.
- **Humans and agents work differently.** Forcing them into the same interface
  is wrong. Each side gets purpose-built tools. But they must see each other's
  work and coordinate naturally.
- **Your data belongs on your machines.** No cloud lock-in. No subscription
  to access your own knowledge. Self-hosted, P2P, fully open source.
- **The best agent is the one you already use.** EMA wraps Claude Code, Codex,
  and other CLI agents rather than building yet another agent from scratch.
  Improve what exists rather than replace it.
- **Software should build itself.** EMA manages its own development through
  the same intent→proposal→execution pipeline it offers users. The system
  is its own first user.

It is not a chatbot. It is not a task manager. It is not a notes app. It is a
**collaborative intelligence environment** where:

- **Humans** have their own workspace with purpose-built apps, views, and workflows
- **Agents** have their own workspace with planning tools, execution pipelines, and
  context management
- Both operate on **shared state** — visible to and modifiable by either side
- The system manages **real machines** with full SSH/sudo access across a P2P network
- EMA is a **platform** — everything is a module (vApp), including core features
- The system is **self-building** — it manages its own roadmap and development

### What Makes EMA Different

No existing tool does what EMA does:

- **Agents are first-class workspace participants**, not plugins or chatbots
- **Full machine access** — agents can SSH, install packages, run commands on any
  machine in the network
- **MITM agent proxy** — EMA wraps existing CLI agents (Claude Code, Codex) with
  bidirectional context enrichment, not building its own agent from scratch
- **Mutual visibility** — humans see agent workspaces, agents see human activity
- **Distributed infrastructure** — self-healing P2P mesh for compute, storage, and
  self-hosted services
- **Research engine** — active knowledge ingestion from YouTube, Reddit, arxiv,
  GitHub, RSS, with AI curation and graph-backed context

### Core Concepts

| Concept | What It Is |
|---------|-----------|
| **Human** | A person using EMA through the GUI (Electron launchpad + vApp windows) |
| **Agent** | An AI using EMA through the CLI/proxy (MITM-wrapped CLI agent in a tmux/pty session) |
| **Space** | A project/workspace boundary. Nests: org > team > project. Contains knowledge, intents, members, permissions |
| **Team** | A group of humans and agents that collaborate within and across spaces |
| **Node** | A unit of knowledge in the graph wiki. Has type, layer, connections, content |
| **Intent** | A declared goal. Lives on the intents layer. Folder-backed |
| **Proposal** | A concrete plan to fulfill an intent. Requires human approval |
| **Execution** | A completed unit of work. Writes results to canon |
| **vApp** | A windowed module in EMA's desktop environment. Web component with full system access |
| **Feed** | AI-curated discovery stream. Research layer's human face + system-wide activity |

---

## §2 — Architecture Overview

### The Stack

```
╔══════════════════════════════════════════════════════════════════╗
║                            EMA                                   ║
╠════════════════════════╦═════════════════════════════════════════╣
║    HUMAN SURFACE       ║          AGENT SURFACE                  ║
║                        ║                                         ║
║  Electron Launchpad    ║  EMA CLI (ema <noun> <verb>)            ║
║  ├─ vApp BrowserWindows║  ├─ Puppeteer Agent Runtime ◄── THE SPINE║
║  ├─ Web Components     ║  ├─ xterm.js + tmux/pty per agent        ║
║  ├─ Design Token System║  ├─ Wraps Claude Code + Codex            ║
║  ├─ Full system access ║  ├─ Terminal automation + context inject  ║
║  └─ 35+ modules        ║  ├─ Full SSH/sudo machine access         ║
║                        ║  ├─ Cross-machine dispatch                ║
║                        ║  └─ Ingests .claude/ .cursor/ etc.        ║
╠════════════════════════╩═════════════════════════════════════════╣
║                        EMA CORE                                   ║
║                     (TypeScript library)                          ║
║                                                                   ║
║  CLI ──────────┐                                                  ║
║                ├──▶  Core API layer                               ║
║  GUI ──────────┘         │                                        ║
║                          ├──▶ Graph Wiki Engine                   ║
║                          ├──▶ P2P Sync Network                    ║
║                          ├──▶ Agent Runtime (puppeteer + xterm.js)║
║                          ├──▶ vApp Host                           ║
║                          ├──▶ Research Ingestion                  ║
║                          ├──▶ Comms System                        ║
║                          └──▶ Infrastructure Manager              ║
╠═══════════════════════════════════════════════════════════════════╣
║                    KNOWLEDGE ARCHITECTURE                         ║
║                                                                   ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │  WIKI (human-facing views, Wikipedia-style web frontend)  │   ║
║  ├────────────────────────────────────────────────────────────┤   ║
║  │  CANON LAYER ──── ground truth, specs, schemas, decisions │   ║
║  ├────────────────────────────────────────────────────────────┤   ║
║  │  INTENTS LAYER ── goals, gaps, work to do, proposals      │   ║
║  ├────────────────────────────────────────────────────────────┤   ║
║  │  RESEARCH LAYER ─ ingested external content, AI-curated   │   ║
║  ├────────────────────────────────────────────────────────────┤   ║
║  │  CONTEXT GRAPH ENGINE ── preservation layer, stores all   │   ║
║  │  efficiently, native dedup via embeddings, LLM-maintained │   ║
║  │  health, compaction, charts/diagrams auto-generated       │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║                      STORAGE SPLIT                                ║
║  Graph Wiki ──▶ knowledge, intents, research, execution history   ║
║  P2P Sync ────▶ workspace state, vApp data, CLI history,          ║
║                 machine state, org/space membership                ║
╠═══════════════════════════════════════════════════════════════════╣
║                    P2P INFRASTRUCTURE MESH                        ║
║                                                                   ║
║  Machine A (host peer)     Machine B          Machine C (invisible)║
║  ├─ Routes AI calls        ├─ Available       ├─ Syncs data only  ║
║  ├─ More resources         ├─ Agents run here ├─ No resource drain║
║  ├─ Agents dispatch here   ├─ Services hosted └─ Opted out compute║
║  └─ Services hosted        └─ CLI tools avail                     ║
║                                                                   ║
║  • Auto-redistribution when machines go offline                   ║
║  • Self-healing network availability guarantees                   ║
║  • Distributed self-hosted services across org                    ║
║  • Any agent can invoke any tool on any machine in network        ║
║  • Invisible mode: peer syncs but donates zero compute            ║
╚═══════════════════════════════════════════════════════════════════╝
```

### CLI ↔ GUI Relationship

CLI and GUI are **equal peers**. Neither wraps the other. Both talk to the
same EMA Core library:

```
ema <noun> <verb> [args]     ←── CLI (agents + power users)
         │
         ├──▶  EMA Core (TypeScript library)
         │
Electron Launchpad + vApps   ←── GUI (humans)
```

---

## §3 — The Two Sides

### Human Workspace

The human side is a **desktop environment**. The launchpad shows icons for all
available vApps. Each vApp opens as its own **Electron BrowserWindow**. vApps are
**web components** (framework-agnostic — build in React, Svelte, Vue, or vanilla).

All vApps share:
- Full access to EMA Core API (graph, P2P, agents, machine access)
- A unified **design token system** (CSS custom properties — colors, spacing,
  typography, component patterns). Every vApp respects the same tokens.
- Access to the same underlying data
- Configurable per-space visibility

The human workspace includes purpose-built productivity apps:
- Brain dumps, notes, journal
- Tasks, to-do lists, responsibilities
- Schedule, calendar, time blocking
- Pomodoro / focus timer
- Graphing, charting, diagrams
- Whiteboard / canvas
- File manager / explorer
- Email / messaging integration
- Wiki viewer, graph visualizer
- Feeds (AI-curated discovery)
- Blueprint / schematic planner
- Comms (threaded chat + contextual comments + DMs)
- And more (see §7 for full vApp catalog)

The human can **view the agent's workspace** — see agent virtual calendars,
scratchpads, plans, statuses, and live work sessions. Cross-modification happens
**only on explicit request/approval** — for example, an agent auto-fills a
suggestion in the human's to-do app, and the human taps accept.

### Agent Workspace

The agent side is **CLI-native**. Agents interact exclusively through:

- The EMA CLI (`ema <noun> <verb>`)
- tmux/pty sessions inside xterm.js (one per agent)
- The puppeteer runtime that controls their underlying CLI agent

Humans access and **interactively control** the agent workspace through
dedicated vApps (see §7, Agent Observation & Control). These vApps are NOT
read-only — humans can modify agent schedules, redirect work, edit plans,
send messages, and dispatch agents through them. But the agent itself never
uses vApps — its world is the CLI.

The agent workspace includes purpose-built CLI tools organized as a mirror
of the human vApp catalog. Each agent CLI tool has a natural vApp counterpart
for human observation and interaction:

#### Agent Planning & Scheduling (CLI: `ema agent schedule`, `ema agent plan`)

| # | Tool | Description |
|---|------|-------------|
| A1 | **Virtual Calendar** | Self-paced schedule for long-term project planning. Agents orient their work around virtual time blocks. Visible to humans via Agent Calendar vApp. |
| A2 | **Long-Term Planner** | Multi-phase project planning with dependency tracking. Breaks large intents into sequenced sub-tasks across weeks/months. |
| A3 | **Sprint Planner** | Short-cycle work planning. Agent queues tasks for current work session based on priorities and available context. |
| A4 | **Workload Estimator** | Estimates effort for proposals based on codebase complexity, historical execution data, and scope. |

#### Agent Context & Knowledge (CLI: `ema agent context`, `ema research`)

| # | Tool | Description |
|---|------|-------------|
| A5 | **Context Assembler** | Gathers relevant canon, intents, schemas, and old codebase references into optimized context windows for work sessions. |
| A6 | **Research Query Engine** | Queries the research layer and triggers new research ingestion based on active intents. |
| A7 | **Codebase Navigator** | Indexes and navigates project source across old and new codebases. Maps entity relationships, design tokens, patterns. |
| A8 | **Knowledge Writer** | Structured output tool for writing results back to canon — creates/updates nodes, links connections, updates intent statuses. |

#### Agent Execution & Ops (CLI: `ema agent exec`, `ema machine`, `ema agent dispatch`)

| # | Tool | Description |
|---|------|-------------|
| A9 | **Execution Pipeline** | Manages the full lifecycle: read intent → create proposal → await approval → execute → write results → update canon. |
| A10 | **Scratchpad** | Working notes, drafts, intermediate state. Visible to humans via Agent Scratchpads vApp. Not committed to canon until ready. |
| A11 | **Machine Interface** | SSH/sudo access layer. Execute commands, install packages, manage files across any machine in the P2P network. |
| A12 | **Dispatch Controller** | Dispatch other agents or CLI tools on local or remote machines. Manage concurrent agent coordination. |

#### Agent Communication & Reporting (CLI: `ema agent status`, `ema agent comms`)

| # | Tool | Description |
|---|------|-------------|
| A13 | **Status Reporter** | Reports current status, progress, blockers to the graph. Visible via Agent Plans/Status vApp. |
| A14 | **Approval Requester** | Creates approval requests for human review. Auto-fills suggestions in human vApps (to-do, schedule, etc.) with tap-to-accept UX. |
| A15 | **Session Logger** | Records all terminal I/O, commands, outputs. Feeds into Agent Live View (stream + replay + searchable logs). |
| A16 | **Inter-Agent Messenger** | Posts messages to the graph for other agents to read. Agent-to-agent coordination without direct channels. |

Agents can **view the human's workspace** — see what the human is working on,
their schedule, their focus state. This enables genuinely collaborative behavior
(e.g., agent sees Pomodoro timer running and knows not to interrupt).

### The Approval Pattern

When agents want to modify human workspace state:

```
Agent auto-fills suggestion ──▶ Appears in human's vApp ──▶ Human taps [Accept]
                                  (e.g., a to-do item,        or [Reject]
                                   a schedule block,           or [Revise]
                                   a research query)
```

This extends everywhere. Any agent action that affects human state goes through
approval. Configurable auto-approve levels per space allow trusted agents to
bypass approval for low-risk actions.

---

## §4 — Agent Runtime (The Spine)

The agent runtime is not a feature of EMA — **it IS how agents exist in EMA**.
Every agent interaction flows through it. It is a **puppeteer-style terminal
emulator** that virtualizes CLI agent sessions inside Electron.

### How It Works

```
Electron BrowserWindow (Agent Live View vApp)
└─ xterm.js (or similar terminal emulator)
   └─ tmux session (one per agent)
      └─ CLI agent running inside (Claude Code / Codex / etc.)
         └─ EMA puppeteer layer
            ├─ Reads agent terminal output
            ├─ Injects context / commands programmatically
            ├─ Records full session (video-like replay)
            ├─ Logs all I/O (searchable text logs)
            ├─ Enforces approval gates
            ├─ Syncs state to P2P network
            └─ Has full sudo access to host machine
```

This is NOT a network-level proxy or protocol interceptor. It is a **terminal
session controller** — EMA runs agents inside virtualized terminal sessions
and controls them the way a puppeteer controls a browser. The terminal
emulator renders in Electron BrowserWindows, giving humans a live view.

### Agent Wrapping

EMA does **not** ship its own LLM agent. Instead, it:

1. **Detects** downloaded and configured CLI agents on the system (Claude Code,
   Codex, Cursor CLI, etc.)
2. **Launches** them inside virtualized tmux/pty sessions within Electron
3. **Ingests** their config and history directories (`.claude/`, `.cursor/`,
   `.superpowers/`, etc.) for backfeeding and user initialization
4. **Controls** via puppeteer-style automation — reads terminal output,
   injects commands and context, captures all I/O
5. **Dispatches** agents through EMA's virtual CLI to work on intents

### Agent Capabilities

- **Full sudo access**: Complete machine control — SSH, sudo, package
  management, file system, process management
- **Cross-machine dispatch**: Any agent can invoke any CLI tool on any machine
  in the P2P network via SSH
- **Agent-to-agent communication**: Through the graph (not direct messaging)
- **Agent-to-agent dispatch**: Agents can dispatch other agents to work
- **Multiple concurrent agents**: Configurable — one or many per space,
  across spaces simultaneously
- **Session management**: Each agent gets its own tmux/pty session inside
  its own xterm.js instance
- **Dependencies**: Auto-installed (e.g., tmux packaged with or installed by EMA)
- **Observable**: Live terminal stream + full session replay + searchable logs
- **Controllable**: Pause, resume, redirect, inject context mid-session

### LLM Integration

EMA wraps existing CLI agents rather than managing LLM API keys directly.
The host peer in a P2P network can route AI calls for the org, effectively
becoming a private AI server for the team.

### Key Technologies

- **xterm.js** — terminal emulator rendering in Electron BrowserWindows
- **node-pty** — pseudoterminal bindings for Node.js (spawns real shell sessions)
- **tmux** — session multiplexing, persistence, and management
- Compatible: Linux first, macOS second

---

## §5 — The Graph Wiki

EMA's knowledge system is a **graph wiki** with layered storage and a live
LLM maintaining data health.

### Layers

```
┌─ WIKI ─────────────────────────────────────────────────────┐
│  Human-facing views. Wikipedia-style web frontend.          │
│  Configurable per-space: public read or authenticated.      │
│  Accessible from any browser, editable from desktop or web. │
├─────────────────────────────────────────────────────────────┤
│  CANON LAYER                                                │
│  Ground truth. Specs, schemas, decisions, reference docs.   │
│  What EMA knows.                                            │
├─────────────────────────────────────────────────────────────┤
│  INTENTS LAYER                                              │
│  Goals, desires, open questions, work to do.                │
│  What EMA wants.                                            │
├─────────────────────────────────────────────────────────────┤
│  RESEARCH LAYER                                             │
│  Ingested external content. AI-curated and structured.      │
│  What the world knows (that EMA has captured).              │
├─────────────────────────────────────────────────────────────┤
│  CONTEXT GRAPH ENGINE                                       │
│  Preservation layer underneath everything.                  │
│  Stores all data efficiently. Native dedup via embeddings.  │
│  Live LLM maintains health, compacts, generates charts      │
│  and mermaid diagrams from data automatically.              │
└─────────────────────────────────────────────────────────────┘
```

### Context Graph Engine

The engine underneath the wiki layers has built-in intelligence:

- **Native deduplication** via embeddings and semantic similarity — when research
  ingestion pulls the same concept from 3 sources, the graph knows and merges
- **LLM-maintained health** — a live language model monitors the graph, compacts
  redundant information, and maintains context efficiency
- **Auto-generated visualizations** — charts, mermaid diagrams, and other
  representations are generated from graph data automatically
- **Layered dedup strategy** — simple matching (URL/hash) first, semantic
  (embeddings) second, LLM arbitration third

### Node Anatomy

Every node in the graph has:

```yaml
id: <unique, pattern: TYPE-NNN>
type: <canon|intent|proposal|execution|schema|reference|decision|spec>
layer: <canon|intents|research>
title: <human readable>
status: <draft|active|completed|deprecated|archived>
created: <iso8601>
updated: <iso8601>
author: <human or agent identifier>
connections:
  - { target: <node_id>, relation: <fulfills|references|supersedes|derived_from|blocks|produces> }
tags: [<string>]
content: <markdown body or structured data>
version: <incremented on every change>
```

### Versioning

**Everything in EMA is versioned and auditable.** Every node, every edit, every
state change is tracked with full history. Git-like semantics but built into
the graph engine.

### Collaboration

**CRDT-based automatic merge** for simultaneous editing. When two humans edit
the same wiki page at the same time, changes merge automatically without
conflicts.

### Storage Format (Bootstrap Phase)

During bootstrap, before the full graph engine exists:

- **Markdown files with YAML frontmatter** — human readable, machine parseable
- **Organized in folders** that mirror the layer/type structure
- **Git-tracked** for history and collaboration

The real graph engine will ingest these files as its initial state.

### Graph Engine Implementation

**Intentionally left vague.** The graph engine is a major architectural decision
that should be made with full context from the Superman project and available
open-source options. The bootstrap folder format is designed to be ingestible
by any future engine.

Reference points for the decision:
- Superman (team member's existing graph/wiki/context technology)
- Yjs / Automerge / Loro (CRDTs that could back graph nodes)
- Gun.js / OrbitDB (P2P-native graph databases)
- SurrealDB (multi-model with real-time sync)

### Web Wiki

The wiki layer has a **Wikipedia-style web frontend** that is:
- Accessible from any browser (desktop or phone)
- Configurable per-space: public read, or authenticated access
- Both readable and editable through the web interface
- Also available as a vApp within EMA's desktop environment
- A web mirror of the graph's canon and research layers

---

## §6 — Research Ingestion & Feeds

### Research Layer

EMA actively goes out and brings knowledge back, structured and queryable:

- **Sources**: YouTube, Reddit, arxiv/papers, GitHub repos/issues, RSS/blogs,
  Hacker News, Twitter/X, docs sites, custom sources
- **Scheduling**: Human configures crons, submits queries through CLI and GUI
- **Storage**: Ingested into the context graph engine, which preserves
  everything efficiently on a layer underneath the wiki
- **Access**: Queryable via CLI, GUI, and MCP (external agents can query
  EMA's research graph)
- **AI curation**: LLM processes, structures, and rates signal quality

### Feeds (formerly "Channels")

Feeds are the **unified discovery surface** across all of EMA:

- **Research feeds**: AI-curated content from configured sources, similar to
  RSS but modernized with AI-dictated signal filtering
- **System feeds**: Agent activity, execution completions, approval requests
- **Space feeds**: Updates from team members, new knowledge, status changes

Feeds are configurable by the user — set sources, filters, signal thresholds.
The AI curates what surfaces based on relevance to active intents, current
work, and stated interests.

Feeds are a vApp (BrowserWindow) and are also surfaced through the
notification system.

---

## §7 — vApp Catalog

vApps are **windowed modules** in EMA's desktop environment. Each is a **web
component** (framework-agnostic) that opens as its own **Electron BrowserWindow**.
All share full access to EMA Core and the design token system.

Distribution: **local-first** for now, **git-based with GitHub install** in future.

### Human Productivity

| # | vApp | Description |
|---|------|-------------|
| 1 | **Notes** | Rich note-taking with graph connections |
| 2 | **Tasks / To-Do** | Task management with agent suggestion acceptance |
| 3 | **Schedule / Calendar** | Calendar with time-aware agent coordination |
| 4 | **Responsibilities** | Role and responsibility tracking |
| 5 | **Brain Dumps** | Unstructured capture → auto-extracted aspirations/intents |
| 6 | **Pomodoro / Focus** | Focus timer visible to agents (they know not to interrupt) |
| 7 | **Time Blocking** | Block-based schedule planning |
| 8 | **Graphing / Charting** | Data visualization and diagramming |
| 9 | **Whiteboard / Canvas** | Freeform visual workspace |
| 10 | **File Manager** | File explorer across local and networked machines |
| 11 | **Email / Messaging** | External email integration |
| 12 | **Journal / Log** | Personal logging with auto-aspiration detection |
| 13 | **Code Editor / IDE** | *Deferred — Superman project may cover this* |

### Knowledge & Research

| # | vApp | Description |
|---|------|-------------|
| 14 | **Wiki Viewer** | Browse and edit the graph wiki |
| 15 | **Graph Visualizer** | Visual map of nodes and connections |
| 16 | **Feeds** | AI-curated discovery across research + system activity |
| 17 | **Research Viewer** | Deep-dive into ingested research content |
| 18 | **Blueprint Planner** | System design tool with GAC queue, blockers, aspirations (see §8) |

### Agent Observation & Control

> Human's **interactive window** into the agent workspace. NOT read-only —
> humans can modify agent state through these. Agents use CLI only.
> Each vApp mirrors agent CLI commands.

| # | vApp | Description | Mirrors CLI |
|---|------|-------------|-------------|
| 19 | **Agent Hub** | Dispatch, manage, configure all agents | `ema agent` |
| 20 | **Agent Calendar** | View AND modify agent virtual planning schedules | `ema agent schedule` |
| 21 | **Agent Scratchpads** | Read and annotate agent working notes | `ema agent scratchpad` |
| 22 | **Agent Plans / Status** | Monitor and modify agent plans, reprioritize | `ema agent plan/status` |
| 23 | **Agent Live View** | Real-time terminal stream + replay + logs + send commands | `ema agent session` |
| 24 | **Agent Comms** | View and participate in agent-to-agent communication | `ema agent comms` |
| 25 | **Terminal** | Direct terminal access to agent sessions and system | `ema machine` |

### System & Infrastructure

| # | vApp | Description |
|---|------|-------------|
| 26 | **Machine Manager** | SSH connections, system access, machine roles across network |
| 27 | **Space Manager** | Org > team > project hierarchy management |
| 28 | **Team Manager** | Members, roles, invitations |
| 29 | **Settings** | All configuration — system, space, agent, network, tokens |
| 30 | **Analytics** | System-wide dashboards — agent work, resource usage, knowledge growth |
| 31 | **Services Manager** | Self-hosted service management across distributed homelab |
| 32 | **Network / Peer Manager** | P2P peer status, host peer config, invisible mode |
| 33 | **Permissions** | Per-space access control, auto-approve levels, data access config |
| 34 | **Comms** | Threaded chat + contextual comments on graph nodes + DMs |
| 35 | **Notifications Hub** | Central notification management — messages, approvals, alerts |

---

## §8 — The Blueprint Planner vApp

The Blueprint Planner deserves special attention because **the process that
created this document IS the Blueprint vApp, operated manually**. It formalizes
the system design and planning workflow.

### Structure

```
┌──────────────────────────────────────────────────────────────┐
│  BLUEPRINT PLANNER                                           │
│                                                              │
│  ┌─ GAC Queue ────────────────────────────────────────────┐  │
│  │  Auto-generated cards for:                              │  │
│  │  • Gaps (what's missing from the design)                │  │
│  │  • Assumptions (what needs validation)                  │  │
│  │  • Clarifications (what's ambiguous)                    │  │
│  │                                                         │  │
│  │  Each card has pre-filled answer options:               │  │
│  │  [A] [B] [C] [D]  +  [1] [2]                          │  │
│  │                                                         │  │
│  │  Human taps an answer → decision logged to graph        │  │
│  │  Human can also freeform respond                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Blockers Queue ───────────────────────────────────────┐  │
│  │  • Tricky questions that need more context              │  │
│  │  • Deferred decisions (not ready to decide yet)         │  │
│  │  • Blocking dependencies (can't proceed without X)      │  │
│  │  • Cards can be promoted back to GAC when ready         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Aspirations Log ─────────────────────────────────────┐   │
│  │  Auto-populates from user input across all vApps:       │  │
│  │  • LLM detects aspirational/goal statements             │  │
│  │  • Human can manually tag anything as aspiration         │  │
│  │  • Idealistic goals, long-term vision, "what if" ideas  │  │
│  │  • Feeds back into intent generation                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Intent Graph View ───────────────────────────────────┐   │
│  │  Visual map of all intents + connections + statuses     │  │
│  │  Linked to GAC queue and blockers                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  Strong connections to: Wiki, Knowledge Graph, Agent Hub     │
└──────────────────────────────────────────────────────────────┘
```

### How It Works

1. Agent analyzes current canon + intents and generates GAC cards
2. Each card has pre-filled answer options (informed by graph context)
3. Human reviews and answers — tap to select or freeform respond
4. Decisions go to canon, deferrals go to blockers queue
5. Aspirational statements detected across all user input go to aspirations log
6. Aspirations feed back into intent generation
7. The cycle continues — every answered question refines the design

---

## §9 — P2P Network & Infrastructure

### Topology

Every EMA instance is a **peer**. No central server required.

- **Regular peer**: Syncs data, runs agents, hosts services
- **Host peer**: Configurable role — dedicates more resources, routes AI calls
  for the org, takes on heavier workloads
- **Invisible peer**: Syncs data but donates zero compute resources. Machine
  is not available for dispatch or service hosting.

All peer roles are configurable through intuitive settings, not hard config files.

### Spaces & Nesting

```
Organization
├─ Team Alpha
│  ├─ Project X (space)
│  └─ Project Y (space)
├─ Team Beta
│  └─ Project Z (space)
└─ Shared Resources (space)
```

Spaces nest as org > team > project. Permissions cascade downward with
per-space overrides.

### Distributed Infrastructure

EMA manages **the entire homelab** of every machine in the organization:

- Self-hosted services are distributed across machines based on available resources
- When a machine goes offline, services **automatically redistribute** to
  maintain availability
- Different machines can fill different roles (storage, compute, hosting)
- The whole network maintains availability guarantees through self-healing
- Connected systems can be assigned roles to fill self-hosting gaps
- Distributed hosting and syncing of everything between machines

### Networking & Machine Access

- Agents can invoke any CLI tool on any machine in the network
- Full SSH/sudo access, scoped by space permissions
- P2P file sync between instances
- Dependencies (tmux, etc.) auto-installed as needed
- Compatible: Linux first, macOS second

### Authentication

Simple invite codes / shared secrets for now. More sophisticated auth
(LDAP, OAuth, keys) deferred for later phases.

---

## §10 — Comms & Notifications

### Communications

EMA has **built-in comms** with external tool integration:

- **Threaded chat** (Slack-style) for general conversation
- **Contextual comments** (Figma-style) on graph nodes, wiki pages, any content
- **Direct messages** between humans
- **External integrations** with existing tools (Slack, Discord, email, etc.)

Comms is a vApp (BrowserWindow) but also surfaces contextually across other vApps.

### Notifications

Full notification stack:

- **In-app**: Messages, badges on vApp icons
- **System tray**: OS-level notifications
- **Approval requests**: Agent proposals requiring human review
- **Alerts**: System events, agent completions, machine status changes
- **Notifications Hub**: Central vApp for managing all notifications

---

## §11 — The Migration

### Source: Tauri + Elixir (Old Build)

A full project exists with CLI, GUI, and build system. Contains:

- **Data models and entity schemas** — SALVAGE (port to TypeScript)
- **UI patterns and design tokens** — SALVAGE (port to CSS custom properties)
- **Architecture patterns (IPC, state management)** — SALVAGE (adapt for Electron)
- Build and deployment config — REWRITE for new stack

### Target: Electron + TypeScript (New Build)

The rebuild should:

1. **Preserve** — design tokens, entity relationships, UX patterns, naming
   conventions, architecture patterns
2. **Modernize** — TypeScript types, Electron IPC, web components, modern tooling
3. **Extend** — graph wiki, agent runtime, P2P mesh, research engine, vApp system

### Migration Strategy

An agent reads this genesis folder + the old repo to rebuild. The agent should:

- Extract data models from the Elixir codebase and port to TypeScript interfaces
- Extract design tokens and port to CSS custom properties
- Study IPC patterns and adapt for Electron's main/renderer architecture
- Preserve functionality and UX while modernizing the implementation

### Build Phases

```
Phase 0: Genesis (THIS) ──────────────────────────────────────────
  Status: COMPLETE
  • Define what EMA is
  • Create genesis folder structure
  • Establish canonical knowledge format
  • First intent + first execution

Phase 1: Foundation ──────────────────────────────────────────────
  Depends on: Phase 0
  • Electron app shell (launchpad, BrowserWindow management)
  • CLI scaffold (ema <noun> <verb> routing)
  • EMA Core library (shared by CLI and GUI)
  • Port entity schemas from old build
  • Design token system foundation

Phase 2: Agent Runtime ───────────────────────────────────────────
  Depends on: Phase 1
  • Puppeteer-style terminal emulator (xterm.js + node-pty)
  • tmux session orchestration (one per agent)
  • Claude Code + Codex wrapping and detection
  • Agent config ingestion (.claude/, .cursor/, etc.)
  • Terminal automation — read output, inject commands/context
  • Session recording + replay + searchable logs

Phase 3: Knowledge Engine ───────────────────────────────────────
  Depends on: Phase 1
  • Graph wiki engine (implementation TBD — see Superman reference)
  • Canon / Intents / Research layers
  • CRDT-based collaboration
  • Node CRUD via CLI and GUI
  • Web wiki frontend (Wikipedia-style)
  • Search and traversal

Phase 4: Self-Building ───────────────────────────────────────────
  Depends on: Phase 2 + Phase 3
  • EMA reads its own canon to understand itself
  • Blueprint vApp with GAC queue, blockers, aspirations
  • Intent → Proposal → Execution pipeline end-to-end
  • Agent proposes work, human approves
  • Executions write back to canon
  • EMA develops itself through itself

Phase 5: Research & Feeds ───────────────────────────────────────
  Depends on: Phase 3
  • Research ingestion pipeline (YouTube, Reddit, arxiv, etc.)
  • Context graph dedup (embeddings + LLM health maintenance)
  • Feeds vApp (AI-curated discovery)
  • Cron scheduling + on-demand queries
  • MCP interface for external agents

Phase 6: P2P & Infrastructure ──────────────────────────────────
  Depends on: Phase 1
  • P2P sync network
  • Host peer / invisible peer configuration
  • Cross-machine agent dispatch
  • Distributed service hosting
  • Self-healing redistribution
  • Space nesting (org > team > project)

Phase 7: Platform ────────────────────────────────────────────────
  Depends on: All above
  • vApp development SDK/DX
  • Git-based vApp installation
  • Third-party vApp support
  • Full vApp catalog operational
  • External comms integrations
```

### Timeline

Year-long build. The agent's virtual planning schedule (a vApp itself) manages
the timeline with progress tracking. Phases are dependency-ordered, not
date-ordered. Some phases can run in parallel (e.g., Phase 3 + Phase 6).

---

## §12 — Agent Instructions

When an agent reads this document to work on EMA, follow these rules:

### DO

- Read the full genesis folder before starting work
- Check `intents/` for open intents before proposing new work
- Check `proposals/` for existing proposals before duplicating
- Write all outputs to the appropriate canonical location
- Link new nodes to existing nodes via connections
- Preserve design tokens, naming conventions, entity relationships, and
  architecture patterns from the old build
- Ask for human approval before modifying canon nodes marked as `active`
- Append to §14 (Execution Log) after completing work
- Create new intents for discovered sub-work
- Defer questions you can't answer to the blockers queue

### DO NOT

- Treat Discord messages, chat history, or scattered notes as authoritative
- Create new knowledge outside the canonical folder structure
- Delete or overwrite execution records
- Redesign core entities without an approved intent + proposal
- Ignore the old codebase — it contains real design decisions worth porting
- Build a custom LLM agent — wrap existing CLI agents instead

### CONTEXT ASSEMBLY

When preparing to work, assemble context in this order:

1. This genesis document (always)
2. The specific intent being worked on
3. Related canon nodes (via graph connections)
4. Relevant schemas
5. The proposal being executed
6. Prior executions on the same intent (if any)
7. Old codebase files (only if explicitly needed for porting)

---

## §13 — Self-Building Loop

This is EMA's self-building cycle:

```
   ┌──────────────────────────────────────────┐
   │                                          │
   ▼                                          │
READ canon + intents                          │
   │                                          │
   ▼                                          │
IDENTIFY gaps / next work                     │
   (Blueprint vApp: GAC queue)                │
   │                                          │
   ▼                                          │
CREATE proposal (agent)                       │
   │                                          │
   ▼                                          │
APPROVE proposal (human)                      │
   (configurable auto-approve levels)         │
   │                                          │
   ▼                                          │
EXECUTE work                                  │
   │                                          │
   ▼                                          │
WRITE results → canon + update intents ───────┘
   (aspirations extracted → new intents)
```

### Rules

1. **Canon over stale** — EMA prefers its own canonical graph over old docs,
   chat history, or scattered notes
2. **One source of truth** — duplicate knowledge consolidates into one canon
   node, others flagged as mirrors/deprecated
3. **Append-only history** — executions are never deleted, only superseded
4. **LLM decides, human approves** — agent proposes, human reviews
5. **Genesis is node zero** — this document and folder are the graph root
6. **Everything versioned** — full audit trail on all changes
7. **Aspirations feed intents** — goals detected in user input become intents

### CLI Commands

The EMA CLI follows `ema <noun> <verb>` convention. The full command surface
covers 150+ commands across all system domains. During bootstrap, a minimal
subset is implemented first, expanding as capabilities come online.

**Command domains** (not exhaustive):

```
ema canon <verb>       # Knowledge management (search, read, write, list)
ema intent <verb>      # Intent lifecycle
ema proposal <verb>    # Proposal lifecycle
ema exec <verb>        # Execution tracking
ema queue <verb>       # Work queue and suggestions
ema graph <verb>       # Graph operations
ema agent <verb>       # Agent management and dispatch
ema machine <verb>     # Machine access and management
ema space <verb>       # Space/org/team management
ema feed <verb>        # Feed configuration and queries
ema research <verb>    # Research ingestion triggers
ema peer <verb>        # P2P network management
ema service <verb>     # Self-hosted service management
ema config <verb>      # System configuration
```

> **SUBAGENT TASK:** Full CLI command specification is deferred to an agent
> work session. Agent should read the old Tauri/Elixir CLI implementation,
> the genesis docs, and the vApp + agent tool catalogs, then propose a
> comprehensive CLI command tree. See `intents/INT-006/` for this task.

---

## §14 — Execution Log

> Append-only. Grows with each execution.

### EXE-000: Genesis

- **Intent:** INT-001 — Bootstrap EMA self-knowledge system
- **Proposal:** PROP-001 — Create genesis documents and starter folder
- **Status:** Completed
- **Date:** 2026-04-11
- **Agent:** Claude (via claude.ai brainstorming session)
- **Human:** Project lead
- **Outputs:**
  - `EMA-GENESIS-PROMPT.md` (this file — v0.2, post-brainstorm revision)
  - `SCHEMATIC-v0.md` (architecture overview)
  - `_meta/GRAPH-CONVENTIONS.md`
  - `schemas/` — node, actor, space, team, intent schemas
  - `intents/INT-001` through `INT-005`
  - `vapps/CATALOG.md` — full vApp catalog
  - `_meta/DEFERRED.md` — blockers and deferred decisions
  - `_meta/BRAINSTORM-LOG.md` — full decision log from brainstorm
- **Key Decisions:**
  - EMA is agent+human workspace, open source, self-hosted, P2P
  - Agents controlled via puppeteer terminal emulator (xterm.js + tmux), not custom-built
  - Graph wiki with 4 layers: wiki, canon, intents, research
  - Context graph engine with native dedup + LLM health maintenance
  - vApps are web components in BrowserWindows, not sandboxed plugins
  - Full machine access + cross-machine dispatch across P2P network
  - Distributed self-healing homelab management
  - Blueprint vApp = formalized system design tool (mirrors this brainstorm)
  - Feeds = unified AI-curated discovery (renamed from Channels)
  - CRDTs for real-time collaboration
  - Everything versioned and auditable
  - Year-long build, agent-paced virtual schedule
  - Linux first, macOS second

---

## §15 — Canonical Knowledge Map

### Canonical (Trust These)

| Source | Location | Status |
|--------|----------|--------|
| Genesis prompt | `EMA-GENESIS-PROMPT.md` | canonical |
| Schematic | `SCHEMATIC-v0.md` | canonical |
| Graph conventions | `_meta/GRAPH-CONVENTIONS.md` | canonical |
| Entity schemas | `schemas/` | canonical |
| Intent folders | `intents/` | canonical |
| Proposal folders | `proposals/` | canonical |
| Execution records | `executions/` | canonical |
| vApp catalog | `vapps/CATALOG.md` | canonical |
| Deferred decisions | `_meta/DEFERRED.md` | canonical |
| Brainstorm log | `_meta/BRAINSTORM-LOG.md` | canonical |

### Reference (Learn From, Don't Trust Blindly)

| Source | Status | Action |
|--------|--------|--------|
| Old Elixir/Tauri codebase | reference | Extract data models, design tokens, IPC patterns. Port, don't copy. |
| Superman project | reference | Study graph/wiki/context architecture. Learn, don't fork. |
| EMA Landscape Research | reference | Competitive analysis for positioning. |

### Deprecated

| Source | Status | Action |
|--------|--------|--------|
| Discord/chat history | deprecated | Extract unique decisions into canon, then ignore. |
| Scattered local notes | needs-audit | Consolidate into canon or deprecate. |

---

## §16 — Open Questions (Parking Lot)

These need resolution via future intents. See also `_meta/DEFERRED.md` for
the full blockers and deferred decisions list.

1. **Graph engine**: Build custom, adapt Superman, or use existing (Gun.js, etc.)?
2. **CRDT engine**: Yjs vs Automerge vs Loro — affects graph storage, sync, collab
3. **Agent protocol**: How agents scope access and communicate with workspace
4. **Electron architecture**: Main process vs renderer, IPC contract details
5. **Offline-first**: Sync strategy for multi-device, multi-user
6. **Old build audit**: Systematic review of Elixir data models
7. **Code editor vApp**: Deferred — Superman project may cover
8. **Domain/DNS**: How web wiki and mirrors get exposed
9. **Mobile**: Deferred beyond web mirror access
10. **Internationalization**: English only for now

---

*This document is node zero. The graph starts here.*
