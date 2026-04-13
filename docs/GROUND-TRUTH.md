# EMA Ground Truth — 2026-04-12

> Current backend authority moved to `docs/backend/*` and `/api/backend/manifest`.
> Treat this document as broader repo archaeology and audit context, not the primary backend contract.

## System Identity
EMA is currently a TypeScript-first Electron monorepo with four real operating surfaces: an Electron shell that launches a launchpad window and child app windows (`apps/electron/main.ts:1-186`), a large React renderer that still hard-switches between 28 route components in a single top-level app (`apps/renderer/src/App.tsx:1-123`), a local Fastify + WebSocket compatibility backend with SQLite persistence (`services/startup.ts:20-55`, `services/http/server.ts:16-49`, `services/persistence/db.ts:11-117`), and a background workers process for filesystem/session watchers (`workers/src/startup.ts:1-34`). It is not yet the full Genesis runtime. It is a hybrid rebuild: significant old-system ideas survive in new TypeScript services, and durable proposals are now a real backend stage owned by `services/core/proposal/*` even though the surrounding intent and execution ledgers remain plural runtime surfaces.

## Repository Topology
Current package graph, grounded in package metadata and imports:

- Root workspace coordinates `apps/*`, `services`, `shared`, `shared/tokens`, `shared/glass`, `cli`, `platform`, `workers`, and `tools` (`pnpm-workspace.yaml:1-10`).
- `@ema/shared` is the only cross-package contract package actively imported by service code (`shared/index.ts:1-43`, `services/core/intents/service.ts:16-28`, `services/core/blueprint/service.ts:17-33`, `services/core/executions/executions.service.ts:21-36`).
- `@ema/services` imports `@ema/shared`, boots HTTP and WebSocket servers, and owns the SQLite runtime (`services/package.json:1-29`, `services/startup.ts:20-55`).
- `@ema/workers` is process-separate from services and does not meaningfully depend on `@ema/shared`; it communicates by filesystem observation and HTTP seams (`workers/src/intent-watcher.ts:1-129`, `workers/src/session-watcher.ts:1-114`).
- `@ema/cli` is a filesystem/canon reader, not a live runtime client; it reads `ema-genesis/` directly rather than talking to services (`cli/src/lib/intent-loader.ts:1-140`, `cli/src/commands/health/check.ts:49-99`).
- `@ema/platform` is a small Electron helper package with no internal workspace dependencies (`platform/package.json:1-14`).
- `@ema/tokens` and `@ema/glass` are real packages. `@ema/glass` consumes `@ema/tokens`; both contradict the stale canon discrepancy note that claimed they were missing.
- `apps/electron` does not import services as a package. It shells out to `services/dist/startup.js` and `workers/dist/startup.js` in `runtime.ts` (`apps/electron/runtime.ts:18-72`).
- `apps/renderer` currently does not broadly consume `@ema/shared`; many stores still use local types and legacy assumptions.

## Build Status
Verified on 2026-04-12 after the fixes in this session.

| Package / scope | Build | Tests | Typecheck | Notes |
|---|---|---|---|---|
| Root (`pnpm build`) | green | n/a | n/a | Turbo build succeeds. Renderer still emits chunk-size warnings only. |
| Root (`pnpm test`) | n/a | green | n/a | Turbo test runs `@ema/services` only; green. |
| `shared/` | green | no `test` script | green | Shared contracts compile cleanly after the new singular loop schemas were added. |
| `services/` | green | 143/143 passing in 18 files | green | Existing tests still pass; proposal convergence and backend flow tests are included. |
| `workers/` | green | no `test` script | green | Worker watchers compile cleanly. |
| `cli/` | green | no `test` script | green | CLI compiles; still canon-reader-first. |
| `platform/` | green | no `test` script | green | Prior ESM blockers in `autostart.ts`, `shortcuts.ts`, and `tray.ts` are fixed. |
| `apps/electron/` | green | no `test` script | green | Main/preload/runtime compile. |
| `apps/renderer/` | green | no `test` script | green | Build passes with large bundle and ineffective dynamic import warnings. |
| `tools/` | green | no `test` script | green | Root build blocker fixed; comment/parser bug and missing Node types resolved. |

