---
id: META-SELF-POLLINATION
type: meta
layer: _meta
title: "Self-Pollination Findings — module-by-module survival inventory from old build"
status: active
created: 2026-04-12
updated: 2026-04-12
author: self-pollination-explorer
connections:
  - { target: "[[_meta/CANON-STATUS]]", relation: references }
  - { target: "[[_meta/CROSS-POLLINATION-REGISTRY]]", relation: references }
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
  - { target: "[[DEC-002]]", relation: references }
tags: [meta, self-pollination, porting, inventory, old-build, migration]
---

# Self-Pollination Findings

> **Status:** Inventory generated 2026-04-12 from `/home/trajan/Projects/ema/IGNORE_OLD_TAURI_BUILD/` and `~/.local/share/ema/vault/wiki/`. This document answers: which parts of the old Elixir+Tauri build survive the migration to Electron+TypeScript, and which die.

## TL;DR

- **24 distinct findings** across schemas, pipelines, supervised systems, and architectural patterns
- **6 modules port directly** to TypeScript with structural fidelity (TIER PORT)
- **9 modules get replaced** by external repos surfaced in cross-pollination research (TIER REPLACE)
- **10 modules are dropped** entirely as architectural dead weight given the new stack (TIER DROP)
- **8 data models survive** with field-level fidelity, with augmentations from research
- The "90% porting, 10% net-new design" framing from the research gate was directionally right but the actual ratio is closer to **40% port / 30% replace / 30% drop**. The drop pile is bigger than expected because Tauri/Phoenix-specific machinery doesn't translate.

The TIER REPLACE column is the most important. It is where the Round 1 cross-pollination research pays for itself: instead of porting EMA's home-grown subsystems, the rebuild stands on shoulders of mature OSS that already solves the problem better.

---

## TIER PORT — lift directly to TypeScript with structural fidelity

These are the patterns that are **EMA-original** and **structurally sound**. The Elixir code dies; the design lives on in TypeScript with the same shapes.

| Old Elixir module | New TS target | Why port (not replace) | Effort |
|---|---|---|---|
| `Ema.Intents` (filesystem `.superman/intents/<slug>/` + DB index) | `services/intents/` + `workers/intent-watcher/` | Two-layer architecture (filesystem = source of truth, DB = queryable runtime) is unique to EMA and exactly right. Populator + IntentProjector pattern ports as Node file watchers (chokidar) emitting events into a SQLite index. | Medium |
| `Ema.Proposals.Pipeline` (Generator → Refiner → Debater → Tagger → Combiner → KillMemory) | `workers/proposal-pipeline/` | The 9-stage GenServer chain is unique and valuable. PubSub fan-out becomes Node EventEmitter or BullMQ. Each stage is its own Worker. The four-dimensional scoring (codebase coverage 30% + architectural coherence 25% + impact 30% + prompt specificity 15%) is pure logic. | High |
| `Ema.Pipes` (22 triggers + 15 actions + 5 transforms) | `services/pipes/` | Trigger/action registry is domain-agnostic and clean. EventBus broadcast → Node EventEmitter. Stock pipes (e.g., "Approved Proposal → Task") ship as TS objects. Transforms (filter, map, delay, conditional, claude) port directly. | Low–Medium |
| `Ema.Actors` (5-phase cadence + EntityData composite key + Tag polymorphic + PhaseTransition append-only log) | `services/actors/` | Phase cadence as a state machine in TypeScript. EntityData as composite-key store using `(actor_id, entity_type, entity_id, key)`. Tags as `(entity_type, entity_id, tag, actor_id, namespace)`. PhaseTransition is immutable writes only. All of this is plain SQLite. | Medium |
| `Ema.Executions.Dispatcher` + `intent_slug` coupling + reflexion injector | `workers/executions/` | Intent folder coupling (`intent_slug` decouples logical intent from filesystem location) is right. Reflexion (lessons from past executions prepended to new prompts) is right. Router classification heuristic is right. | Medium |
| `Ema.MCP` (25 tools + 11 resources + recursion guard + cost tracking) | `services/mcp/` | JSON-RPC 2.0 protocol layer ports unchanged. Tool registry becomes a TypeScript object. Resource URIs (`ema://intents/active`, `ema://intents/tree`) map to HTTP handlers. Recursion guard via in-memory Map. Cost tracking pattern becomes async fire-and-forget. | Low |

### Why these specifically

All six are subsystems where EMA has built something **distinctive** that doesn't have a clean off-the-shelf replacement. The Intent two-layer pattern, the Proposal pipeline's four-dimensional scoring, the Pipes registry, the Actors phase cadence — none of these are off-the-shelf. They're EMA's contribution and they should survive the rewrite.

---

## TIER REPLACE — drop in favor of external repo surfaced in research

These are subsystems where the old build was **reinventing what someone else already shipped better**. Round 1 cross-pollination research surfaced production-grade replacements. The TS rebuild should use those instead of porting Elixir code.

