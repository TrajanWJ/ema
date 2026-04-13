# EMA App Readiness Matrix

Updated: 2026-04-13

## Purpose

This file classifies the 28 route-mounted renderer apps against the current live EMA backend and CLI surfaces.

It is intentionally biased toward current reality, not aspiration.

Important correction: backend presence does not guarantee app usability. A route can exist while the renderer still hangs, expects stale payloads, or depends on dead side seams. Treat this matrix as a current-state implementation guide, not a claim that every non-`shell-only` app is production-usable.

Primary trust sources for this matrix:

- `services/core/backend/manifest.ts`
- route files under `services/core/*/*.router.ts`, `services/core/*/routes.ts`
- `cli/src/index.ts`
- `apps/renderer/src/App.tsx`
- renderer stores and app components under `apps/renderer/src/components/*` and `apps/renderer/src/stores/*`

## Status Labels

- `live-core`
  - renderer route exists
  - backend domain is active or clearly usable now
  - CLI has a meaningful surface for the same domain or loop
- `live-no-cli`
  - renderer route exists
  - backend domain is real now
  - no meaningful CLI parity yet
- `partial`
  - some live backend exists, but the renderer depends on mixed old/new seams, missing endpoints, or weak parity
- `draft-linked`
  - renderer surface exists and is product-shaped
  - the domain does not yet own a live backend contract
  - the app is honest about that and links into adjacent live systems instead of dead routes
- `shell-only`
  - renderer surface exists, but it primarily points at absent, legacy, or external-only seams

## Current Active Backend Spine

The most real backend architecture today is:

1. `ema-genesis/` and filesystem intent sources provide canonical semantic input.
2. `services/core/intents/*` and `services/core/blueprint/*` mirror/index canon into SQLite.
3. `services/core/proposal/*` provides durable proposals on `/api/proposals`.
4. `services/core/executions/*` remains the active runtime execution ledger.
5. `services/core/chronicle/*` and `services/core/review/*` provide the imported-history and review decision path.
6. `services/core/goals/*`, `services/core/calendar/*`, `services/core/human-ops/*`, `services/core/user-state/*`, `services/core/spaces/*` provide the current planning/runtime layer.
7. Renderer and CLI should be judged against that spine, not against dormant renderer stores or old Tauri-era surfaces.

## Matrix

