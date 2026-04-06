# Intent Engine Readiness Audit

Date: 2026-04-06

## Purpose

This audit defines the next step after bootstrap. The immediate goal is not more intent ingestion. The goal is to make EMA usable as a coherent agent surface across CLI, MCP, sessions, actors, executions, and realtime channels.

Bootstrap proved that canonical intent storage now exists and can be populated. Readiness requires the adjacent surfaces to agree on the same truth and expose stable primitives for multiple actors.

## Verified Surfaces

These surfaces exist and are live in the repo today:

- Canonical intent context: [daemon/lib/ema/intents/intents.ex](/home/trajan/Projects/ema/daemon/lib/ema/intents/intents.ex)
- Intent REST API: [daemon/lib/ema_web/controllers/intents_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/intents_controller.ex)
- Intent realtime channel: [daemon/lib/ema_web/channels/intents_channel.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/channels/intents_channel.ex)
- Canonical CLI surface: [daemon/lib/ema/cli/cli.ex](/home/trajan/Projects/ema/daemon/lib/ema/cli/cli.ex) and [daemon/lib/ema/cli/commands/intent.ex](/home/trajan/Projects/ema/daemon/lib/ema/cli/commands/intent.ex)
- Legacy HTTP CLI surface: [daemon/lib/ema_cli/cli.ex](/home/trajan/Projects/ema/daemon/lib/ema_cli/cli.ex) and [daemon/lib/ema_cli/intent.ex](/home/trajan/Projects/ema/daemon/lib/ema_cli/intent.ex)
- MCP stdio server: [daemon/lib/ema/mcp/server.ex](/home/trajan/Projects/ema/daemon/lib/ema/mcp/server.ex)
- MCP tool registry: [daemon/lib/ema/mcp/tools.ex](/home/trajan/Projects/ema/daemon/lib/ema/mcp/tools.ex)
- MCP session tools: [daemon/lib/ema/mcp/session_tools.ex](/home/trajan/Projects/ema/daemon/lib/ema/mcp/session_tools.ex)
- MCP HTTP bridge: [daemon/lib/ema_web/controllers/mcp_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/mcp_controller.ex)
- Session APIs: [daemon/lib/ema_web/controllers/session_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/session_controller.ex) and [daemon/lib/ema_web/controllers/ai_session_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/ai_session_controller.ex)
- Actor API: [daemon/lib/ema_web/controllers/actor_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/actor_controller.ex)

## Verified Fixes In This Pass

- MCP HTTP execution now matches stdio routing for intent tools.
- Legacy `ema intent status` now uses `/api/intents/status` instead of inferring counts from a full list pull.
- Intent search is now implemented on the canonical index path via `search=` over `title`, `description`, and `slug`.
- Legacy CLI help now reflects `intent create`.

## Current State

The bootstrap layer is working, but readiness is still partial.

- Semantic truth exists: canonical intents and lineage events are real.
- Agent access exists: CLI, MCP, HTTP, and websocket entry points all exist.
- Multi-actor truth is not yet unified: actors, sessions, executions, and intents are adjacent but not yet bound by one contract.
- Operational linking is weak: imported bootstrap data has lineage but still lacks rich `intent_links`.

## Primary Findings

### 1. There are still two CLI surfaces

EMA currently exposes:

- the canonical Optimus/native CLI in `Ema.CLI`
- the legacy HTTP-only CLI in `EmaCli`

This creates drift risk in:

- supported subcommands
- output shapes
- transport semantics
- help text
- fallback behavior

Readiness rule: `Ema.CLI` should be the canonical operator and agent CLI. `EmaCli` should either become a thin compatibility wrapper or be clearly frozen/deprecated.

### 2. Intent, actor, session, and execution are not yet one workflow surface

EMA currently has these separate truths:

- `intents` as semantic intent state
- `actors` as role/capability carriers
- `sessions` and `ai_sessions` as runtime agent work
- `executions` as operational work records

What is missing is one canonical contract answering:

- who is acting
- through which session
- on behalf of which actor
- against which intent
- through which execution
- with what provenance

