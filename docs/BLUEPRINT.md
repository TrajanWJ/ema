# EMA Canonical Blueprint — 2026-04-12

> Current backend authority moved to `docs/backend/*` and `/api/backend/manifest`.
> Treat this document as architecture planning and future direction, not the current backend source of truth.

## Architecture Principles
1. Preserve the old system's strongest invariant: semantic intent state is durable and human-readable; operational state is queryable and append-only.
2. Prefer additive migration over replacement. New TypeScript services should land beside compatibility surfaces first, then absorb them.
3. Shared contracts are the only stable boundary. Renderer, CLI, workers, and services should all converge on `shared/` schemas.
4. Local-first means SQLite + files first, network second. Remote or cross-machine behavior may extend the system, but must not be required for core loops.
5. Humans approve plans; agents execute bounded work. Proposal approval remains the gate between desire and action.
6. Every loop transition emits durable events. If the system cannot reconstruct what happened from persisted records, the loop is incomplete.
7. Electron is a host, not the architecture. Main process responsibilities stay narrow; system behavior lives in services, workers, and shared contracts.

## System Layers

### Layer 0: Shared Contracts (`shared/`)
Current state:
- Plural runtime schemas already exist for live service domains such as `intents`, `executions`, `gac-card`, `spaces`, and `user-state`.
- The bootstrap loop introduced singular, additive schemas in `shared/schemas/{intent,proposal,execution,actor,artifact,events}.ts`.

Target state:
- `shared/schemas/` becomes the single contract catalog for all durable entities.
- Existing plural files remain compatibility exports until downstream consumers are migrated.
- New canonical loop contracts are:
  - `coreIntentSchema`
  - `coreProposalSchema`
  - `coreExecutionSchema`
  - `actorSchema`
  - `artifactSchema`
  - `emaEventSchema`

Event catalog (minimum canonical set):
- `intent.created`
- `intent.status_updated`
- `intent.indexed`
- `proposal.generated`
- `proposal.approved`
- `proposal.rejected`
- `proposal.revised`
- `execution.started`
- `execution.artifact_recorded`
- `execution.completed`
- `execution.failed`
- `loop.completed`

Contract versioning strategy:
- Additive fields first.
- Keep plural compatibility exports until all internal consumers move.
- When a contract diverges semantically, create a new file rather than mutating a compatibility type in place.

### Layer 1: Persistence (`services/persistence/`, `services/core/*/schema.ts`, `services/core/loop/migrations.ts`)
Current state:
- Baseline runtime DB setup lives in `services/persistence/db.ts`.
- Domain-specific DDL is scattered across service-owned schema files.
- The bootstrap loop now adds a migration table and explicit loop tables via `services/core/loop/migrations.ts`.

Target state:
- Keep SQLite as the single local database.
- Move toward one migration runner with numbered domain migrations.
- Preserve service-owned tables but register them through a shared migration registry.

Canonical persistent entities:
- `loop_intents`
- `loop_proposals`
- `loop_executions`
- `loop_artifacts`
- `loop_events`
- Existing runtime tables that must be preserved during migration: `intents`, `intent_links`, `intent_events`, `executions`, `execution_phase_transitions`, `gac_cards`, `gac_transitions`, `pipes`, `pipe_runs`, `spaces`, `user_state_*`, `memory_cross_pollinations`

What persists vs what is ephemeral:
- SQLite persists all operational entities, append-only logs, and event history.
- Files persist canon, intent markdown, and research graph nodes.
- Ephemeral state should be limited to in-memory pub/sub subscriptions, window handles, and worker timers.

### Layer 2: Core Services (`services/core/`)

#### Blueprint service
Current state:
- Exists and is solid in `services/core/blueprint/service.ts`.
Target state:
- Keep it as the GAC queue backend.
- Connect blueprint answers directly to proposal generation and canon updates.
Migration path:
- Start from `services/core/blueprint/service.ts`.
- Add an adapter that mints bootstrap intents/proposals from resolved GAC cards.
Current implementation status:
- `exists`