| App | Status | Backend Reality | CLI Parity | Notes |
| --- | --- | --- | --- | --- |
| `desk` | `partial` | Composes real `brain-dump`, `tasks`, `goals`, `projects`, `calendar`, and `human-ops` seams. No dedicated Desk backend. | No direct `desk` CLI. | Strong user surface, but it is an integration shell over multiple domains rather than a first-class contract. |
| `agenda` | `partial` | Built on real `human-ops` and `calendar` routes. | No direct `agenda` CLI, but `calendar` CLI exists. | One of the strongest next convergence candidates because the underlying backend is real. |
| `brain-dump` | `partial` | `/api/brain-dump/*` exists and the store uses a real queue channel. | No direct CLI. | Backend seam exists, but the app has had real usability failures, including renderer-side loading stalls. Treat as partial until smoke-tested end-to-end. |
| `tasks` | `live-no-cli` | `/api/tasks` routes and channels are live. | No direct CLI. | Real operational domain, but parity is renderer-only right now. |
| `goals` | `live-core` | `/api/goals` is active and linked into proposals, buildouts, and executions. | `ema goal *` is real. | One of the cleanest end-to-end domains in the repo. |
| `projects` | `live-no-cli` | `/api/projects` is real and the renderer store is aligned. | No direct CLI. | Usable backend, but not mirrored through the CLI yet. |
| `executions` | `live-core` | `/api/executions` is active and still owns the real runtime ledger. | `ema exec *` and `ema backend flow *` are real. | Strong core domain, though it still carries compatibility shortcuts. |
| `proposals` | `live-core` | `/api/proposals` is durable and active under `services/core/proposal/*`. | `ema backend proposal *` is real. | This is the cleanest proposal surface. The older file-backed `ema proposal *` commands are still conceptual noise. |
| `blueprint-planner` | `live-core` | Backend `blueprint` domain is real and the renderer now reads and answers cards directly through `/api/blueprint/gac`. | `ema blueprint *` is real. | This app is now aligned with the local backend instead of the old external blueprint server. |
| `intent-schematic` | `live-core` | `/api/intents` is real and the renderer now uses the runtime bundle/tree surface directly. | `ema intent *` is real. | The old vault/wiki editing dependency has been removed from this app. |
| `wiki` | `draft-linked` | No live wiki backend contract exists. The renderer now presents an honest knowledge workstation draft linked to live adjacent surfaces. | No meaningful current CLI parity. | This is now a connected first draft rather than a dead vault-routed app. |
| `agents` | `partial` | Backend exposes `/api/agents/status` runtime classification only. | `ema agent *` exists. | The app is now an honest runtime monitor; full agent CRUD/workspace behavior is still deferred. |
| `feeds` | `partial` | `/api/feeds` exists as a supporting domain. | No direct CLI parity. | Potentially usable, but still a support workspace rather than a converged primary app. |
| `canvas` | `draft-linked` | No live canvas backend contract exists. The renderer now presents a place-native first draft linked to intents, blueprint, and whiteboard. | No CLI parity. | Product direction is preserved without faking missing persistence routes. |
| `pipes` | `live-core` | `/api/pipes` is real and active enough for CRUD/catalog/history access. | `ema pipe *` exists. | Strong supporting/system app and a good convergence candidate. |
| `evolution` | `draft-linked` | No active evolution backend domain exists today. The renderer now frames the domain honestly around governance and proposals. | No CLI parity. | This is a connected systems-adaptation draft, not a fake runtime. |
| `whiteboard` | `shell-only` | No active backend domain in the manifest. | No CLI parity. | Renderer surface only. |
| `storyboard` | `shell-only` | No active backend domain in the manifest. | No CLI parity. | Renderer surface only. |
| `decision-log` | `draft-linked` | No active decision backend owns `/decisions`. The renderer now provides a connected decision-memory draft linked to blueprint, proposals, and intents. | No CLI parity. | Honest first draft, backend still deferred. |
| `campaigns` | `draft-linked` | No active campaign backend owns `/campaigns` or `/campaign-runs`. The renderer now positions campaigns over live proposals, executions, and pipes. | No CLI parity. | Connected orchestration draft, not a dead CRUD shell. |
| `governance` | `shell-only` | Renderer depends on `/intelligence/token-usage`; no active backend domain owns that route. | No CLI parity. | Concept surface, not a live app. |
| `babysitter` | `shell-only` | Uses `/babysitter/state`; only `/api/health` and `/api/executions` are real in its dependency set. | No CLI parity. | Mostly a shell around absent backend behavior. |
| `habits` | `draft-linked` | No active habits backend exists. The renderer now positions the app as a rhythm-support draft tied to Desk, Focus, and reflection. | No CLI parity. | Honest first draft rather than a broken life tracker. |
| `journal` | `draft-linked` | No active journal backend exists. The renderer now frames Journal as a reflection draft over the live day systems. | No CLI parity. | Connected first draft, backend still deferred. |
| `focus` | `draft-linked` | No active focus backend exists. The renderer now presents an attention-workflow draft tied to executions, tasks, and agenda. | No CLI parity. | Product-shaped and honest, but not yet a backend-owned domain. |
| `responsibilities` | `draft-linked` | No active responsibilities backend exists. The renderer now positions ownership mapping against goals, projects, and review rather than dead routes. | No CLI parity. | Connected first draft, backend still deferred. |
| `temporal` | `draft-linked` | No active temporal backend exists. The renderer now frames rhythm guidance around agenda, focus, and reflection instead of legacy APIs. | No CLI parity. | Honest first draft rather than a dead telemetry shell. |
| `settings` | `partial` | `/api/settings` is real. Parts of the app also depend on side surfaces like `/mcp/tools` and actor data. | No direct `settings` CLI. | The core settings surface is real; the full app is still broader than the current backend contract. |
| `voice` | `partial` | `/api/voice/connect-info`, `/api/voice/qr`, and `/phone/voice` are real. Some surrounding voice/Jarvis surfaces still point at older `/voice/process` assumptions. | No direct CLI parity. | Real backend seam exists; end-user workflow still needs convergence. |
| `hq` | `draft-linked` | No dedicated HQ backend contract exists. The renderer now exposes HQ as a strategic command-center draft linked into real operator surfaces. | No CLI parity as an app. | Ambitious and visible, but now honest about its current layer. |
| `pattern-lab` | `shell-only` | No active backend ownership. | No CLI parity. | Static or design-only surface. |
| `operator-chat` | `partial` | Calls `/api/dashboard/today` and now captures through `/api/brain-dump/items`. | No CLI parity. | This is now a real staging console over live capture, not a fake full control shell. |
| `agent-chat` | `partial` | No duplex chat backend exists; the app now queues targeted requests into Brain Dump using live `/api/agents/status` actor selection. | `ema agent *` exists, but not chat parity. | Honest and usable, but still not a true live agent conversation service. |