Exact verified signals:

- Root build is green after fixing `platform/` and `tools/`.
- Root test is green; `@ema/services` reports `143` passing tests.
- Package-by-package `npx tsc --noEmit` is green for `shared`, `services`, `workers`, `cli`, `platform`, `apps/electron`, and `apps/renderer`.

## Layer-by-Layer Reality

### Canon & Intent Layer
- Canon still declares the maximalist Genesis target, not a reduced CLI-only system (`ema-genesis/_meta/CANON-STATUS.md:37-52`, `ema-genesis/EMA-GENESIS-PROMPT.md:35-80`, `ema-genesis/SCHEMATIC-v0.md:7-20`).
- The code-backed intent layer is real, but narrower than canon. `services/core/intents/` owns a two-layer intent engine where the filesystem is source-of-truth and SQLite is the queryable index (`services/core/intents/service.ts:1-10`, `services/core/intents/routes.ts:1-45`).
- The filesystem sources are both `.superman/intents/` and `ema-genesis/intents/`, not just one canonical folder (`services/core/intents/filesystem.ts` as summarized by its header and route wiring in `services/core/intents/routes.ts:229-235`).
- Canon docs describe nested spaces, a full agent runtime, a 35-vApp platform, and P2P mesh behavior (`ema-genesis/EMA-GENESIS-PROMPT.md:98-110`, `ema-genesis/SCHEMATIC-v0.md:55-63`). None of those exist end to end in the shipped Electron runtime yet.
- Old `.superman/` materials still matter architecturally. They preserve the original execution-first semantics, delegation packet discipline, and `.superman` intent folder design, but they are no longer an exact description of the active TypeScript stack (`.superman/context.md`, `.superman/intents/execution-first-ema-os/*`, `docs/planning/launchpad-hq-consolidated.md:48-71`).

### Shared Contract Layer
- `shared/index.ts` re-exports schemas, events, contracts, constants, and the SDK facade (`shared/index.ts:1-43`).
- `shared/schemas/index.ts` now exports both the established plural runtime schemas and the new singular bootstrap loop schemas added in this session (`shared/schemas/index.ts:1-208`).
- Active, implementation-backed shared schemas already existed for intents, executions, proposals, actor phase, agents, spaces, user-state, GAC cards, and cross-pollination (`shared/schemas/intents.ts:9-120`, `shared/schemas/executions.ts:21-49`, `shared/schemas/proposals.ts:9-37`, `shared/schemas/actor-phase.ts`, `shared/schemas/spaces.ts`, `shared/schemas/user-state.ts`, `shared/schemas/gac-card.ts`, `shared/schemas/cross-pollination.ts`).
- New bootstrap loop schemas now exist for core intents, proposals, executions, actors, artifacts, and loop events with runtime validation, factories, and fixtures (`shared/schemas/intent.ts:5-100`, `shared/schemas/proposal.ts:5-96`, `shared/schemas/execution.ts:5-68`, `shared/schemas/actor.ts:5-86`, `shared/schemas/artifact.ts:5-65`, `shared/schemas/events.ts:5-55`).
- Downstream reality is mixed. Services consume `@ema/shared/schemas` heavily. Renderer largely does not. The renderer still carries local types and legacy store assumptions for intents, proposals, and executions.
- Contract completeness score: moderate, roughly 65%. Core backend domains that exist are mostly typed. The largest untyped drift is in renderer state and in the still-unified actor/knowledge layers.