Interface:
```ts
interface BlueprintService {
  createCard(input: CreateGacCardInput): GacCard;
  getCard(id: string): GacCard | null;
  listCards(filter?: ListGacCardsFilter): GacCard[];
  answerCard(id: string, input: AnswerGacCardInput): GacCard;
  deferCard(id: string, input: DeferGacCardInput): GacCard;
  promoteCard(id: string, input: PromoteGacCardInput): GacCard;
}
```

#### Intent service
Current state:
- Established runtime engine exists in `services/core/intents/`.
- Bootstrap loop service now exists in `services/core/intent/service.ts`.
Target state:
- Keep `services/core/intents/` as the filesystem/canon bridge.
- Use `services/core/intent/service.ts` as the durable operational loop surface.
- Eventually unify them through adapters, not by deleting one first.
Migration path:
- Start from `services/core/intents/service.ts` for indexing and markdown-backed semantics.
- Start from `services/core/intent/service.ts` for the new approval/execution loop.
- Add a mapper that links `intents.id` to `loop_intents.id` and reuses the existing `intent_links` model.
Current implementation status:
- `exists`

Interface:
```ts
interface IntentService {
  create(input: CreateCoreIntentInput): CoreIntent;
  get(id: string): CoreIntent | null;
  list(filter?: {
    status?: CoreIntentStatus;
    priority?: CoreIntentPriority;
    source?: CoreIntentSource;
    requested_by_actor_id?: string;
  }): CoreIntent[];
  updateStatus(id: string, status: CoreIntentStatus): CoreIntent;
  index(): void;
}
```

Dependencies:
- Persistence
- Loop event service

Emits:
- `intent.created`
- `intent.status_updated`
- `intent.indexed`

Consumes:
- none directly; later should consume blueprint/proposal completions

Test strategy:
- Unit tests for CRUD, filters, search index writes, and missing-row errors.

#### Proposal service
Current state:
- Seed harvesting exists in `services/core/proposals/`.
- Durable approval/revision service now exists in `services/core/proposal/service.ts`.
Target state:
- Merge seed generation and durable proposal lifecycle into one conceptual domain.
- Keep harvester components as proposal-input producers.
Migration path:
- Start from `services/core/proposals/intention-farmer.ts` and `vault-seeder.ts` for upstream idea collection.
- Start from `services/core/proposal/service.ts` for approval, rejection, and revision.
- Add `generateFromHarvestedIntent` and `generateFromGacResolution` adapters rather than replacing either half.
Current implementation status:
- `exists`

Interface:
```ts
interface ProposalService {
  generate(intentId: string): CoreProposal;
  get(id: string): CoreProposal | null;
  approve(id: string, actorId: string): CoreProposal;
  reject(id: string, actorId: string, reason: string): CoreProposal;
  revise(id: string, changes: ReviseCoreProposalInput): CoreProposal;
}
```

Dependencies:
- Intent service
- Persistence
- Loop event service

Emits:
- `proposal.generated`
- `proposal.approved`
- `proposal.rejected`
- `proposal.revised`

Consumes:
- eventually `gac:answered`, harvested intent events, and canon repair triggers

Test strategy:
- Unit tests for generation, approval, rejection, revision, and invalid transitions.

#### Execution service
Current state:
- Existing execution runtime exists in `services/core/executions/`.
- Bootstrap loop execution service now exists in `services/core/execution/service.ts`.
Target state:
- Keep old execution runtime for UI compatibility and phase journaling.
- Move core loop starts/completions/artifacts onto the bootstrap execution service first.
- Later unify `loop_executions` with the established `executions` runtime table through an adapter or table merge.
Migration path:
- Start from `services/core/executions/executions.service.ts` for reflexion and UI compatibility.
- Start from `services/core/execution/service.ts` for proposal-gated starts and artifact persistence.
- Add translation between `proposal_id` / `intent_id` and the existing `intent_slug` / `proposal_id` execution model.
Current implementation status:
- `exists`

