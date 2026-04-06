# LaunchpadHQ — Consolidated Planning Document

**Migrated:** 2026-04-05
**Sources:** Claude Code memory (2 projects), .superman intents, superpowers specs/plans, shared/inbox-host task files, shared/inbox-vm Discord analysis, brainstorm HTML mockups
**Status:** Phase 2 in progress — backend execution loop proven, frontend HQ timeline not built

---

## Table of Contents

1. [What Is LaunchpadHQ](#what-is-launchpadhq)
2. [Architecture Principles](#architecture-principles)
3. [Launchpad — The Window Hub](#launchpad--the-window-hub)
4. [HQ — The Execution Surface](#hq--the-execution-surface)
5. [Execution Model](#execution-model)
6. [Intent Folder System](#intent-folder-system)
7. [Four Priority Features](#four-priority-features)
8. [Discord Replacement Map](#discord-replacement-map)
9. [Core Loop Wiring](#core-loop-wiring)
10. [API Surface](#api-surface)
11. [Sprint Plan](#sprint-plan)
12. [Anti-Patterns from Discord](#anti-patterns-from-discord)
13. [Agent Performance Baselines](#agent-performance-baselines)
14. [Implementation Status](#implementation-status)
15. [Source Index](#source-index)

---

## What Is LaunchpadHQ

LaunchpadHQ is the convergence of two EMA subsystems:

- **Launchpad** = the always-open window hub, app tile grid, workspace manager. The *home screen*.
- **HQ** = the execution timeline surface showing what is running, what ran, and what it produced. The *runtime view*.

Together they form the primary user interface for EMA — replacing Discord as the command center for dispatching work, monitoring agents, and reviewing results.

**Design invariant:** "HQ is a timeline of executions; EMA is the intention layer."

LaunchpadHQ is not a separate app or service. It lives inside EMA — Launchpad as the entry point window, HQ (ExecutionsApp) as one of the core apps accessible from it.

---

## Architecture Principles

_Source: .superman/intents/execution-first-ema-os/research.md_

**P1: Intent is semantic; Execution is runtime.**
Intent lives as markdown in `.superman/intents/<slug>/`. Execution is a DB row. One intent can have many executions. They reference intents; they never replace them.

**P2: `.superman/` is durable project memory.**
DB is runtime state (can be wiped). `.superman/` is semantic ground truth (survives DB resets).

**P3: No vague delegation.**
Every agent dispatch requires a structured packet: execution_id, objective, success_criteria, read_files, write_files, constraints, mode.

**P4: Results patch back into semantic state.**
Completed executions write to `result.md`, append to `execution-log.md`, update `status.json`.

**P5: HQ is a timeline of executions; EMA is the intention layer.**
HQ renders runtime state. EMA shapes what should be done. Separate surfaces, different data sources.

**P6: All executions require approval by default.**
`requires_approval` defaults to `true`. Autonomous dispatch is opt-in.

**P7: Execution modes determine agent behavior.**
Six modes: `research | outline | implement | review | harvest | refactor`. Each implies different prompt templates and expected outputs.

**P8: agent_sessions is separate from claude_sessions.**
`claude_sessions` = passive filesystem mirror. `agent_sessions` = EMA's controlled dispatch record.

---

## Launchpad — The Window Hub

_Sources: docs/superpowers/specs/2026-03-29-ema-multiwindow-design.md, .superpowers/brainstorm HTML mockup_

### What It Is
- Primary window that always opens on startup (900x650, min 700x500)
- Central command center with workspace management
- Glass morphism aesthetic (dark void, frosted blur, teal/blue/amber accents)
- Replaces old single-window sidebar navigation

### Components
- **Ambient Strip** (32px) — custom titlebar with clock, window controls, drag region
- **Dock** (56px left sidebar) — app icons with green running indicators
- **App Tile Grid** (4 columns) — live glanceable data per app
- **Greeting** — personalized ("Good afternoon, Trajan") with date
- **One Thing Card** — current focus item
- **Command Bar** (Ctrl+K) — search and quick actions

### Window Behavior
- Close = minimize to tray (not exit)
- Global shortcut: `Super+Shift+Space` to toggle visibility
- Workspace restoration on startup (except Launchpad itself — always open)

### Implementation
- Component: `app/src/components/layout/Launchpad.tsx` (exists)
- Tauri config: window label "launchpad" in `tauri.conf.json` (exists)
- Route: default `/` in `App.tsx` (exists)
- Window manager skip: `window-manager.ts` line 56 (exists)

---

## HQ — The Execution Surface

_Sources: .claude memory project_hq_vision.md, .superman/intents/execution-first-ema-os/signals.md_

### What It Is
HQ is where EMA shows what *is actually happening* — live runtime state of every agent dispatch, progress, events, results.

- **EMA** = intention/readiness layer (proposals, seeds, the pipeline)
- **HQ** = execution layer (DB-backed Execution objects, status timelines, agent sessions, harvested results)

### What HQ Shows
1. **Execution Timeline** — chronological stream of work units with status
2. **Live Status Updates** — real-time WebSocket pushes, pulsing indicators for running executions
3. **Intent Folder Browser** — browse `.superman/intents/` directly
4. **Delegation Packet Inspector** — view structured packets sent to agents
5. **Result Harvesting View** — side-by-side intent.md vs result.md
6. **Agent Session Linker** — auto-link Claude Code sessions to executions

### What HQ Is NOT
- Not a proposal manager (that's ProposalsApp)
- Not an agent chat interface (that's AgentsApp)
- Not the vault browser (that's VaultApp)
- Not a task tracker (that's TasksApp)

**Single responsibility:** Show what is running, what ran, and what it produced.

---

## Execution Model

_Source: .superman/intents/execution-first-ema-os/outline.md_

### The Execution Object

Every unit of work is an Execution — a DB row linking:
1. **Source** — brain dump item, proposal, or manual trigger
2. **Intent** — semantic description in `.superman/intents/<slug>/`
3. **Agent Session** — the Claude Code run dispatched by AgentWorker
4. **Result** — written back to `intent_path/result.md`

### Status Lifecycle

```
created → proposed → awaiting_approval → approved → delegated → running → harvesting → completed
                                                                                    ↓
                                                                                cancelled
                                                                                failed
```

### Schema (executions table)

Key fields:
- `id` (string, 8-byte random base64)
- `title`, `mode`, `status`, `objective`
- `intent_slug`, `intent_path` (link to .superman/ folder)
- `requires_approval` (boolean, default true)
- `brain_dump_item_id`, `proposal_id`, `task_id`, `session_id`
- `metadata` (map, stores result_summary on completion)

### Delegation Packet Structure

```json
{
  "execution_id": "u7NFG_WdyTg",
  "project_slug": "ema",
  "intent_slug": "execution-first-ema-os",
  "agent_role": "implementer",
  "objective": "...",
  "mode": "implement",
  "requires_patchback": true,
  "success_criteria": ["..."],
  "read_files": ["..."],
  "write_files": ["..."],
  "constraints": ["..."]
}
```

---

## Intent Folder System

_Source: .superman/intents/execution-first-ema-os/outline.md_

### Directory Structure

```
.superman/
  project.md              # Project identity
  context.md              # Current state, gaps, invariants
  inbox/                  # Unprocessed items
  intents/
    <slug>/               # One folder per intent (kebab-case)
      intent.md           # What + why (human-readable)
      signals.md          # Architecture signals captured
      decisions.md        # Numbered decisions (D1, D2...) with rationale
      research.md         # Research-mode output
      outline.md          # Outline-mode output
      plan.md             # Concrete implementation plan
      result.md           # Most recent execution output
      execution-log.md    # Append-only log of all executions
      status.json         # Machine-readable state
```

### status.json Schema

```json
{
  "slug": "string",
  "status": "idle | in_progress | blocked | completed | abandoned",
  "phase": 1,
  "clarity": 8,
  "energy": 9,
  "latest_execution_id": "string | null",
  "open_questions": ["string"],
  "completion_pct": 0,
  "last_updated": "ISO8601"
}
```

### Creation Rules
1. **From BrainDump:** Auto-create via `IntentFolder.slugify(content)` — folder gets `intent.md` + `status.json`
2. **From REST API:** `POST /api/executions` with `intent_slug` auto-creates if missing
3. **Manual:** User creates folder + intent.md directly

---

## Four Priority Features

_Source: .claude memory project_hq_passover.md — Weeks 7-8_

### 1. Dispatch Board
Live panel of in-flight tasks: status, elapsed time, agent assignment.
**Status:** Controller + channel exist. Timeline UI needs work.

### 2. Scope Advisor
Warns on task creation if similar agent+scope combos timed out before.
**Status:** Not started. Needs historical timeout data correlation.

### 3. Deliberation Gate
Structural tasks auto-route through Proposals before agent spawn.
**Status:** Not started. Requires proposal-execution wire (EX-005 done).

### 4. Reflexion Injection
Inject last 3 similar outcomes into agent prompt context on spawn.
**Status:** Not started. Requires outcome storage + similarity search.

---

## Discord Replacement Map

_Source: shared/inbox-host/ema-virtual-apps-brainstorm.md_

| Discord Channel | What Happens There | EMA App Replacement |
|---|---|---|
| `#dispatch` | Task → agent routes → result returns | Bridge + Tasks + Agents |
| `#concierge` | Casual questions, quick lookups | Jarvis or Bridge |
| `#desk` (forum) | Task tracking, kanban via forum tags | Tasks (TaskBoard.tsx) |
| `#agent-feed` | Agent status updates, dispatch notifications | Agent Fleet |
| `#worklog` | Daily summaries, cron results | Executions (HQ) |
| `#evolution-log` | Prompt changes, skill updates | Evolution dashboard |
| `#vault-feed` | Vault writes by agents | Vault app |
| `#heartbeat` | System health checks | VM Health + Service Dashboard |
| `#ops-log` | Infrastructure events | Service Dashboard |
| Voice channels | Ambient status text | Orb / ambient strip |

### Current Metaprompting Workflow (to replace)

```
1. Trajan has an idea
2. Types in Discord #dispatch (or Claude Code on host)
3. Right Hand (OpenClaw) reads it
4. Right Hand classifies intent, picks agent
5. Agent spawns (Claude Code CLI on VM)
6. Agent works, streams output to Discord thread
7. Result posted to Discord
8. Trajan reads result, decides next step
9. Vault maybe updated (manual)
10. Outcome maybe tracked (manual)
```

**What's lost:** No traceability, no metrics, no prompt versioning, no automated learning. Context dies between sessions.

### Target Flow (inside EMA)

```
Trajan types in Bridge → EMA classifies intent → Agent dispatches →
Streaming progress visible → Result in Tasks → Vault updated →
Outcome tracked → Metrics updated → Next request smarter
```

---

## Core Loop Wiring

_Source: shared/inbox-host/ema-virtual-apps-brainstorm.md_

### What needs to happen:
1. `claude-bridge` app POSTs to `/api/tasks/dispatch` (not just `/api/claude/sessions`)
2. `tasks` app needs WebSocket for real-time status
3. `agent-fleet` needs live agent status
4. `executions` (HQ) needs to show the timeline
5. `vault` needs to reflect writes in real-time

### Bootstrap requirements:
- Agent roster (from AGENTS.md) → `agents` table
- Routing rules → `routing_rules` table
- Prompts (SOUL.md, agent CLAUDE.md files) → `prompts` table

---

## API Surface

_Source: .claude memory project_ema_api_surface.md_

### HQ-Specific Endpoints

```
GET  /api/executions              # list all, with status filters
GET  /api/executions/:id          # single execution with full details
POST /api/executions              # create
POST /api/executions/:id/approve  # approve pending
POST /api/executions/:id/cancel   # cancel running
GET  /api/executions/:id/events   # event log for timeline view
GET  /api/executions/:id/agent-sessions
POST /api/executions/:id/complete # mark complete with result metadata
GET  /api/intents/:project_slug/:intent_slug/status
```

### WebSocket Channel

Topic: `executions:lobby`
Events: `execution_created`, `status_changed`, `event_added`

### PubSub Topics

| Topic | Messages | Producer | Consumer |
|-------|----------|----------|----------|
| `"executions"` | `execution:created/updated/completed` | Ema.Executions | ExecutionChannel, Pipes EventBus |
| `"executions:dispatch"` | `{:dispatch, execution}` | Executions.dispatch_if_ready | Dispatcher |

---

## Sprint Plan

_Source: .superman/intents/execution-first-ema-os/plan.md_

### Sprint 1: Backend Correctness (COMPLETED 2026-04-03)

| ID | Task | Size | Status |
|----|------|------|--------|
| EX-002 | Fix Dispatcher + completion path | S | DONE |
| EX-003 | Create IntentFolder module + wire into BrainDump | M | DONE |
| EX-004 | Completion REST endpoint | S | DONE |
| EX-005 | Wire link_proposal into ProposalEngine | S | DONE |

### Sprint 2: Frontend (NOT STARTED)

| ID | Task | Size | Status |
|----|------|------|--------|
| EX-006 | ExecutionChannel + execution-store.ts | M | Not started |
| EX-007 | ExecutionsApp — HQ timeline | L | Not started |

### Sprint 3: Proof (NOT STARTED)

| ID | Task | Size | Status |
|----|------|------|--------|
| EX-008 | Self-referential test — complete this intent end-to-end | S | Not started |

### Beyond: Week 7-8 Plan

_Source: shared/inbox-host/ema-virtual-apps-brainstorm.md_

**Week 7a (3 days):** Wire Bridge → dispatch API → Tasks board updates → Agent Fleet live state → one end-to-end dispatch
**Week 7b (2 days):** Config bootstrap (agents, prompts from disk → DB), Prompt Workshop reads from DB
**Week 8a (3 days):** Intent classifier (Router), context injector, outcome tracking, metrics
**Week 8b (2 days):** Wiki virtual app, vault graph wired, cross-linking
**Week 9:** Prompt metrics dashboard, A/B test framework, weekly optimizer

---

## Anti-Patterns from Discord

_Source: shared/inbox-vm/discord-patterns-2026-03.md_

### AP-1: Auth Source Proliferation
Three competing auth sources (`~/.claude/.credentials.json`, `~/.dispatch-env`, `~/.openclaw/.env`) with no single owner. Stale keys cause cluster failures.

### AP-2: Scope Miscalibration
Vault Keeper dispatched on full-vault tasks (293+ files) with 5min timeouts → always times out. Hard limit needed: <=50 files per dispatch.

### AP-3: No Retry Logic on Scheduled Tasks
Cron-based intel tasks have no retry/backoff. During outages, failures accumulate silently.

### AP-4: Session Context Saturation
Long-running sessions hit context limits mid-task. No proactive context handoff. Agents die without writing CONTINUE.md.

### AP-5: Obfuscation Detection False Positives
Gateway blocks legitimate shell scripts (loop constructs, heredocs). Rules too aggressive for dedicated agent VM.

---

## Agent Performance Baselines

_Source: shared/inbox-vm/discord-patterns-2026-03.md (March 2026)_

| Agent | Fitness | Status |
|-------|---------|--------|
| Prompt Engineer | 1.00 | Star performer — fast, targeted, reliable |
| Ops | 0.92 | Solid and reliable for infra tasks |
| Vault Keeper | 0.54 | Scope-sensitive — needs hard file count constraints |
| Researcher | 0.46 | External API latency issues — needs 8min+ timeout |
| Coder | 0.20 | Low from infra failure, not agent quality |
| Security, Scout, Devil's Advocate, Concierge, Strategist | untested | 5 of 10 agents never deployed |

### Proposed New Agents
1. **Executive Functioning Agent (EFA)** — morning synthesis, active check-ins, task queue management
2. **Ingestor-Dispatcher (ID)** — automated research → extract → dispatch pipeline
3. **Peer Review / Prompt Consultant (PRC)** — intercept and score prompts before dispatch

---

## Implementation Status

### Working
- Launchpad component, Tauri config, route, window manager (all exist)
- `executions` + `execution_events` + `agent_sessions` tables (migrated)
- `Ema.Executions` context module (CRUD + lifecycle functions)
- `ExecutionController` + REST routes (all 8 endpoints)
- `ExecutionChannel` WebSocket (exists)
- `Ema.Executions.Dispatcher` (fixed — local Claude dispatch works)
- `Ema.Executions.IntentFolder` (create, write_result, append_log, update_status)
- BrainDump → Execution wire (create_item creates intent folder + execution)
- Proposal → Execution link (generator.ex links proposal to execution)
- `.superman/` folder structure with working intent

### Not Started
- `ExecutionsApp` React component (HQ timeline UI)
- `execution-store.ts` Zustand store
- Scope Advisor
- Deliberation Gate
- Reflexion Injection
- Config bootstrap (agents/prompts from disk → DB)
- Intent classifier / Intelligence.Router
- Context injector for AI calls
- Wiki virtual app
- Prompt Workshop as metaprompting hub
- A/B testing framework

### In Worktree Branches (built, not merged to main)
- Superman.Context.for_project/2
- Proposal API contract normalization
- BridgeDispatch (async dispatch with tracking, retries)
- SeedPreflight quality gate
- Claude Failure Taxonomy + preflight checks
- Brain Dump → Proposal Loop (embedding clusters)
- OpenClaw Vault Sync (rsync mirror)

---

## Source Index

All original documents that were consolidated into this file:

| # | Source | Location | What It Contains |
|---|--------|----------|------------------|
| 1 | HQ Vision | `.claude/projects/-home-trajan-Projects/memory/project_hq_vision.md` | Execution object design, REST API, WebSocket, intent folders, priority features |
| 2 | HQ Passover | `.claude/projects/-home-trajan-Projects-ema/memory/project_hq_passover.md` | Architecture decisions, four priority features, Phase 2 status, contradictions |
| 3 | EMA API Surface | `.claude/projects/-home-trajan-Projects/memory/project_ema_api_surface.md` | All 350+ REST endpoints, 34 channels, store pattern |
| 4 | EMA Architecture | `.claude/projects/-home-trajan-Projects/memory/project_ema_architecture.md` | Three-layer stack, 5 OTP trees, pipeline flow, execution model |
| 5 | Execution Intent | `.superman/intents/execution-first-ema-os/intent.md` | Core intent statement, success criteria |
| 6 | Execution Signals | `.superman/intents/execution-first-ema-os/signals.md` | Architecture signals from 2026-04-03 design session |
| 7 | Execution Decisions | `.superman/intents/execution-first-ema-os/decisions.md` | 10 numbered decisions (D1-D10) with rationale |
| 8 | Execution Research | `.superman/intents/execution-first-ema-os/research.md` | 8 principles, runtime model, 10 gaps, 8 questions |
| 9 | Execution Outline | `.superman/intents/execution-first-ema-os/outline.md` | Filesystem spec, 3-table schema, event flow, module boundaries, build order |
| 10 | Execution Plan | `.superman/intents/execution-first-ema-os/plan.md` | Sprint plan (EX-002 through EX-008), invariants |
| 11 | Execution Log | `.superman/intents/execution-first-ema-os/execution-log.md` | Completed sprints: research/outline + Sprint 1 implement |
| 12 | Multiwindow Design | `docs/superpowers/specs/2026-03-29-ema-multiwindow-design.md` | Launchpad as window hub, Tauri 2 multi-window architecture |
| 13 | Multiwindow Plan | `docs/superpowers/plans/2026-03-29-ema-multiwindow-implementation.md` | Implementation tasks for Launchpad/Dock/Chrome |
| 14 | Virtual Apps Brainstorm | `~/shared/inbox-host/ema-virtual-apps-brainstorm.md` | 52 apps inventory, Discord replacement map, core loop wiring, week 7-9 plan |
| 15 | Brain Backend Task | `~/shared/inbox-host/vm--ema-brain-backend-task.md` | Session HQ endpoints, ApiKey adapter, Sessions registry |
| 16 | W7 Build Task | `~/shared/inbox-host/vm--ema-w7-build-task.md` | OpenClaw Client fix, Dispatcher, CLI script with dispatch_board |
| 17 | Discord Patterns | `~/shared/inbox-vm/discord-patterns-2026-03.md` | 5 anti-patterns, 5 capabilities, agent performance, 3 proposed agents |
| 18 | Launchpad Mockup | `.superpowers/brainstorm/666247-1774815930/content/ema-launchpad.html` | Visual HTML/CSS design spec for Launchpad layout |
| 19 | Project Context | `.superman/context.md` | Current system state, what exists, what's missing, design invariants |