### Services Layer
- Services boot sequence is real and coherent: open SQLite, run loop migrations, start HTTP, start WebSocket server, register channel handlers (`services/startup.ts:20-55`).
- HTTP is Fastify, not Hono. It auto-discovers routers from `services/core/*` (`services/http/server.ts:16-49`, `services/http/server.ts:63-97`).
- Realtime is still Phoenix-wire-compatible WebSocket messaging over `ws`, backed by an in-process EventEmitter pub/sub (`services/realtime/pubsub.ts:15-31`, `services/realtime/server.ts:1-150`).
- Existing solid domains:
  - Intents: filesystem mirror, SQLite index, phase transitions, links, routes, and passing tests (`services/core/intents/service.ts:64-68`, `services/core/intents/service.ts:301-375`, `services/core/intents/routes.ts:141-354`, `services/core/intents/intents.test.ts:77-315`).
  - Executions: SQLite-backed execution rows, phase transitions, step journal, reflexion query surface, routes, and passing tests (`services/core/executions/executions.service.ts:127-133`, `services/core/executions/executions.service.ts:263-341`, `services/core/executions/executions.service.ts:417-549`, `services/core/executions/executions.router.ts:128-341`, `services/core/executions/executions.test.ts:93-276`).
  - Blueprint: GAC queue backend is real and tested (`services/core/blueprint/service.ts:1-18`, `services/core/blueprint/service.ts:69-91`, `services/core/blueprint/service.ts:253-260`, `services/core/blueprint/blueprint.test.ts`).
  - Pipes, Composer, Spaces, User State, Cross Pollination, Visibility all exist as TypeScript services and tests, contrary to stale discrepancy docs.
- Proposal reality before this session: `services/core/proposals/` was primarily a seed-harvest and vault scan surface, not an approval service (`services/core/proposals/proposals.router.ts:1-65`, `services/core/proposals/intention-farmer.ts:1-185`, `services/core/proposals/vault-seeder.ts:1-236`).
- Proposal reality after this session: `services/core/proposal/service.ts` is now the active durable proposal owner for `/api/proposals`, backed by SQLite tables `loop_proposals` and `loop_events`, with approve/reject/revise semantics and a real handoff into the plural `executions` ledger (`services/core/proposal/service.ts`, `services/core/proposal/router.ts`, `services/core/proposal/service.test.ts`).
- Database schema reality:
  - Baseline tables are created in `services/persistence/db.ts`: `settings`, `workspace_windows`, `projects`, `tasks`, `task_comments`, `inbox_items`, and baseline `executions` (`services/persistence/db.ts:20-107`).
  - Domain-owned DDL extends that baseline for intents, execution phase logs, blueprint cards, spaces, user state, pipes, cross-pollination, and now the bootstrap loop tables.
  - New bootstrap loop migrations add `service_migrations`, `loop_intents`, `loop_proposals`, `loop_executions`, `loop_artifacts`, and `loop_events` (`services/core/loop/migrations.ts:10-150`).

### Workers Layer
- Workers are real but narrow. Startup registers four workers only: vault watcher, session watcher, agent runtime heartbeat, and intent watcher (`workers/src/startup.ts:9-22`).
- `session-watcher` recursively polls `~/.claude/projects` JSONL files every 30 seconds and emits simple session events (`workers/src/session-watcher.ts:5-114`).
- `vault-watcher` uses `chokidar` on `~/.local/share/ema/vault` by default and emits add/change/unlink events (`workers/src/vault-watcher.ts:14-69`).
- `intent-watcher` is disabled by default and only forwards HTTP reindex requests back to services if `EMA_WORKERS_WATCH_INTENTS=1` (`workers/src/intent-watcher.ts:12-20`, `workers/src/intent-watcher.ts:82-129`).
- Workers are not yet a rich agent runtime. They are mostly filesystem/session observers plus a heartbeat seam.