Interface:
```ts
interface ExecutionService {
  start(proposalId: string): CoreExecution;
  get(id: string): CoreExecution | null;
  recordArtifact(executionId: string, artifact: {
    type: ArtifactType;
    label: string;
    content: string;
    created_by_actor_id: string;
    path?: string | null;
    mime_type?: string | null;
    metadata?: Record<string, unknown>;
  }): void;
  complete(id: string, result: { summary: string; metadata?: Record<string, unknown> }): CoreExecution;
  fail(id: string, error: string): CoreExecution;
}
```

Dependencies:
- Proposal service
- Persistence
- Loop event service

Emits:
- `execution.started`
- `execution.artifact_recorded`
- `execution.completed`
- `execution.failed`

Consumes:
- approved proposal state

Test strategy:
- Unit tests for approved-only starts, artifact persistence, complete/fail, and missing-row errors.

#### Actor service
Current state:
- Partial only: actor-related route and runtime-classifier surfaces exist, but not a unified actor lifecycle service.
Target state:
- Promote `shared/schemas/actor.ts` into a real service with human and agent actor tables, capabilities, and lifecycle state.
Migration path:
- Start from `shared/schemas/actor.ts` and existing agent runtime classifier code.
- Add `services/core/actors/service.ts` without deleting current heartbeat/classifier files.
Current implementation status:
- `missing`

Interface:
```ts
interface ActorService {
  create(input: Actor): Actor;
  get(id: string): Actor | null;
  list(): Actor[];
  update(id: string, patch: Partial<Actor>): Actor;
  setRuntimeState(id: string, state: AgentRuntimeState): Actor;
}
```

#### Knowledge / Graph service
Current state:
- Fragmented across canon files, intent filesystem indexing, and cross-pollination memory.
Target state:
- A single object-index service that can read canon/intents/research files and project them into queryable graph tables.
Migration path:
- Start from `services/core/intents/filesystem.ts`, `services/core/memory/cross-pollination.ts`, and the CLI readers.
Current implementation status:
- `partial`

#### Pipe / Channel service
Current state:
- Pipes runtime exists and is tested. WebSocket channel compatibility exists separately.
Target state:
- Keep `services/core/pipes/` as automation runtime.
- Treat Phoenix-wire WebSocket compatibility as an adapter, not the canonical transport.
Migration path:
- Start from `services/core/pipes/*` and `services/realtime/*`.
- Introduce a typed SDK event layer before rewriting channel protocol.
Current implementation status:
- `exists`

### Layer 3: Workers (`workers/`)
Target model:
- Watchers observe files and session state.
- Workers emit durable events or call typed service APIs.
- Long-running proposal/execution workers become separate modules under `workers/` rather than hiding inside renderer or services.

Watcher inventory:
- `vault-watcher`
- `session-watcher`
- `agent-runtime-heartbeat`
- `intent-watcher`
- future: `proposal-pipeline`, `execution-runner`, `graph-indexer`

Interaction model:
- Short term: HTTP + persisted DB seam.
- Target: shared SDK client over local HTTP/IPC boundary, with durable event writes.

### Layer 4: Runtime Host (`apps/electron/`)
Main process responsibilities:
- Boot or attach to local runtime
- Create launchpad window
- Create secondary app windows
- Own tray and shortcuts
- Expose preload bridge
- Manage process shutdown

Target IPC protocol:
- Window management: keep current commands
- Runtime commands to add:
  - `ema:loop:create-intent`
  - `ema:loop:approve-proposal`
  - `ema:loop:get-execution`
  - `ema:loop:list-events`