| Old Elixir module | Replace with | Status | Notes |
|---|---|---|---|
| `Ema.SecondBrain.VaultWatcher` + `GraphBuilder` + `SystemBrain` | `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` Object Index pattern (port) **OR** depend on `[[research/knowledge-graphs/iwe-org-iwe]]` (Rust binary + MCP server) | DECIDED in `[[DEC-001]]` | The pattern is right but SilverBullet did it cleaner. iwe gives EMA the agent-facing API for free if depended on as a binary. |
| `Ema.Claude.Runner` (shells out to `claude` CLI with 120s timeout) | `[[research/cli-terminal/microsoft-node-pty]]` + `[[research/cli-terminal/xtermjs-xterm_js]]` + tmux wrapper following `[[research/cli-terminal/Ark0N-Codeman]]` 6-layer streaming pipeline | RECOMMEND | Codeman's pipeline (PTY → 16ms server batch → DEC 2026 wrap → SSE → client rAF → xterm.js) is the production-grade rewrite of the current Runner. Add ghost session discovery for daemon-restart recovery. |
| `Ema.ClaudeSessions.SessionWatcher` (Claude-only, 30s polling) | `[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]` (CASS — bundle as binary or copy the 11-provider discovery table) | RECOMMEND | Multi-provider session indexing covering Claude/Codex/Cursor/Aider/Gemini/Cline/Amp etc. EMA's current single-provider watcher is a time bomb. |
| `Ema.Bridge.NodeCoordinator` + `SyncCoordinator` + `ClusterConfig` (libcluster + DeltaCrdt + Tailscale topologies) | `[[research/p2p-crdt/automerge-automerge-repo]]` (CRDT engine for structured data) **+** `[[research/p2p-crdt/syncthing-syncthing]]` (file folder sync for vault) | DECIDED in `[[DEC-002]]` | Bridge tries to do too much at once. Split: structured data → automerge-repo or Loro, wiki folders → Syncthing. |
| `Ema.Bridge` SmartRouter + circuit breakers + cost tracker | `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` (durable workflow + cross-node handoff) wrapping the multi-provider routing logic | RECOMMEND | Keep multi-provider routing as a function inside a durable workflow that handles cross-machine resume. DBOS-transact-ts is TS-native, SQLite-friendly, and the closest to EMA's stack. Round 2-A confirmed. |
| Frontend Zustand stores (67+ each calling `loadViaRest()` + `connect()` to Phoenix channels) | Electron preload `@ema/core` SDK following `[[research/vapp-plugin/logseq-logseq]]` `@logseq/libs` pattern + `[[research/vapp-plugin/smapiot-piral]]` shell API | RECOMMEND | The 67+ stores reinvent IPC. SDK + typed IPC kills it. One npm package, one preload bridge, every vApp imports the same surface. |
| Tauri shell + window manager + capabilities | `[[research/vapp-plugin/alex8088-electron-vite]]` + `[[research/vapp-plugin/electron-react-boilerplate-electron-react-boilerplate]]` patterns | RECOMMEND | Wholesale stack swap. Tauri is gone. |
| Glass CSS in `globals.css` (single file, Tauri-app-scoped) | `@ema/tokens` package built on `[[research/vapp-plugin/argyleink-open-props]]` multi-format token model + `[[research/vapp-plugin/style-dictionary-style-dictionary]]` build pipeline | RECOMMEND | Tokens become a package, not a CSS file. Postcss-jit-props for tree-shaking. 35 vApps need shared tokens via npm import, not file copy. |
| `Ema.AgentMemory` (naive >20-message summarization in `Ema.Agents.AgentSupervisor`) | `[[research/context-memory/Paul-Kyle-palinode]]` 5-verb DSL + `[[research/context-memory/thedotmack-claude-mem]]` staged retrieval + `[[research/context-memory/letta-ai-letta]]` core/recall/archival hierarchy | RECOMMEND | Current memory is the weakest link in long-horizon agent work. Palinode's proposes/executes pattern + Letta's three-tier budgeting + claude-mem's session-end compaction together replace the naive summarizer. |

### Why replace these

Each of the nine has a Round 1 repo that:
1. Solves the same problem with a cleaner architecture
2. Has more contributors and battle-testing than EMA could match alone
3. Either ports cleanly to TypeScript or can be depended on as a binary/sidecar
4. Reduces EMA's surface area to maintain

The research pays for itself most heavily here.

---

## TIER DROP — architectural dead weight given the new stack

These don't survive the migration at all. They're either Tauri-specific, Phoenix-specific, Erlang/OTP-specific, or have been made redundant by the stack swap.

| Old module / pattern | Why drop |
|---|---|
| `Ema.AppShortcuts` (Tauri global shortcut bindings) | Tauri-specific. Electron has `globalShortcut` module built in. |
| `Ema.Workspace.WindowState` (per-app window position persistence) | Replaced by `electron-window-state` or `electron-store`. |
| `Phoenix.PubSub` (cross-process within daemon) | Replaced by Node EventEmitter or BullMQ within a single process. |
| `Phoenix.Channels` (frontend ↔ daemon WebSocket) | Replaced by Electron IPC + preload bridge. No more WebSocket-as-IPC. |
| `ecto_sqlite3` | Replaced by `better-sqlite3` (synchronous, fast, no callback hell) or `libsql` (forked SQLite with replication). |
| Ecto migrations | Replaced by `drizzle-kit` or `kysely-codegen`. |
| OTP supervision tree (`one_for_one`, `rest_for_one`, dynamic supervisors) | Replaced by Node process supervision (`pm2`) for daemon-level concerns and `worker_threads` for in-process concerns. The supervision *patterns* (rest_for_one as a dependency model) are worth remembering as design insight, but the runtime is gone. |
| Tauri capabilities/permissions JSON | Replaced by Electron `contextIsolation` + `contextBridge`. Different security model entirely. |
| `mix precommit` (compile-with-warnings + format-check + test) | Replaced by `tsc --noEmit` + `biome check` + `vitest run` precommit hook. |
| `Ema.Bridge.cluster_config.ex` libcluster topologies (local EPMD, Tailscale, manual, DNS) | Replaced by Loro/Automerge transport adapters + Syncthing introducers + Tailscale at the network layer. The discovery problem moves to the sync layer. |
| `Ema.VaultIndex` (scaffolded, never finished) | Overlapped with `SecondBrain` even in the old build. The new Object Index (`[[DEC-001]]`) replaces both cleanly. |
| `Ema.Notes` (scaffolded, simple notes) | Same as VaultIndex — Object replaces Note as the atomic unit. |
| `Ema.Goals` (scaffolded, no UI, no business logic) | Re-implement as Intents with `kind: goal`. No separate schema needed. |
| `Ema.Focus` (scaffolded, no UI, no GenServer) | Re-implement as workspace state (per `[[canon/specs/EMA-V1-SPEC]]` §3 storage boundary), not canonical graph. |
| Discord/Telegram channel adapters (stubs needing nostrum/ex_gram deps) | Drop the stubs. If communication channels are still wanted in v2+, use TypeScript libraries (`discord.js`, `telegraf`). |