### Electron Shell
- The main process creates a frameless launchpad window, additional frameless app windows, a tray icon, and global shortcuts (`apps/electron/main.ts:38-122`, `apps/electron/main.ts:124-177`).
- The runtime manager spawns `services` and `workers` as child Node processes unless `EMA_MANAGED_RUNTIME=external`, then waits for `/api/health` (`apps/electron/runtime.ts:10-72`).
- The preload surface is minimal: open/close app, minimize/maximize/close current window, navigate callback, and platform string (`apps/electron/preload.ts:1-31`).
- IPC reality is correspondingly small: `ema:open-app`, `ema:close-app`, `ema:minimize`, `ema:maximize`, `ema:close`, plus `ema:navigate` from main to renderer (`apps/electron/main.ts:138-170`, `apps/electron/preload.ts:3-31`).
- There is no rich service IPC protocol yet. Most application state still comes through HTTP/WebSocket compatibility rather than a typed Electron preload SDK.

### Renderer
- Top-level routing is a manual `switch` inside `App.tsx`, not TanStack Router (`apps/renderer/src/App.tsx:50-123`).
- Route inventory and reality:

| Route | Component | Reality |
|---|---|---|
| `launchpad` / default | `Launchpad` | Functional launch surface; wrapped in `Shell`. |
| `brain-dump` | `BrainDumpApp` | Service-backed. |
| `tasks` | `TasksApp` | Compile-valid; legacy store patterns remain. |
| `projects` | `ProjectsApp` | Compile-valid. |
| `executions` | `ExecutionsApp` | Compile-valid, but local execution types still drift from shared execution contracts. |
| `proposals` | `ProposalsApp` | Compile-valid; proposal store still expects seed/queue behavior, not the new bootstrap proposal service. |
| `blueprint-planner` | `BlueprintPlannerApp` | Compile-valid and conceptually aligned to GAC queue. |
| `intent-schematic` | `IntentSchematicApp` | Compile-valid, but intent store carries legacy fields and mismatched endpoints. |
| `wiki` | `WikiApp` | Compile-valid. |
| `agents` | `AgentsApp` | Compile-valid. |
| `canvas` | `CanvasApp` | Compile-valid. |
| `pipes` | `PipesApp` | Compile-valid and closer to live backend than many other apps. |
| `evolution` | `EvolutionDashboard` | Compile-valid. |
| `whiteboard` | `WhiteboardApp` | Compile-valid. |
| `storyboard` | `StoryboardApp` | Compile-valid. |
| `decision-log` | `DecisionLogApp` | Compile-valid. |
| `campaigns` | `CampaignsApp` | Compile-valid. |
| `governance` | `GovernanceApp` | Compile-valid. |
| `babysitter` | `BabysitterApp` | Compile-valid. |
| `habits` | `HabitsApp` | Compile-valid. |
| `journal` | `JournalApp` | Compile-valid. |
| `focus` | `FocusApp` | Compile-valid. |
| `responsibilities` | `ResponsibilitiesApp` | Compile-valid. |
| `temporal` | `TemporalApp` | Compile-valid. |
| `goals` | `GoalsApp` | Compile-valid. |
| `settings` | `SettingsApp` | Compile-valid. |
| `voice` | `VoiceApp` | Compile-valid; build warns that `audio-capture.ts` is ineffectively dynamically imported. |
| `hq` | `HQApp` | Compile-valid, but planning docs for HQ still describe older execution states and Tauri-era paths. |
| `operator-chat` | `OperatorChatApp` | Compile-valid. |
| `agent-chat` | `AgentChatApp` | Compile-valid. |

- The renderer surface is therefore broad, but conceptually mixed. Some apps are service-backed. Many are still carryover shells whose stores do not yet align with shared contracts.

### CLI
- CLI is an Oclif package (`cli/package.json:1-46`).
- Current command inventory:
  - `ema health check` checks `ema-genesis/` presence and counts canon/intents/executions/research nodes (`cli/src/commands/health/check.ts:33-159`).
  - `ema intent list` enumerates `ema-genesis/intents/` from the filesystem, not the SQLite runtime (`cli/src/commands/intent/list.ts:16-105`).
  - `ema intent show` reads a single intent markdown node and prints its frontmatter/body (`cli/src/commands/intent/show.ts:15-95`).
  - `ema research *` commands query the research markdown tree.