- Directional event stream to renderer:
  - `ema:loop:event`
  - `ema:runtime:ready`
  - `ema:runtime:error`

Window model:
- Launchpad remains single always-available hub window.
- vApps open in separate BrowserWindows.
- The preload bridge should eventually host a typed `@ema/core` renderer client rather than bespoke handlers.

### Layer 5: Renderer (`apps/renderer/`)
Route map target:
- `launchpad`
- `intents`
- `proposals`
- `executions`
- `knowledge`
- `agents`
- `settings`
- other vApps remain, but should route through a real router rather than a monolithic `switch`.

State management approach:
- Keep Zustand where already entrenched.
- Move stores to shared contract types incrementally.
- Prefer a single local service client abstraction over direct `fetch` + Phoenix channel duplication.

Key surfaces:
- Launchpad / home: existing shell remains entry point.
- Intent creation / viewing: should use the new bootstrap intent service plus existing filesystem-backed intent views.
- Proposal review / approval: should move off seed-only assumptions and onto `services/core/proposal/service.ts`.
- Execution monitoring: should unify legacy execution feed and bootstrap loop execution rows.
- Knowledge browser: should continue reading canon/research, then move to a graph index service.
- Agent workspace: keep route, but back it with actor and execution records.
- Settings / identity: use optional bearer token, workspace paths, runtime mode, and actor defaults.

### Layer 6: CLI (`cli/`)
Command inventory target:
- `ema health check`
- `ema intent list|show|create|status`
- `ema proposal list|show|generate|approve|reject|revise`
- `ema execution list|show|start|complete|fail`
- `ema graph search|get`

Access model:
- Keep current direct markdown readers for canon-oriented commands.
- Add service-backed commands for operational state.
- Long-term: CLI and renderer both use the same typed local client.

CLI as agent execution surface:
- Agents should be able to create intents, review proposals, approve/reject, and inspect executions entirely from CLI without opening the GUI.

### Layer 7: Agent Runtime
Canonical agent representation:
```ts
interface RuntimeAgent {
  actor: AgentActor;
  currentExecutionId: string | null;
  currentIntentId: string | null;
  runtimeState: AgentRuntimeState;
  visibleSpaces: string[];
}
```

Lifecycle:
- spawn
- attach context
- approve bounded work
- run
- emit step/artifact events
- pause or terminate

Memory model:
- Current session context
- Prior execution artifacts
- Relevant intent/proposal state
- Canon and research references

Execution model:
- Agents operate on approved proposals.
- Every execution writes artifacts and durable event history.
- Human approval is required before execution start unless a future policy explicitly allows autonomous execution.

Human ↔ agent handoff protocol:
- Human creates or selects intent
- System generates proposal
- Human approves or revises proposal
- Agent executes within scope
- Agent writes artifacts and completion summary
- Human reviews artifacts and updates intent state if needed

Agent ↔ agent communication:
- Not yet implemented as a first-class runtime.
- Future implementation should use persisted events and actor-scoped execution ownership, not free-form chat messages.

## The Core Loop: Intent → Proposal → Execution

### Intent
Schema:
- `shared/schemas/intent.ts`

Lifecycle states:
- `draft`
- `active`
- `proposed`
- `executing`
- `completed`
- `rejected`
- `failed`
- `archived`

Creation paths:
- human-initiated from GUI or CLI
- agent-initiated from a bounded runtime action
- system-initiated from blueprint or recovery workflows

Storage:
- `loop_intents` in SQLite
- future semantic mirror into existing filesystem-backed intent domain

Indexing and retrieval:
- `IntentService.index()` maintains `search_text`
- future graph index should subsume this into object-level retrieval

Example intent objects:
- Bootstrap the EMA core loop
- Review renderer/service contract drift
- Harvest proposal seeds from canon

### Proposal
Schema:
- `shared/schemas/proposal.ts`

Lifecycle states:
- `generated`
- `pending_approval`
- `approved`
- `rejected`
- `revised`
- `superseded`

