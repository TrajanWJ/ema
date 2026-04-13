# EMA Backend — Current Truth

This is the backend start point for the current TypeScript/Electron runtime.

Use this doc set when you need to answer:

- what the active backend actually is
- which entities are first-class now
- what counts as source of truth
- what storage is canonical vs mirrored vs operational
- which parallel systems are future or noise
- where to extend the backend safely

## Backend Spine

The current backend spine is:

1. `ema-genesis/` and filesystem intent/GAC sources provide canonical semantic input.
2. `services/core/intents/*` and `services/core/blueprint/*` index that input into SQLite.
3. Durable proposals are created in `services/core/proposal/*` and persisted in `loop_proposals`.
4. Approved proposals hand off into the active `services/core/executions/*` runtime ledger.
5. Executions attach result artifacts and can write back to linked intents.
6. Chronicle now provides the imported-history landing zone for sessions, entries, and stored artifacts.
7. Chronicle-derived extractions feed into Review as the durable decision layer for approve / reject / defer.
8. Promotion receipts bridge reviewed Chronicle candidates into real runtime objects such as intents, goals, and calendar entries.
9. Goals and calendar entries provide the current operational planning layer for humans and agents.
10. Interfaces should depend on this backend contract, not on stale docs or dormant architectures.

That means the active backend is still the pluralized, filesystem-backed, SQLite-mirrored runtime for intents and executions, but proposals are now a real durable stage inside that spine. The old singular bootstrap loop is no longer "future-only" for proposals.

## Layers

- Canonical semantic layer
  - Primary semantic truth.
  - Today this is mainly `ema-genesis/` plus filesystem intent sources.
- Indexed operational layer
  - SQLite mirror and runtime persistence at `~/.local/share/ema/ema.db`.
- Runtime services layer
  - `services/core/*`, HTTP routes, websocket adapters, workers.
- Generated artifact layer
  - `~/.local/share/ema/artifacts/` and `~/.local/share/ema/results/`.
- Interface layer
  - CLI, renderer, future agent surfaces.

## First-Class Entities

- `intent`
  - Canonical work unit, sourced from filesystem and mirrored into SQLite.
- `gac_card`
  - Canonical unresolved architecture/governance card, sourced from filesystem and mirrored into SQLite.
- `proposal`
  - Durable approval object persisted in SQLite between intent and execution.
- `space`
  - Minimal runtime container for user/work context.
- `execution`
  - Operational run ledger linked back to intents and, when present, approved proposals.
- `chronicle_session`
  - Durable imported-session and raw-history record backed by raw files plus SQLite metadata.
- `chronicle_extraction`
  - Durable Chronicle-derived candidate extracted from session entries or artifacts before promotion.
- `review_item`
  - Durable human decision object linked to one Chronicle extraction and its provenance.
- `promotion_receipt`
  - Durable provenance bridge from an approved review item into a real runtime object or recorded follow-on target.
- `goal`
  - Operational owned objective for either a human or an agent.
- `calendar_entry`
  - Operational schedule ledger for human commitments and agent virtual plan blocks.
- `result_artifact`
  - Filesystem output referenced from an execution via `result_path`.
- `user_state`
  - Persisted runtime mode/signals.
- `runtime_tool`
  - Detected local coding-agent tool inventory.
- `runtime_session`
  - Tmux-backed managed or discovered runtime session.

Supporting but not spine entities:

- `project`
- `task`
- `brain_dump`
- `proposal_seed`
- `cross_pollination`

## Active Data Flow

1. An intent or GAC exists on disk.
2. The corresponding service indexes it into SQLite.
3. A human or interface creates a durable proposal for a runtime intent.
4. A human approves, rejects, or revises that proposal.
5. An approved proposal starts an execution in the active execution ledger.
6. The execution records progress and a `result_path` / `result_summary`.
7. Imported session/history material lands in Chronicle raw storage and is indexed into SQLite for browse/query.
8. A Chronicle extraction pass derives candidate intents, goals, calendar items, evidence, and follow-ups from Chronicle provenance.
9. Each extraction becomes one durable review item with explicit status plus human decision actor/timestamp fields.
10. Promotion receipts link approved review items to downstream structured work without forcing automatic creation.
11. Completion can optionally update linked intent state.
12. Goals and calendar entries link planning back to intents, projects, spaces, and executions where needed.

Compatibility note:

- Direct intent -> execution creation still exists.
- Treat it as a compatibility shortcut while interfaces converge.
- The authoritative loop now includes proposals.

## Runtime Introspection

The backend now publishes its normalized contract at:

- `GET /api/backend/manifest`

That endpoint returns:

- active layers
- storage boundaries
- registered backend domains
- first-class entities
- deduplication decisions

## Read Next

- [SOURCE-OF-TRUTH.md](/home/trajan/Projects/ema/docs/backend/SOURCE-OF-TRUTH.md)
- [DEDUPLICATION-DECISIONS.md](/home/trajan/Projects/ema/docs/backend/DEDUPLICATION-DECISIONS.md)
- [ENTITY-CONTRACTS.md](/home/trajan/Projects/ema/docs/backend/ENTITY-CONTRACTS.md)
- [GOLDEN-PATH-INTENT-EXECUTION-RESULT.md](/home/trajan/Projects/ema/docs/backend/GOLDEN-PATH-INTENT-EXECUTION-RESULT.md)
- [GOLDEN-PATH-GOALS-CALENDAR.md](/home/trajan/Projects/ema/docs/backend/GOLDEN-PATH-GOALS-CALENDAR.md)
- [GOLDEN-PATH-CHRONICLE-REVIEW.md](/home/trajan/Projects/ema/docs/backend/GOLDEN-PATH-CHRONICLE-REVIEW.md)
- [EXTENSION-SEAMS.md](/home/trajan/Projects/ema/docs/backend/EXTENSION-SEAMS.md)
- [RUNTIME-FABRIC.md](/home/trajan/Projects/ema/docs/backend/RUNTIME-FABRIC.md)
- [FUTURE-AGENT-HANDOFF-2026-04-12.md](/home/trajan/Projects/ema/docs/backend/FUTURE-AGENT-HANDOFF-2026-04-12.md)