- CLI is therefore a canon/query surface today, not the unified operator surface described in Genesis.

### Platform
- `platform/` provides three thin helpers only: autostart, global shortcuts, and tray integration.
- The previously failing ESM/CommonJS blockers were in `platform/src/autostart.ts`, `platform/src/shortcuts.ts`, and `platform/src/tray.ts`; those are now fixed and compile green.
- `platform/` is not a substantive abstraction layer yet. It is an Electron helper package.

## Intent → Proposal → Execution Pipeline
This is the core loop section, and the repo currently contains two overlapping realities.

### Existing pre-bootstrap reality
- Intents were already real. They persisted, transitioned phases, synced from disk, and exposed routes (`services/core/intents/service.ts:301-375`, `services/core/intents/routes.ts:141-354`).
- Executions were already real. They persisted, tracked status, held step journals, recorded phase transitions, and exposed routes (`services/core/executions/executions.service.ts:263-549`, `services/core/executions/executions.router.ts:128-341`).
- Proposals were not real as an approval engine. The repo had seed extraction, vault seeding, and intention farming, but not a durable proposal approval/revision service (`services/core/proposals/intention-farmer.ts:160-184`, `services/core/proposals/proposals.router.ts:35-64`).
- Result: the system had intent state and execution state, but no unified, approved, end-to-end loop between them.

### Current bootstrap reality after this session
- Shared loop schemas now exist for core intent, proposal, execution, actor, artifact, and loop events (`shared/schemas/intent.ts:25-100`, `shared/schemas/proposal.ts:14-96`, `shared/schemas/execution.ts:13-68`, `shared/schemas/actor.ts:13-86`, `shared/schemas/artifact.ts:14-65`, `shared/schemas/events.ts:20-55`).
- SQLite-backed bootstrap loop tables are created by an idempotent migration runner (`services/core/loop/migrations.ts:10-150`).
- `IntentService` now exists at `services/core/intent/service.ts` with `create`, `get`, `list`, `updateStatus`, and `index` (`services/core/intent/service.ts:67-188`).
- `ProposalService` now exists at `services/core/proposal/service.ts` with `generate`, `get`, `approve`, `reject`, and `revise` (`services/core/proposal/service.ts:82-268`).
- `ExecutionService` now exists at `services/core/execution/service.ts` with `start`, `get`, `recordArtifact`, `complete`, `fail`, and artifact listing (`services/core/execution/service.ts:86-259`).
- `LoopOrchestrator` now wires them end to end in `runIntent` and persists `loop.completed` when it succeeds (`services/core/loop/orchestrator.ts:29-90`).
- Loop events are both emitted in-process and persisted in `loop_events` (`services/core/loop/events.ts:26-78`).
- Test coverage now proves the full cycle works: `services/core/loop/end-to-end.test.ts` plus unit tests for all three services and integration tests for the orchestrator. The services package now reports `143` passing tests.

### Gap list with severity
- `Medium`: renderer now consumes durable proposal list/approval routes in a minimal compatibility mode, but proposal components still depend on legacy view-model assumptions.
- `High`: there are now two intent/execution representations: the established plural runtime and the new bootstrap singular loop. This is intentional for incrementalism, but still transitional.
- `Medium`: CLI does not yet operate on the new loop tables.
- `Medium`: Electron preload/IPС remains minimal; service access is still mostly HTTP/WebSocket.
- `Medium`: actor service, knowledge graph index, and unified event bus remain incomplete compared to Genesis.
- `Low`: the bootstrap loop is synchronous and in-process. It is durable, but not yet supervised or remote-dispatch-capable.