Generation model:
- Proposal derives from an intent's scope, constraints, and requesting actor.
- Upstream seed harvesters and GAC answers become generators feeding this service.

Approval model:
- Human or trusted operator actor approves.
- Rejection records actor + reason.
- Revision supersedes prior proposal and creates a new proposal row.

Storage:
- `loop_proposals`

Example proposal objects:
- Align renderer execution store to shared execution schema
- Write blueprint + ground-truth docs from verified code
- Add actor runtime service on top of heartbeat data

### Execution
Schema:
- `shared/schemas/execution.ts`

Lifecycle states:
- `pending`
- `running`
- `completed`
- `failed`
- `cancelled`

Execution environment:
- Current bootstrap loop is in-process and synchronous.
- Future execution environments may include CLI agent dispatch, worker runners, or multi-machine routing.

Artifact writeback:
- Artifacts persist in `loop_artifacts`.
- Completion/failure emits persisted events.
- Existing plural execution runtime remains available for richer journaling/reflexion.

Failure handling:
- `ExecutionService.fail()` writes final failed state and error message.
- Orchestrator marks the intent failed if the loop throws before completion.

Example execution traces:
- approved proposal -> running execution -> summary artifact -> completed execution
- approved proposal -> running execution -> error -> failed execution

### The Loop
Detailed walk-through of one complete cycle:
1. `IntentService.create()` writes a `loop_intents` row and emits `intent.created`.
2. `IntentService.updateStatus(..., "active")` marks the request live.
3. `ProposalService.generate()` writes a `loop_proposals` row with plan steps from intent scope.
4. Human or system approver calls `ProposalService.approve()`.
5. `ExecutionService.start()` creates the `loop_executions` row only if proposal state is `approved`.
6. Execution writes one or more artifacts via `recordArtifact()`.
7. `ExecutionService.complete()` marks the execution complete and emits `execution.completed`.
8. Intent moves to `completed` and the orchestrator emits `loop.completed`.

How the loop self-improves:
- Artifacts persist and become future input for proposal generation, operator review, and agent context assembly.
- `loop_events` provides the append-only history needed for later heuristics.

How the loop bootstraps:
- The first intent can be human-created or system-created.
- This session added `ema-genesis/intents/001-bootstrap-core-loop.md` as the first explicit self-management artifact for the next wave.

## Data Model
SQLite entities:
- `loop_intents` 1:N `loop_proposals`
- `loop_proposals` 1:N `loop_executions`
- `loop_executions` 1:N `loop_artifacts`
- `loop_events` references any of the above by `(entity_type, entity_id)`
- Existing runtime tables continue to coexist until migration completes

Filesystem entities:
- canon nodes in `ema-genesis/`
- historical runtime intent folders in `.superman/`

Memory-only entities:
- active WebSocket subscriptions
- worker timers
- Electron BrowserWindow / Tray handles

## Event Architecture
Event bus design:
- Short term: in-process `EventEmitter` plus persisted `loop_events`
- Compatibility layer: Phoenix-wire WebSocket pub/sub for renderer
- Target: a typed local client that consumes the persisted event stream

Key event flows:
- Intent create -> proposal generate -> proposal approve -> execution start -> artifact record -> execution complete -> loop complete
- Proposal reject -> proposal revise -> proposal approve -> execution start
- Execution fail -> intent fail or reopen

## Bootstrap Sequence
First startup on a new machine:
1. Electron `app.whenReady()` starts or attaches to services/workers.
2. Services open SQLite and run loop migrations.
3. HTTP health route becomes live.
4. Workers start watchers.
5. Electron creates launchpad, tray, and shortcuts.
6. Renderer can now open windows and query services.

Subsequent startup:
- Same sequence, but migrations are no-op because `service_migrations` records the prior run.