Without that contract, agent usage remains possible but not yet disciplined.

### 3. MCP is useful, but still session-centric instead of orchestration-centric

The MCP surface already provides:

- context resources
- task/proposal tools
- intent tools
- session spawn/resume/check tools

What it does not yet provide is a coherent multi-actor orchestration layer such as:

- assign actor to intent
- open work session for actor against intent
- attach execution/session provenance to intent
- fetch operator-ready context bundle for one intent plus its actors and linked sessions

The next MCP pass should be shaped around agent workflows, not just isolated utilities.

### 4. Realtime exposure exists, but not the full event model

`IntentsChannel` currently supports:

- summary on join
- tree fetch
- detail fetch
- create
- created/status-changed pushes

That is enough for a first UI pass. It is not enough yet for:

- actor handoff visibility
- link creation visibility
- session attachment visibility
- lineage and provenance streaming
- multi-actor watch surfaces

### 5. Search and status parity were inconsistent

This pass corrected two concrete examples of readiness drift:

- legacy CLI status used an expensive ad hoc list-based summary
- search was declared in the CLI but not implemented in the canonical controller/context path

This is the category of problem to keep eliminating before more feature growth.

## Canonicalization Decision

For the next phase, EMA should operate under these rules:

- `Ema.Intents` is the canonical semantic API.
- `EmaWeb.IntentsController` is the canonical HTTP projection of that API.
- `Ema.CLI` is the canonical CLI.
- `Ema.MCP.Server` plus `Ema.MCP.Tools` and `Ema.MCP.SessionTools` are the canonical agent integration surface.
- `EmaCli` remains compatibility-only until removed or folded into `Ema.CLI`.

## What Readiness Means

Intent Engine readiness is achieved when all of the following are true:

- CLI, MCP, HTTP, and websocket surfaces expose the same core intent verbs.
- Every actor/session/execution interaction can be attached to an intent through a stable link model.
- Agents can discover work, claim work, execute work, and report outcomes without ambiguity.
- Context assembly can explain why a context bundle was built and where each included artifact came from.
- Operators can inspect provenance across host EMA, agent sessions, and imported knowledge surfaces.

## Recommended Next Work

### Phase 1: Contract Alignment

- Define the canonical `intent + actor + session + execution` linking contract.
- Add explicit intent link roles for `actor`, `session`, and `execution`.
- Decide whether `SessionController` and `AiSessionController` need consolidation or only normalization.

### Phase 2: CLI Canonicalization

- Ensure `Ema.CLI` exposes the full agent-facing workflow for intent inspection and linking.
- Freeze `EmaCli` to compatibility behavior only, or route it through the canonical handlers.
- Add smoke tests for `intent list`, `intent show`, `intent tree`, `intent status`, `intent create`, and `intent link`.

### Phase 3: MCP Agent Surface

- Add orchestration-grade tools for:
  - resolving actor context
  - attaching sessions/executions to intents
  - fetching intent-centered context bundles
  - reporting execution outcomes back into intent lineage
- Keep tool shapes stable between stdio MCP and HTTP MCP bridge.

### Phase 4: Realtime and Operator Visibility

- Broadcast link creation and lineage changes over `IntentsChannel`.
- Expose actor/session/execution attachment changes in a watchable stream.
- Add operator views for “who is working on what” and “why this context was assembled.”

## Immediate Blockers

These are the highest-signal blockers right now:

- No canonical multi-actor linking contract yet.
- `intent_links` is still underused in imported bootstrap data.
- CLI duplication still invites drift.
- MCP does not yet present one end-to-end agent workflow around intents.

## Immediate Non-Blockers

These should wait until readiness is tighter:

- more intent population sources
- TUI work
- richer wiki projections
- speculative structural inference
- crystallization/publishing flows

## Recommended Next Deliverable

The next implementation artifact should be:

- `INTENT-ACTOR-SESSION-CONTRACT.md`

That document should define the exact linking model and the canonical verbs shared by CLI, MCP, HTTP, and channels. Once that contract exists, the code changes can be made without further drift.