### Why drop these

Either: (a) the new stack provides a clean replacement built in, (b) the old code never worked, or (c) the abstraction was Tauri/Phoenix-shaped and doesn't translate.

---

## DATA MODELS THAT SURVIVE

These schemas survive the migration with **field-level fidelity**, plus augmentations from cross-pollination research. The migration is mostly mechanical: Ecto schema → Drizzle/Kysely TypeScript schema with the same columns.

| Schema | New TS shape | Augmentations from research | Notes |
|---|---|---|---|
| `Intent` | `Intent { id, slug, title, level, kind, status, phase, parent_id, project_id, source_fingerprint, created_at, updated_at }` | **Add `exit_condition: string` and `scope: string[]`** per `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]` (mandatory before dispatch) | Two-layer (file + DB) per `[[DEC-001]]` and PORT tier above |
| `Proposal` | `Proposal { id, title, body, embedding, scores, generation, parent_proposal_id, status, created_at }` | **Add `state_doc_path: string`** per `[[research/self-building/gsd-build-get-shit-done]]` STATE.md pattern | Pipeline stages stay the same |
| `Execution` | `Execution { id, intent_slug, mode, status, executor_id, started_at, completed_at, outputs, decisions, learnings }` | **Add `progress_log_path: string`** per `[[research/self-building/snarktank-ralph]]` 3-file memory pattern. **Add `step_journal: ExecutionStep[]`** per `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` checkpoint protocol | New `ExecutionStep` schema for step-level checkpoints |
| `Actor` | `Actor { id, slug, actor_type, phase, capabilities, config, created_at }` | **Add `parent_actor_id: string?`** per `[[research/self-building/aden-hive-hive]]` 3-tier hierarchy (Worker → Judge → Queen) | Replaces flat actor list |
| `Task` | `Task { id, title, description, status, priority, due_at, started_at, completed_at, project_id, actor_id }` | **Add `started_at: timestamp?`** per `[[research/life-os-adhd/JackReis-neurodivergent-visual-org]]` (initiation celebration as first-class) | Existing schema only had completed_at |
| `Pipe` + `PipeAction` + `PipeTransform` + `PipeRun` | Same shapes | None | Direct port |
| `BrainDumpItem` | `BrainDumpItem { id, text, source, captured_at, drift_score?, parent_intent_id? }` | **Add `drift_score: number?`** per `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]` drift detection | Auto-captures from agent conversation drift |
| `Responsibility` | `Responsibility { id, role, cadence, health_score, completion_history }` | **Replace fixed `cadence` with `cadence_strategy: 'fixed'\|'adaptive'`** per `[[research/life-os-adhd/donetick-donetick]]` adaptive scheduling | Learns from completion patterns |
| `VaultNote` + `VaultLink` | **REPLACED by SilverBullet `Object` + `Edge`** | n/a | Per `[[DEC-001]]` — the Object Index replaces these as a category |
| `Habit` + `HabitLog` | Direct port | None | The old build's habit tracking is solid as-is |
| `Journal.Entry` | `JournalEntry { id, body, mood, energy, tags, written_at, extracted_aspirations? }` | **Add `extracted_aspirations: AspirationRef[]?`** per `[[canon/specs/BLUEPRINT-PLANNER]]` Aspirations Log auto-detection (depends on Round 2-E verdict) | Pending R2-E |
| `ClaudeSession` | `AgentSession { session_id, provider, project_path, started_at, ended_at, token_count, tool_calls, files_touched, summary }` | **Generalize `provider`** to Claude/Codex/Cursor/etc. per `[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]` | Multi-provider |

---

## PATTERNS THAT GET REPLACED

Architectural patterns from the old build, mapped to their successors:

| Old pattern | Successor (from research) | Why |
|---|---|---|
| Phoenix.PubSub fan-out for proposal pipeline | Node EventEmitter or BullMQ for the Worker chain | Same shape, TS-native runtime |
| GenServer per pipeline stage | Worker per pipeline stage (`worker_threads` or `bullmq` consumer) | Same isolation guarantees, TS-native |
| Ecto schemas with migrations | Drizzle/Kysely schemas with migrations | TS-native, type-inferring |
| 67+ Zustand stores each owning a REST + WS pair | One `@ema/core` SDK package + Electron preload bridge + per-vApp consumer | Eliminates IPC duplication |
| Glass CSS in `globals.css` | `@ema/tokens` package with multi-format export | Tree-shakable, importable, version-pinned per vApp |
| File watcher with 5s debounce polling | chokidar event-driven with 100ms debounce | Better latency, lower CPU |
| LLM-as-stub in pipes Claude transform | Real LLM bridge with `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` durable workflow wrapper | Resumable across machine death |
| AgentMemory naive >20-message summarization | Palinode 5-verb DSL + Letta 3-tier hierarchy + claude-mem session-end compaction | Three repos, one composite memory layer |
| Wiki↔DB sync via SecondBrain GenServers | SilverBullet Object Index pattern with chokidar + better-sqlite3 | Same shape, smaller surface |
| Cross-machine dispatch via libcluster + tunnels | DBOS workflow journal + Loro Repo transport over Tailscale | Resumable, cleaner separation |

---

## THE 6 S-TIER PORT PRIORITIES

If the rebuild has limited time and can only port 6 things from the old build before everything else gets replaced or dropped, port these in order:

1. **Intent system (filesystem `.superman/intents/<slug>/` + DB index)** — the two-layer architecture is EMA's most distinctive contribution. Get it working in TypeScript first; everything else hangs off it.
2. **Proposal pipeline (Generator → Refiner → Debater → Tagger → Combiner)** — the four-dimensional scoring + multi-stage critique is unique. Port the stages as Workers, keep the embedding-based dedup.
3. **Actor system (5-phase cadence + EntityData + Tag polymorphic + PhaseTransition)** — the workspace identity layer the new vApps will need from day one. Phase cadence as a state machine is clean.
4. **Pipes (trigger/action registry + transforms)** — domain-agnostic automation. Simple to port, immediately useful for "approved proposal → task" and similar default flows.
5. **Execution dispatcher (intent_slug coupling + reflexion injector + result.md writeback)** — the contract between intents and agent work. Combined with DBOS for resumability, this is the v1 execution layer.
6. **MCP tool registry (25 tools + 11 resources + recursion guard)** — agents need to talk to EMA. The protocol ports unchanged; just rewrite the handlers.

These six unblock everything else.

---

## ARCHITECTURAL DEAD WEIGHT (avoid copying)

These are patterns from the old build that look load-bearing but should NOT be reproduced in the new stack:

- **REST + WebSocket dual-channel from frontend to daemon.** The old build had `loadViaRest()` then `connect()` for every store. Electron IPC + preload eliminates this entirely — there's no "frontend ↔ daemon" boundary in Electron, just main ↔ renderer over IPC.
- **GenServer-per-everything (one_for_one supervised systems for SecondBrain, Pipes, Proposals, Responsibilities, Canvas).** OTP supervision is a great runtime model but Node doesn't have it. Workers + simple process supervision (pm2) cover 90% of the use case. Don't try to fake OTP.
- **Phoenix Presence** — replaced by Yjs `y-protocols/awareness` pattern (separate decision, see future `DEC-XXX-presence-protocol`).
- **`mix precommit` with compile warnings as errors** — the closest TS analog is `tsc --noEmit && biome check && vitest run`. The Elixir habit of "warnings = errors" should survive but the implementation is different.
- **Glass CSS as a single file** — must become a package. The 35 vApps cannot all import the same file.
- **AgentMemory naive >20-message summarization** — explicitly named as "the weakest link in long-horizon agent work" in the gap analysis. Don't port it. Replace it with Palinode + Letta + claude-mem.
- **Tauri-specific window chrome (AmbientStrip, AppWindowChrome, custom titlebar, traffic lights)** — Electron has different conventions. Re-derive the glass aesthetic for Electron's frame model.

---

## OPEN QUESTIONS FOR THE PORT

These need answers before Phase 2 (`ema-core` library):

1. **Bun, Deno, or Node?** Old build is Node-implicit. Round 1 surfaced Windmill (default Bun). For EMA's monorepo, recommend **Node 22+ with `tsx` for dev** to keep the matrix small. Worth a separate decision (`DEC-XXX-runtime`).
2. **Database: better-sqlite3, libsql, or PostgreSQL?** Old build is SQLite via Ecto. New build should also be SQLite (single-file, embedded, free in Electron). better-sqlite3 is the simplest path. libsql adds replication for free but locks you into Turso patterns.
3. **TypeScript ORM: Drizzle, Kysely, or raw SQL?** Strong recommendation: **Drizzle** for the schema-first ergonomics + migration generation. Kysely is more flexible but harder to learn.
4. **Worker runtime: BullMQ, Bee-Queue, or worker_threads?** For the proposal pipeline, **BullMQ** (Redis-backed) is overkill for a single-machine personal app. Recommend **worker_threads** with simple in-process queues. Revisit if cross-machine dispatch needs distributed workers.
5. **Design tokens build: Open Props CSS-only, or Style Dictionary multi-format?** Start with Open Props (zero build config). Add Style Dictionary if/when EMA needs mobile token export.

---

## CONNECTIONS

- `[[_meta/CANON-STATUS]]` — the ruling that says Genesis maximalist canon wins
- `[[_meta/CROSS-POLLINATION-REGISTRY]]` — the flat ranked source list (see TIER REPLACE column above for exact references)
- `[[research/_moc/RESEARCH-MOC]]` — research layer master index
- `[[canon/specs/EMA-V1-SPEC]]` §10 "What v1 actually is" — the minimum that needs to ship
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §11 The Migration — the original migration intent
- `[[DEC-001]]` — graph engine decision (covers SecondBrain replacement)
- `[[DEC-002]]` — sync split decision (covers Bridge replacement)
- `[[IGNORE_OLD_TAURI_BUILD/README]]` — what's in the archive and how to use it as a spec corpus

---

## APPENDIX A — FINE-GRAINED RECOVERY INVENTORY (2026-04-12)

> Round 2 pass: item-level mining of `IGNORE_OLD_TAURI_BUILD/` for commands, vApp catalog, design tokens, component patterns, voice, and hidden gems that the module-level survey above missed. Everything below is recoverable and should feed directly into the Blueprint queue.

### A.1 — CLI Command Surface (`ema <noun> <verb>`)

The old escript exposed 14 noun groups. This is the **API surface the new TS CLI must match or consciously drop**.

| Noun | Verbs | Notable flags |
|---|---|---|
| `vault` | tree, imports, stale, search | `--format`, `--limit` |
| `intent` | search, graph, list, trace, create, context, status, link | `--project`, `--days` |
| `proposal` | list, show, validate, approve, reject, generate, genealogy | `--seed`, `--status`, `--measure-latency` |
| `session` | state, list, crystallize, export | `--project`, `--limit` |
| `quality` | report, friction, gradient, budget, threats, improve | `--days=7` |
| `routing` | status, fitness, dispatch | `--project` |
| `health` | dashboard, check | — |
| `test` | run | `--suite=unit/integration/ai/stress/all` |
| `pipe` | list, show, create, toggle, catalog, history | `--trigger=manual:trigger` |
| `campaign` | list, show, create, run, advance, runs | — |
| `channel` | list, health, inbox, send, messages | `--message` |
| `ai-session` | list, show, create, resume, fork | `--project` |
| `evolution` | rules, signals, stats, scan, propose, activate, rollback | `--force` |
| `superman` | ask, context, health, index, gaps, flows | `--project`, `--force` |

Global: `--format=table|json|csv`, `--limit=N`, `--project=<id>`, `--days=N`.