## Cross-Cutting Concerns

### Authentication / identity model
- HTTP auth is optional bearer-token gating controlled by `EMA_API_TOKEN`. If unset, the server runs open on localhost. Health and WebSocket upgrades bypass auth (`services/http/middleware/auth.ts:3-38`).
- There is no full user/session/identity model in the Electron runtime yet. Actor identity exists in shared schemas and bootstrap loop records, but not as a unified system service.

### File system conventions
- Runtime DB lives at `~/.local/share/ema/ema.db` (`services/persistence/db.ts:6-19`).
- Vault watcher defaults to `~/.local/share/ema/vault` (`workers/src/vault-watcher.ts:14-16`).
- Session watcher defaults to `~/.claude/projects` (`workers/src/session-watcher.ts:5-9`).
- Intents are read from both `.superman/intents` and `ema-genesis/intents` by the TypeScript intent engine.
- Canon continues to live in `ema-genesis/`; the CLI reads it directly.

### IPC / message passing patterns
- Electron main/renderer IPC is minimal and window-management-focused (`apps/electron/main.ts:138-170`, `apps/electron/preload.ts:3-31`).
- Services/realtime still use a Phoenix-like WebSocket message shape over `ws` (`services/realtime/server.ts:6-18`, `services/realtime/server.ts:66-150`).
- In-process domain events rely on Node `EventEmitter` (`services/realtime/pubsub.ts:15-31`, `services/core/loop/events.ts:11-78`).
- The new bootstrap loop also persists its event log to SQLite.

### Error handling patterns
- Route handlers use Zod parsing plus explicit typed errors to return structured 4xx/5xx envelopes (`services/core/intents/routes.ts:116-139`, `services/core/executions/executions.router.ts:98-114`).
- Service layers throw custom error classes such as `IntentNotFoundError`, `ExecutionNotFoundError`, `ProposalStateError`, and `CoreIntentNotFoundError` (`services/core/intents/service.ts:34-48`, `services/core/executions/executions.service.ts:117-123`, `services/core/proposal/service.ts:13-29`, `services/core/intent/service.ts:21-28`).
- Worker listeners generally swallow callback errors to avoid process crashes (`workers/src/session-watcher.ts:33-41`, `workers/src/vault-watcher.ts:26-35`).

### Logging / observability
- Startup/shutdown logging is plain timestamped console output (`services/startup.ts:15-18`, `services/startup.ts:57-72`).
- Existing services persist append-only transition logs for intents, executions, blueprint cards, spaces, and user-state snapshots.
- The bootstrap loop adds a persisted `loop_events` table and explicit artifact rows for execution output (`services/core/loop/migrations.ts:77-102`, `services/core/loop/events.ts:43-78`, `services/core/execution/service.ts:147-189`).

## Stale Document Inventory
The following repository docs materially contradict current code reality.

- `ema-genesis/_meta/BLUEPRINT-REALITY-DISCREPANCIES.md` is stale in multiple major ways. It claims `@ema/tokens` is missing, `@ema/glass` is missing, `services/core/intents/` is empty, `services/core/pipes/` is empty, `services/core/blueprint/` does not exist, `shared/schemas/gac-card.ts` does not exist, and that the repo has zero functioning service implementations (`ema-genesis/_meta/BLUEPRINT-REALITY-DISCREPANCIES.md:29-37`, `:55-74`, `:98-140`, `:189-216`). Current code directly contradicts all of those claims.
- `docs/planning/launchpad-hq-consolidated.md` is a useful archaeological design doc, but its implementation references point to old Tauri-era paths such as `app/src/components/layout/Launchpad.tsx`, old execution statuses like `proposed → delegated → harvesting`, and `.superman`-only intent semantics (`docs/planning/launchpad-hq-consolidated.md:97-101`, `:147-180`, `:190-220`). The active stack is `apps/electron`, `apps/renderer`, and the current shared execution status enum is narrower.
- `CLAUDE.md` still says the TypeScript/Electron stack is so early that canonical build commands will be added later (`CLAUDE.md:87-89`). That is no longer true. Root `package.json` and `README.md` contain working build/dev commands and the monorepo now builds green (`package.json:5-14`, `README.md:26-45`).
- `docs/planning/UNMERGED-SALVAGE-QUEUE-2026-04-06.md` refers to old `daemon/` and `app/` targets as if they were still the active mainline surfaces (`docs/planning/UNMERGED-SALVAGE-QUEUE-2026-04-06.md:18-27`, `:66-84`). It remains useful as salvage history, but not as a description of the current monorepo.
- Large parts of `.superman/intents/execution-first-ema-os/*` describe the original execution-first architecture as if `.superman/` were the sole durable semantic truth and the DB were wholly disposable. The TypeScript rebuild now indexes both `.superman` and `ema-genesis`, and the shared contract layer is more formal than those docs describe.