Ready state means:
- DB open
- migrations applied
- `/api/health` responds
- WebSocket server attached
- Electron windows can open
- workers supervision loop running

## Migration Path From Current State

### Shared contracts
- Exists now: plural runtime schemas plus new bootstrap loop schemas.
- Needed next: move renderer and CLI onto shared contracts.
- Ordered steps:
  1. Replace local execution/proposal/intent renderer types with shared types.
  2. Add shared client helpers for loop APIs.
  3. Delete redundant local type definitions once no consumers remain.
- Complexity: `M`

### Persistence
- Exists now: baseline DB bootstrap plus domain-owned DDL and new loop migrations.
- Needed next: central migration registry and eventual table convergence between `loop_*` and legacy runtime tables.
- Ordered steps:
  1. Register all domain migrations in one place.
  2. Add migration metadata for existing service-owned schemas.
  3. Decide whether `loop_executions` merges into `executions` or remains a compatibility slice.
- Complexity: `L`

### Services
- Exists now: strong plural services, new bootstrap singular loop services.
- Needed next: adapters, not rewrites.
- Ordered steps:
  1. Connect proposal service to harvested seeds and GAC outputs.
  2. Map bootstrap loop events into existing executions/intents UI surfaces.
  3. Add actor service.
  4. Add graph/object index service.
- Complexity: `L`

### Workers
- Exists now: watchers only.
- Needed next: proposal pipeline workers and execution runners.
- Ordered steps:
  1. Add proposal-pipeline worker using current harvesters.
  2. Add execution-runner worker that can consume approved proposals.
  3. Add graph-index worker for canon/research projection.
- Complexity: `XL`

### Runtime host
- Exists now: Electron boot + tray + shortcuts + process spawning.
- Needed next: typed preload client and runtime event subscriptions.
- Ordered steps:
  1. Add preload methods for bootstrap loop actions.
  2. Route renderer away from direct fetch/channel duplication.
  3. Introduce runtime-ready and runtime-error IPC events.
- Complexity: `M`

### Renderer
- Exists now: broad app inventory with route-switch shell, mixed state quality.
- Needed next: route and store convergence around shared contracts.
- Ordered steps:
  1. Repair `ExecutionsApp`, `ProposalsApp`, and `IntentSchematicApp` first.
  2. Move to a real router.
  3. Decompose legacy monolith stores into contract-backed clients.
- Complexity: `XL`

### CLI
- Exists now: canon-reading query tool.
- Needed next: service-backed operator surface.
- Ordered steps:
  1. Add proposal and execution commands against local services.
  2. Keep canon readers for markdown truth inspection.
  3. Reuse the same shared client as renderer.
- Complexity: `M`

### Agent runtime
- Exists now: concept, heartbeat, session watcher, and canon docs.
- Needed next: real actor lifecycle, approved execution handoff, and artifact return path.
- Ordered steps:
  1. Add actor service.
  2. Define delegation packet schema in shared contracts.
  3. Add execution-runner worker.
  4. Attach execution artifact stream to UI and CLI.
- Complexity: `XL`

This blueprint is intentionally incremental: it starts from the repo that exists today, preserves the proven old patterns that are still valid, respects the Genesis direction, and gives the Electron/TypeScript build a path to one coherent system instead of another split-brain rewrite.

## 2026-04-13 Product Design Pass

This section adds the current product authority for the next implementation
passes. It does not replace `docs/backend/*` as backend truth. It defines the
ideal merged EMA product and the staged path from current repo reality.

### Product authority for this pass

The product should be designed as one merged system with these pillars:

1. `Work`
   - spaces, projects, intents, proposals, executions
2. `Chronicle`
   - imported/raw sessions, traces, artifacts, history
3. `Review`
   - the promotion boundary between raw material and durable EMA objects
4. `Knowledge`
   - canon, decisions, research, feeds, memory links
5. `Trace`
   - activity, provenance, search, recall