### A.2 — MCP Resource URIs (11)

```
ema://context/operator          ema://projects/active
ema://context/project?id=...    ema://tasks/pending
ema://proposals/recent          ema://bootstrap/status
ema://focus/current             ema://vault/search?q=...
ema://intents/active            ema://intents/tree?project_id=...
ema://workspace/briefing?actor=...
```

### A.3 — Pipes Registry (22 triggers / 15 actions / 5 transforms)

**Triggers:** `brain_dump:item_created`, `brain_dump:item_processed`, `tasks:created`, `tasks:status_changed`, `tasks:completed`, `proposals:seed_fired`, `proposals:generated`, `proposals:refined`, `proposals:debated`, `proposals:queued`, `proposals:approved`, `proposals:redirected`, `proposals:killed`, `proposals:decomposed`, `projects:created`, `projects:status_changed`, `habits:completed`, `habits:streak_milestone`, `system:daemon_started`, `system:daily`, `system:weekly`.

**Actions:** `brain_dump:create_item`, `tasks:create`, `tasks:transition`, `proposals:create_seed`, `proposals:approve`, `proposals:redirect`, `proposals:kill`, `projects:create`, `projects:transition`, `projects:rebuild_context`, `responsibilities:generate_due_tasks`, `vault:create_project_space`, `vault:create_note`, `vault:search`, `notify:desktop`, `notify:log`, `notify:send`, `claude:run`, `http:request`, `transform`, `branch`.

**Transforms:** `filter`, `map`, `delay`, `claude`, `conditional`.

### A.4 — Proposal Pipeline (concrete stage sequence)

`Generator → Refiner → Debater (or Parliament/ParliamentDebater) → Scorer → Tagger` → terminal `queued`. Side channels: `Combiner` (hourly cross-pollination seeds from overlapping tags), `AutoDecomposer` (complex → subtasks), `KillMemory` (rejection lineage). Scoring dims: codebase coverage 30% / architectural coherence 25% / impact 30% / prompt specificity 15%. Dedup: cosine > 0.85.

### A.5 — Actor Phase Vocabulary

`~w(idle plan execute review retro)` — 5 phases, transitions append to immutable `phase_transition` log with timestamp, reason, summary, metadata. **This answers GAC-003 if we accept the old vocabulary.**

### A.6 — Intent Filesystem Layout

```
.superman/intents/<kebab-slug>/
├── intent.md      # problem statement, success criteria
└── status.json    # phase, updated_at, ...
```

Intent slugs are kebab-case semantic (e.g. `calendar-april-2026-this-week-daily-5-minute-ritual-mo`) — **very long, human-readable, not opaque IDs**. Attitude decision worth preserving.

### A.7 — vApp Catalog From Old Frontend (28 apps)

Every vApp below shipped (or was scaffolded) in the old build. Column "accent" is the per-app glass tint recovered from the window registry.

| vApp | Route | Default window | Accent |
|---|---|---|---|
| Brain Dump | `/brain-dump` | virtual scroll inbox | teal |
| Tasks | `/tasks` | kanban + threads | teal `#2dd4a8` |
| Projects | `/projects` | hierarchy | teal `#2dd4a8` |
| Executions | `/executions` | 1000×750 | indigo `#818cf8` |
| Proposals | `/proposals` | 900×700 | violet `#a78bfa` |
| Intent Schematic | `/intent-schematic` | 1200×800 (largest) | violet `#a78bfa` |
| Wiki | `/wiki` | 1000×750 | blue `#60a5fa` |
| Agents | `/agents` | 900×700 | violet `#a78bfa` |
| Canvas | `/canvas` | 1100×800 | blue `#6b95f0` |
| Pipes | `/pipes` | 900×700 | violet `#a78bfa` |
| Evolution | `/evolution` | 900×700 | purple `#c084fc` |
| Whiteboard | `/whiteboard` | 1100×800 | blue `#6b95f0` |
| Storyboard | `/storyboard` | 1000×750 | purple `#8b5cf6` |
| Decision Log | `/decision-log` | 1000×700 | purple `#c084fc` |
| Campaigns | `/campaigns` | 950×700 | purple `#8b5cf6` |
| Governance | `/governance` | 800×650 | emerald `#10b981` |
| Babysitter | `/babysitter` | 800×650 | amber `#f59e0b` |
| Habits | `/habits` | 650×700 | teal `#2dd4a8` |
| Journal | `/journal` | 800×700 | amber `#f59e0b` |
| Focus | `/focus` | 700×650 | rose `#f43f5e` |
| Responsibilities | `/responsibilities` | 800×650 | amber `#f59e0b` |
| Temporal/Rhythm | `/temporal` | 800×650 | orange `#f97316` |
| Goals | `/goals` | 800×700 | amber `#f59e0b` |
| Operator Chat | `/operator-chat` | 700×750 | indigo `#6366f1` |
| Agent Chat | `/agent-chat` | 700×750 | violet `#a78bfa` |
| HQ | `/hq` | 1100×800 | indigo `#6366f1` |
| Voice | `/voice` | 900×700 | cyan `#00D2FF` |
| Settings | `/settings` | 600×600 | neutral |

Launchpad grouped them into: **Work · Intelligence · Creative · Operations · Life · System**. Compare this 28 vs. the canon `vapps/CATALOG.md` 35 — the old build implemented ~80% of the catalog, missing some (e.g. Blueprint Planner itself).

### A.8 — Design Tokens (raw values worth preserving as `@ema/tokens`)

**Base / void scale:**
```
--color-pn-void:      #060610
--color-pn-base:      #08090E
--color-pn-surface-1: #0E1017
--color-pn-surface-2: #141620
--color-pn-surface-3: #1A1D2A
```

**Brand ramps (900 / 500 / 400 / 50):**
- Primary teal: `#064E3B / #0D9373 / #2DD4A8 / #CCFBF1`
- Secondary blue: `#1E3A6E / #4B7BE5 / #6B95F0 / #E0ECFD`
- Tertiary amber: `#78350F / #D97706 / #F59E0B / #FEF3C7`

