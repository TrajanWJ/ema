# Source Of Truth / Trust Hierarchy

## Primary Semantic Truth

- `ema-genesis/`
  - Highest-trust semantic source for canon, intents, and GAC cards.
- Filesystem intent sources consumed by the current indexer
  - `ema-genesis/intents/`
  - `.superman/intents/`

For `intent` and `gac_card`, filesystem content wins. SQLite is a mirror.

## Primary Operational Truth

- `~/.local/share/ema/ema.db`

SQLite is the primary runtime store for:

- indexed intent rows
- indexed GAC rows
- chronicle sources/sessions/entries/artifacts metadata
- chronicle extractions, review items, and promotion receipts
- goals
- calendar entries
- runtime tool scans
- managed runtime session metadata
- spaces
- executions
- user state
- projects/tasks/brain-dump
- supporting runtime tables

For `goal`, `calendar_entry`, `space`, `execution`, `chronicle_extraction`, `review_item`, `promotion_receipt`, `user_state`, `project`, `task`, and `brain_dump`, SQLite is the source of truth.

For runtime sessions:

- tmux pane/session state is the live runtime truth
- SQLite stores the durable mirror for managed session metadata and tool scans
- the active service owner is `services/core/runtime-fabric`

For Chronicle metadata:

- raw imported payloads and stored Chronicle artifacts live under `~/.local/share/ema/chronicle/`
- SQLite is the query/index layer for Chronicle sessions, entries, artifacts, Chronicle extractions, review items, and promotion receipts
- Chronicle remains the raw/source landing zone; Review must retain provenance back to Chronicle ids instead of replacing Chronicle storage

## Generated / Evidence Layers

- `~/.local/share/ema/artifacts/`
  - Prompt/context/response artifacts
- `~/.local/share/ema/results/`
  - Result markdown and related execution outputs
- `~/.local/share/ema/chronicle/`
  - Raw Chronicle payloads, normalized session bundles, and imported artifacts

These are durable and important, but they are generated evidence, not canonical control-plane truth.

## Low-Trust / Historical Context

- `~/.local/share/ema/vault/wiki/`
- `.superman/project.md`
- `.superman/context.md`
- `hq-api/`
- `hq-frontend/`
- `scripts/ema`
- old architecture docs that describe the Tauri/Elixir stack as current

Use these for archaeology only.

## Ephemeral State

- websocket subscriptions
- in-process pubsub
- visibility hub state
- worker timers and watches

This state is explicitly non-durable and must never be treated as a system source of truth.

## Current Rule

When layers disagree, trust them in this order:

1. `ema-genesis/` and active filesystem intent/GAC sources
2. Active TypeScript runtime code under `services/core/{intents,blueprint,chronicle,review,goals,calendar,spaces,executions,user-state,runtime-fabric}`
3. SQLite operational state and Chronicle raw imports
4. Generated artifacts/results
5. Vault/wiki and legacy docs