6. `System`
   - connectors, agents, runtime health, settings

The renderer should stop treating the app grid as the authoritative product map.
The shell should expose these pillars directly.

### Decisive product call

The first-class landing zone for imported material is `Chronicle`.

Chronicle is:

- the durable arrival zone for imported chat/tool/system history
- the provenance substrate for future promotion
- the raw layer beneath review

Chronicle is not:

- canon
- vault
- an ephemeral import log

### Staged path to reality

#### Phase 0: product authority and system map

Objective:

- define the merged product model and map surfaces to current domains

User-visible outcome:

- implementation work stops inventing new product taxonomies ad hoc

Backend / domain seams touched:

- none required beyond documentation and manifest clarification

Can remain fake:

- review UI, Chronicle UI, canon/vault parity

Must become real:

- nothing yet beyond the design/spec authority

#### Phase 1: Chronicle landing zone

Objective:

- consolidate imported sessions, traces, artifacts, and source bundles into one
  EMA-owned landing zone

User-visible outcome:

- one place to browse imported material and unified activity history

Backend / domain seams touched:

- `services/core/ingestion`
- new Chronicle storage/index layer
- `ema-genesis/chronicle/` manifests

Can remain fake:

- extraction quality
- external OAuth connectors
- advanced dedupe

Must become real:

- durable import storage
- normalized sessions/entries/traces
- timeline browsing

#### Phase 2: Review queue and promotion mechanics

Objective:

- make promotion explicit and traceable

User-visible outcome:

- users can approve, reject, merge, or defer extracted intents/proposals/canon
  suggestions

Backend / domain seams touched:

- Chronicle adapters into intents, proposals, canon, research, executions
- first review-item data model

Can remain fake:

- auto-extraction sophistication

Must become real:

- review items
- promotion receipts
- provenance-preserving links

#### Phase 3: intent / proposal / execution convergence in the GUI

Objective:

- make the work loop visible as one flow

User-visible outcome:

- one coherent `intent -> proposal -> execution -> result` path in the product

Backend / domain seams touched:

- `services/core/intents`
- `services/core/proposals`
- `services/core/proposal`
- `services/core/executions`
- `services/core/execution`

Can remain fake:

- agent dispatcher automation

Must become real:

- one visible work lineage model
- approval and execution status coherence

#### Phase 4: canon / vault parity and traceability

Objective:

- stop treating canon and vault as second-class seams

User-visible outcome:

- canon and vault can be browsed, linked, and reviewed from the same product

Backend / domain seams touched:

- future `services/core/canon`
- future `services/core/vault`
- search/index layer

Can remain fake:

- advanced editing ergonomics

Must become real:

- honest read/write boundaries
- trace links from Chronicle and executions back to canon and vault references

#### Phase 5: richer human / agent workspace integration

Objective:

- make human capture and agent execution feel like one workspace

User-visible outcome:

- operator can move from capture to review to approval to execution without
  leaving the shell model

Backend / domain seams touched:

- `actors`
- `workspace`
- `dashboard`
- `ingestion`
- `executions`

Can remain fake:

- deep multi-agent autonomy

Must become real:

- agent visibility
- execution context docks
- Chronicle-backed operator recall

#### Phase 6: deeper orchestration convergence

Objective:

- reduce the pluralized-runtime versus loop split without breaking the product

User-visible outcome:

- proposals, executions, lineage, and events feel native and singular

Backend / domain seams touched:

- `intent`, `proposal`, `execution`, `loop`
- adapters from pluralized runtime tables and routes

Can remain fake:

- distributed runtime scheduling

Must become real:

- single lineage model
- single event/provenance story

### Implementation order

If implementation resumes immediately, the first build slice should be:

1. Chronicle storage and index
2. Chronicle browse surface
3. Review item model and promotion receipts
4. renderer shell authority update around HQ / Work / Chronicle / Review /
   Knowledge / Trace / System