**Semantic:** error `#E24B4A`, success `#22C55E`, warning `#EAB308`.

**Text layering:** 0.87 / 0.60 / 0.40 / 0.25 white alpha.

**Glass surfaces (the signature look):**
```
.glass-ambient  rgba(10,14,28,0.38)  blur(6px)  saturate(120%)
.glass-surface  rgba(10,14,28,0.52)  blur(20px) saturate(150%) border rgba(255,255,255,0.06)
.glass-elevated rgba(10,14,28,0.62)  blur(28px) saturate(180%) border rgba(255,255,255,0.08)
```

**Window layer alphas:** wash 0.46 / core 0.66 / deep 0.72 / panel 0.50 / header 0.48.

**Motion:** single easing `--ease-smooth: cubic-bezier(0.65, 0.05, 0, 1)`; tooltip 120ms, glass 200ms, debounce 300ms, heartbeat 1000ms.

**Typography:** `system-ui` sans, `JetBrains Mono` / `Cascadia Code` / `Fira Code` mono.

### A.9 — Recoverable Components

| Component | Keep because |
|---|---|
| `AmbientStrip` | Top chrome with clock `HH:MM · Day Num Mon`, traffic lights, org switcher, uppercase app title — distinctive identity |
| `AppWindowChrome` | Dual mode (embedded launchpad vs standalone) with drag regions, min-max enforcement |
| `Dock` | Left 52px rail, per-app accent indicator dot, running-app state, tooltips |
| `CommandBar` | Cmd+K palette across tasks / intents / vault / proposals / brain_dumps with category glyphs ☐ ◇ ≡ ✦ ⚡ |
| `GlassCard` / `GlassInput` / `GlassSelect` | Size variants sm/md, consistent focus ring `0 0 0 2px rgba(45,212,168,0.10)` |
| `LoadingSpinner` | 3 sizes, top-border animation idiom |
| `Tooltip` | `glassDropIn` 120ms keyframe |

### A.10 — Keyframes Worth Porting

```css
@keyframes glassDropIn { from {opacity:0; transform:translateY(-4px) scale(0.97)} to {opacity:1; transform:translateY(0) scale(1)} }
@keyframes fadeSlideUp { from {opacity:0; transform:translateY(6px)} to {opacity:1; transform:translateY(0)} }
@keyframes pulse-dot   { 0%,100%{opacity:1} 50%{opacity:0.5} }
```

### A.11 — Voice, Attitude, Naming Gems

Character names to keep: **Parliament** (multi-voice debate), **Combiner** (cross-pollination synthesis), **SuperMan** (intelligence CLI, prints `Thinking...` while working), **Composer** (InkOS-pattern artifact inspection before token spend), **Babysitter** (visibility hub), **KillMemory** (rejection lineage), **Genealogy** (proposal ancestry view), **Intention Farmer** (harvests intents from vault/git/channels), **Vault Seeder** (scans markdown for TODO/unchecked items → auto-seeds proposals).

CLI printer style (keep ANSI-colored, no apologies, directive tone):
```
error:   \e[31mError: ...\e[0m
success: \e[32m...\e[0m
warn:    \e[33m...\e[0m
```

Empty-state copy is minimal and technical — no exclamation marks, no playful padding. Retry messages are action-first: `Make sure the daemon is running: cd daemon && mix phx.server` / `Retry now`. Keep this register.

### A.12 — Hidden Gems Not Surfaced Before

- **`Ema.Memory.CrossPollination`** — records when a user-level fact learned in project A is transplanted to project B, with rationale + applied_at. Direct implementation of Honcho's cross-context learning. **Port as `services/memory/cross-pollination.ts`.**
- **`Ema.Proposals.VaultSeeder`** — scans markdown vault for TODOs / unchecked checkboxes / ideas and auto-seeds proposals. Contract library of templates for structured ideation.
- **`Ema.IntentionFarmer.*`** — multi-source intent harvesting (`BacklogFarmer`, `BootstrapWatcher`, `Cleaner`, `Loader`) with a note emitter and source registry.
- **`Ema.Standards.HooksInstaller`** — pre-commit that blocks hardcoded API keys and enforces issue refs in TODOs (`TODO(#123):` / `FIXME(EMA-456):`). Opinionated quality gate.
- **InkOS Composer pattern in Generator** — compiles + writes inspectable artifacts to disk *before* spending tokens; non-fatal failure preserves existing prompt; artifact dir recorded in `generation_log`.
- **`Ema.Babysitter.VisibilityHub`** — active-topic + state-change monitor, extensible to new contexts.

### A.13 — Delta vs. the TIER tables above

These findings do **not** invalidate any TIER PORT / REPLACE / DROP assignments. They add granularity:

- TIER PORT `Ema.Pipes` — exact 22/15/5 registry to replicate verbatim (§A.3).
- TIER PORT `Ema.Actors` — confirmed phase vocabulary `idle/plan/execute/review/retro` (§A.5). This is a candidate answer for GAC-003.
- TIER PORT `Ema.Intents` — filesystem layout confirmed; semantic kebab slugs (§A.6).
- TIER PORT `Ema.Proposals.Pipeline` — Parliament/ParliamentDebater is an alternate debater worth preserving as an opt-in mode (§A.4).
- TIER REPLACE (CLI surface) — 14 noun groups must be preserved/adapted. Dropping any of them is a conscious decision, not an omission.
- New candidates for TIER PORT: `Memory.CrossPollination`, `VaultSeeder`, `IntentionFarmer`, `Standards.HooksInstaller`, Composer artifact pattern, VisibilityHub.

---

## Appendix B — Frontend Layer (appended 2026-04-12)