## Summary By Bucket

### `live-core`

- `goals`
- `executions`
- `proposals`
- `pipes`
- `blueprint-planner`
- `intent-schematic`

These are the best domains for continued end-to-end buildout because they already have meaningful backend and CLI shape.

### `live-no-cli`

- `tasks`
- `projects`

These are real operational apps, but they are renderer-heavy and not mirrored well in the CLI.

### `partial`

- `desk`
- `agenda`
- `agents`
- `feeds`
- `settings`
- `voice`
- `operator-chat`
- `agent-chat`

These are the domains where some current work exists, but the app still mixes active and legacy assumptions.

### `draft-linked`

- `wiki`
- `canvas`
- `evolution`
- `decision-log`
- `campaigns`
- `habits`
- `journal`
- `focus`
- `responsibilities`
- `temporal`
- `hq`

These are now coherent first drafts that point users toward the live system without pretending their own backend domains already exist.

### `shell-only`

- `whiteboard`
- `storyboard`
- `governance`
- `babysitter`
- `pattern-lab`

These should not drive backend planning until they either gain a real backend owner or are explicitly demoted in the UI.

## Hidden Complexity: The Renderer Is Larger Than The Route Map

`apps/renderer/src/App.tsx` mounts 28 routes, but `apps/renderer/src/components/` contains many more app surfaces and many stores still targeting absent domains.

That means EMA currently has two layers of renderer drift:

1. route-mounted apps that are only partially honest
2. extra component/store surfaces that are not even mounted but still shape the codebase and the shell boot path

Any serious convergence pass should avoid treating the renderer inventory as the live product inventory.

## Best Next Buildout Domains

### 1. Human Ops Planning Cluster

Scope:

- `desk`
- `agenda`
- `brain-dump`
- `tasks`
- `projects`
- `goals`
- `calendar`
- `human-ops`

Why now:

- This cluster already has the densest real backend underneath it.
- It would upgrade multiple visible apps at once.
- It can be mirrored through new CLI commands without inventing new backend architecture.

Expected work:

- add CLI parity for brain-dump, tasks, projects, and daily human-ops views
- tighten Desk and Agenda around only live backend contracts
- remove or isolate calls to dead side domains from the daily surfaces

### 2. Voice End-to-End

Why now:

- The backend seam is now real enough to justify a proper surface.
- This is one of the few new domains that already has a clear user workflow.

Expected work:

- align the voice renderer to `/api/voice/*` and `/phone/voice`
- isolate or remove leftover `/voice/process` assumptions
- add a minimal CLI probe/status path if needed

### 3. Renderer Honesty Pass

Why now:

- The current app list overstates what is live.
- This is the fastest way to reduce user confusion.

Expected work:

- mark shell-only apps explicitly as unavailable or preview-only
- stop presenting HQ and other command surfaces as live if they are composite shells over dead routes
- keep this pass narrow: honesty, not redesign

## Recommended Next Domain

The best next real work area is the Human Ops planning cluster.

Reason:

- It upgrades the most visible day-to-day apps in one pass.
- It sits on top of backend domains that already exist today.
- It creates the most practical CLI parity wins.
- It improves actual usability without depending on speculative backend invention.

Concrete starting point:

1. Add CLI commands for `brain-dump`, `tasks`, `projects`, and `human-ops` daily views.
2. Audit `DeskApp` and `AgendaApp` so they depend only on live backend routes.
3. Remove or isolate any dead side calls from the Human Ops renderer path.
4. Only after that, promote the Human Ops apps more aggressively in Launchpad/Dock.