That is the verified state of the repository after the 2026-04-12 audit and bootstrap-core-loop implementation pass.

## 2026-04-13 Product Design Constraints

The next implementation passes should treat the following as current product
reality constraints, not optional observations.

### The renderer does not currently have one authoritative product map

Concrete drift:

- `apps/renderer/src/App.tsx` hard-switches between a large route list and
  treats that list as the product ontology.
- `apps/renderer/src/components/layout/Launchpad.tsx` presents a category grid
  that mixes product pillars, subsystems, experiments, and life apps as peers.
- HQ is still wired like one app among many instead of the shell command center.

Consequence:

- renderer structure should not be used as product authority
- the next UI implementation pass should anchor around merged product pillars,
  not today's tile inventory

### Store proliferation is ahead of domain ownership

Concrete drift:

- the renderer has dozens of stores with overlapping or unclear authority
- many store names do not map cleanly to active backend domains
- local renderer types still substitute for shared contracts in important work
  areas

Consequence:

- future UI work should be domain-first
- every major surface needs an owning runtime domain or an explicit derived-view
  status

### Proposal and execution UX is ahead of backend convergence

Concrete drift:

- the renderer proposal flows still reflect seed-queue and comparison-era logic
- the backend now also contains durable `services/core/proposal/*`
- execution UI still primarily reflects the pluralized execution ledger

Consequence:

- the next product pass should show one work lineage while acknowledging the
  split implementation seams underneath

### Session and ingestion surfaces are solving the wrong abstraction layer

Concrete drift:

- `sessions-store` is Claude-session specific and runtime-control oriented
- `ingestor-store` points at `/ingest-jobs`, which is not the committed
  ingestion-v1 contract
- there is no first-class imported-history model in the renderer

Consequence:

- the next real ingestion UI should target Chronicle, not source-specific
  session widgets or job tables

### Some experimental surfaces are useful patterns, not product authority

Concrete signal worth keeping:

- the `feeds` surface already demonstrates reader / triage / agent-console
  segmentation that fits the ideal product well

Consequence:

- preserve the strong interaction ideas from `feeds`
- fold them under `Knowledge` and `Review`, not as a separate competing product
  ontology

### Canon and vault surfaces are still product promises more than runtime truth

Concrete drift:

- canon is still primarily file-backed
- vault parity is incomplete
- the renderer contains vault-style assumptions before there is one honest
  backend contract for those surfaces

Consequence:

- UI should expose canon/vault as bounded domains with explicit truth sources
- implementation should avoid pretending those services are already symmetrical

### Product-level conclusion

The current codebase is strong enough to support a real product model, but not
the current renderer taxonomy.

The correct next authority is:

- `HQ`
- `Work`
- `Chronicle`
- `Review`
- `Knowledge`
- `Trace`
- `System`

Everything else should be interpreted as:

- a vApp lens over those pillars
- a derived view
- or an experiment to reconcile, not a top-level product truth