> **Why this appendix exists:** the main body of this document is backend-heavy. It covers Elixir modules, pipelines, schemas, CLI surface, and data models, but only mentions the frontend twice — once to flag the 75-store IPC mess and once to flag glass CSS as a package target. This appendix inventories the **frontend** side with the same TIER PORT / REPLACE / DROP rigor, so the Electron renderer rebuild has the same quality of survival map the backend has.
>
> **Scope:** all four sources — `apps/renderer/` (current port-in-progress), `IGNORE_OLD_TAURI_BUILD/` (archived Elixir+Tauri build), `~/.local/share/ema/vault/wiki/` (EMA wiki), `~/Documents/obsidian_first_stuff/twj1/` (legacy Obsidian vault). Inventory generated by a cross-pollination pass and refined in a live brainstorming session.

### B.1 — The biggest finding: renderer ≠ catalog

The in-progress renderer at `apps/renderer/src/App.tsx` wires **28 vApps**. `ema-genesis/vapps/CATALOG.md` lists **35 vApps**. The obvious reading is "the renderer is behind by 7." The actual reading is worse: **the two sets barely overlap**.

The renderer wires concepts the catalog does not have: Intent Schematic, Projects, Executions, Proposals, Evolution, Campaigns, Governance, Babysitter, Decisions, Storyboard, Rhythm (Temporal), Goals, HQ (as a vApp), Operator Chat, Agent Chat, Voice (as a standalone vApp). Several of these are system concepts from the old Elixir build, not vApps in canon.

The catalog lists concepts the renderer does not wire: Notes, Schedule/Calendar, Pomodoro/Focus (named "Focus" in renderer but with different semantics), Time Blocking, Graphing, File Manager, Email/Messaging, Wiki Viewer (renderer has "Wiki" but different surface), Feeds, Research Viewer, Blueprint/Schematic Planner (maps roughly to Intent Schematic), Agent Calendar, Agent Scratchpads, Agent Plans/Status, Agent Live View, Agent Comms, Terminal, Machine Manager, Space Manager, Team Manager, Analytics, Services Manager, Network/Peer Manager, Permissions, Comms, Notifications Hub.

**Implication:** the rebuild is not a "fill in the missing 7 tiles" job. It is a reconciliation between two distinct mental models — the old Elixir/Tauri build's concept of what a "vApp" meant (things like Governance, Campaigns, Babysitter, Storyboard), and the canon catalog's concept (things like Notes, Schedule, File Manager, Terminal). This reconciliation must be done explicitly, per-vApp, before the renderer can be brought into alignment. Every decision gets logged as an intent card.

A full per-vApp reconciliation table belongs in a future `intents/INT-FRONTEND-VAPP-RECONCILIATION.md` — not in this appendix. What this appendix does is surface the divergence so nobody assumes the delta is small.

### B.2 — TIER PORT (frontend)

Patterns worth preserving from the current renderer or the old Tauri build. These are EMA-native and structurally sound.

| Current artifact | New TS target | Why port | Effort |
|---|---|---|---|
| Launchpad "One Thing" card (`components/dashboard/OneThingCard.tsx`) | Canon-spec'd Launchpad home screen | Cross-store priority function, single-item display, ADHD-first commitment. Captured in [[research/frontend-patterns/launchpad-one-thing-card]]. | Low |
| AmbientStrip (`components/layout/AmbientStrip.tsx`) — custom 32px titlebar with glass-ambient class, window controls, clock | Electron-aware AmbientStrip with no-op chrome for browser mode (iii-lite) | Custom titlebar is the design-identity anchor for EMA. Tauri drag-region needs Electron equivalent. | Medium |
| AppWindowChrome (`components/layout/AppWindowChrome.tsx`) — per-app frame with accent-color stripe | Same, reimplemented against the `@ema/tokens` package | Accent color per vApp is a cheap way to visually differentiate surfaces without mode switches. | Low |
| Dock (`components/layout/Dock.tsx`) — vertical iconic app launcher, active-state dot, tooltip on hover | Same, driven by the canonical 35-vApp catalog rather than the hardcoded 28 | Iconic always-visible nav earns its real estate. The pattern is fine; the app list needs canonicalization. | Low |
| CommandBar (`components/layout/CommandBar.tsx`) — multi-category omni-search (tasks, intents, vault, proposals, brain_dumps) | Same, with keybinding spec locked in a DEC card | Surface is already the right shape; the keybinding + ranking contract is not yet locked. | Medium |
| Glass CSS token set (`styles/globals.css`) — void / base / surface tiers, opacity scale, blur layers, per-vApp accent colors | `@ema/tokens` package built with Style Dictionary + Open Props | The tokens themselves are mature and opinionated. Single-file CSS → package is pure packaging work. | Low–Medium |
| SpaceSwitcher (`vapps/spaces/SpaceSwitcher.tsx`) — nested `{personal, team, project}` space types | Two flat dropdowns (org / space) over canon's single nested Space entity | The data model already exists as a stub; the chrome rendering is the work. | Medium |

### B.3 — TIER REPLACE (frontend)

Frontend subsystems where the current approach should be dropped in favor of a cleaner pattern — most already surfaced in Round 1 cross-pollination research.

| Current approach | Replace with | Status | Notes |
|---|---|---|---|
| ~75 Zustand stores each calling `loadViaRest()` + Phoenix channel `connect()` | `@ema/core` SDK consumed via Electron preload bridge OR browser HTTP+WS client, following [[research/vapp-plugin/logseq-logseq]] `@logseq/libs` + [[research/vapp-plugin/smapiot-piral]] shell API patterns | DECIDED — reaffirms §A existing finding | Duplicated in this appendix because the frontend implications (no direct `window.electron.*` calls, one transport contract for both runtime targets) are specific to iii-lite. |
| Single-file `globals.css` with all glass tokens hardcoded | `@ema/tokens` package built on [[research/vapp-plugin/argyleink-open-props]] + `style-dictionary` build pipeline | DECIDED — reaffirms §A existing finding | Same reason — needs a frontend-specific record. |
| Tauri window manager + capabilities | Electron `BrowserWindow` manager following [[research/vapp-plugin/alex8088-electron-vite]] + `electron-react-boilerplate` patterns | DECIDED — canon rule: "No Tauri references" | Wholesale swap. Already in progress in `apps/electron/windows/`. |
| Separate `hq-frontend/` React web app (9 pages, talks to same Phoenix daemon) | Absorbed into the iii-lite unified shell. See [[research/frontend-patterns/dual-surface-shell]]. One codebase, two runtime targets (Electron desktop now, browser deferred to v2). | DECIDED 2026-04-12 | Old HQ is dead as a separate codebase. Its 9 page concepts fold into the 35-vApp catalog. |
| `phoenix.d.ts` type declarations in renderer (Socket, Channel, Push) | Deleted entirely; replaced by `@ema/core` SDK types | DECIDED | Phoenix is gone from the renderer side. This typedef file is a smell indicating incomplete port. |

### B.4 — TIER DROP (frontend)

Patterns from the old build that are architectural dead weight and should not be ported at all.

| Dropped | Reason |
|---|---|
| Sidebar component (`IGNORE_OLD_TAURI_BUILD/app/src/components/layout/Sidebar.tsx`) — vertical app nav with labels | Dock replaced it in the current renderer. Dock wins: more compact, iconic, same information density. Record the decision and archive. |
| Tauri `data-tauri-drag-region` attributes in AmbientStrip | Tauri-specific. Electron uses CSS `-webkit-app-region: drag` or a custom drag handler in the preload. Needs re-implementation, not port. |
| Mock / stub components in ~60 of the 88 `src/components/` directories | Never wired, never shipped, never spec'd. Either become canonical vApps (via intent cards) or get deleted. Current ambiguous state rots the renderer. |
| Duplicate Canvas + Whiteboard vApps in App.tsx | Canon catalog #9 is "Whiteboard / Canvas" as one vApp. The current renderer wires both as separate tiles. One must die. |

### B.5 — Architectural decisions surfaced (captured as precursors)

These are decisions that emerged during the 2026-04-12 brainstorm. None are canon-locked yet — each needs an intent + proposal before landing in `canon/decisions/`. The intent queue is being drafted as `INT-FRONTEND-*` cards.

1. **iii-lite dual-surface commitment.** Captured in [[research/frontend-patterns/dual-surface-shell]]. One React codebase, two runtime targets (Electron now, browser v2). SDK discipline enforced from day one. Queued as `INT-FRONTEND-DUAL-SURFACE-SHELL`.
2. **Launchpad-inside-HQ shell model.** Launchpad is a "mode" of HQ alongside Dashboard mode. Both live in the same shell. Overlap between Launchpad's One Thing card and Dashboard's widgets is intentional, not a bug. Queued as `INT-FRONTEND-LAUNCHPAD-HQ-HOME`.
3. **Space = canon's single nested entity (org > team > project); chrome uses two flat dropdowns as UX sugar.** Permissions and cross-space visibility are backend config handled by vApps #27 Space Manager and #33 Permissions — the frontend just reads `currentSpaceId` and trusts whatever the backend returns. Queued as `INT-FRONTEND-SPACE-ORG-NAV`.
4. **HQ layout model: tiled zones + vApp widget view + per-space layouts.** Not free-form canvas, not fixed grid. Widgets come from vApps exposing a mini-view; each space persists its own zone layout. Queued as `INT-FRONTEND-HQ-TILED-ZONES`.
5. **@ema/tokens as a real npm package, not a CSS file.** Queued as `INT-FRONTEND-DESIGN-TOKENS`.
6. **`@ema/core` vApp SDK contract.** Plugin registration, preload bridge API, space-scoping rules, widget-view registration, priorityCandidates() for One Thing card, event subscription, error handling. Queued as `INT-FRONTEND-VAPP-SDK-CONTRACT`.

### B.6 — Gaps / open questions (frontend)

- **Catalog reconciliation.** Which of the renderer's "not in catalog" concepts (Governance, Babysitter, Evolution, Campaigns, Storyboard, etc.) are genuinely first-class vApps that belong in canon, which are system/backend concepts miscategorized as vApps, and which are dead? Blocks the full Launchpad rebuild.
- **Per-vApp Electron-only requirements.** Which of the 35 vApps require native capabilities (tray icons, global shortcuts, file dialogs, native notifications) and therefore will not degrade gracefully to browser mode? Blocks the v2 web ship.
- **Component stub triage.** ~60 component directories are unwired stubs. Each must be: promoted to canonical vApp via intent, moved to `_stubs/`, or deleted. Blocks renderer quality.
- **Dark-mode-only commitment for v1.** The current glass tokens are dark-only. Light mode is deferred to v2+. This deserves an explicit DEC card so nobody builds for it accidentally.
- **CommandBar keybinding.** Needs a chord system spec (cmd+k, cmd+p, cmd+f chords) and conflict resolution with Electron/OS. Currently ad-hoc in the source.
- **Voice surface.** Voice is wired as a vApp in the current renderer but canon treats voice as a Brain Dumps input mode (#5). Is Voice a vApp or an input modality? Needs a decision.
- **HQ auth flow for v2 browser target.** Deferred but must have an owner before v2. Token-based against the daemon; design TBD.

### B.7 — Delta vs. the main body

- Appendix B does **not** contradict any TIER assignments in the main body. It adds a frontend column to the same survival inventory.
- The two backend-side frontend mentions in §A (75-store IPC mess and glass CSS package) are now fully fleshed out in §B.3 with their frontend-specific implications under iii-lite.
- New candidates for TIER PORT (frontend): Launchpad One Thing card, AmbientStrip, AppWindowChrome, Dock, CommandBar, glass token set, SpaceSwitcher.
- New candidates for TIER DROP (frontend): Sidebar component, Tauri drag regions, ~60 stub component dirs, duplicate Canvas/Whiteboard wiring.

#meta #self-pollination #porting #inventory #migration #old-build #tier-port #tier-replace #tier-drop #appendix-a #appendix-b #frontend #recovery
