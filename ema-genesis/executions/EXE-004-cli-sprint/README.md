---
id: EXE-004
type: execution
layer: executions
title: "Commander CLI sprint — canon-first EMA command surface with service fallback"
status: completed
created: 2026-04-12
updated: 2026-04-12
completed_at: 2026-04-12
connections:
  - { target: "[[intents/INT-RECOVERY-WAVE-1]]", relation: fulfills }
  - { target: "[[canon/decisions/DEC-006-deferred-cli-features]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
  - { target: "[[intents/INT-PROPOSAL-PIPELINE]]", relation: surfaces }
  - { target: "[[intents/INT-EXECUTION-DISPATCHER]]", relation: surfaces }
tags: [execution, cli, commander, canon-first, v1-blocking]
---

# EXE-004 — Commander CLI sprint

The CLI now has a real spine.

`cli/` no longer depends on the half-built `oclif` command set for the user-facing
surface. The shipped entrypoint is a Commander program that reads and writes
canonical markdown directly under `ema-genesis/`, while still probing the live
services layer for operational namespaces where HTTP is already the source of
truth.

## What landed

- `ema --help` / `ema --version` via Commander.
- Global formatter contract: `--format table|json|yaml`.
- Canon-aware file store in `cli/src/lib/genesis-store.ts` covering:
  - intents
  - executions
  - proposals
  - canon docs
  - graph edges
  - dumps
  - agent config/session archaeology
- Service probe shim in `cli/src/lib/service-connection.ts`.
- New bin entrypoints in `cli/bin/run.js` and `cli/bin/dev.js`.
- Tier 1 command surface:
  - `ema intent list|view|create|update|tree|runtime|link`
  - `ema proposal list|view|create|approve|reject|revise`
  - `ema exec list|view|create|complete|checkpoint`
  - `ema canon list|view|write|search`
- Tier 2 command surface:
  - `ema graph connect|disconnect|traverse|layers|export|reindex`
  - `ema queue next|suggest|backlog`
  - `ema blueprint gac list|answer|defer`
  - `ema blueprint blockers|aspirations`
- Tier 3 command surface:
  - `ema dump <text>|list|promote`
  - `ema vault status|seed|watch`
  - `ema pipe list|fire|history`
  - `ema agent list|status|config`
  - `ema status`
  - `ema services start|status`
- Ingestion CLI scaffolding also landed early because it naturally reuses the
  same filesystem/session-archaeology primitives:
  - `ema ingest scan`
  - `ema ingest sessions`
  - `ema ingest backfeed`
  - `ema ingest status`
  - future `ema ingest link ...` stubs

## Verification

- `pnpm --filter @ema/cli build`
- `pnpm --filter @ema/cli exec node dist/index.js intent list --format json`
- `pnpm --filter @ema/cli exec node dist/index.js canon search blueprint --format json`
- `pnpm --filter @ema/cli exec node dist/index.js status --format json`

Those checks confirm the success bar from the sprint brief:

- `ema intent list` shows real intent files from `ema-genesis/intents/`
- `ema canon search "blueprint"` finds real canon nodes
- `ema status` reports real local health and service reachability

## Decisions made

- Canon writes stay file-backed even when services are live. The services layer
  does not yet mirror all writes back into `ema-genesis/`, so the CLI must treat
  markdown as the source of truth.
- Live HTTP probing is used where the daemon already owns state or operational
  control: health, vault seeding, pipe history, service status.
- Proposal storage is established as `ema-genesis/proposals/` so the CLI and the
  future ingestion backfeed have a reviewable file-backed queue instead of a
  service-only blind spot.

## Follow-ups surfaced

1. Backend parity: several CLI verbs intentionally degrade when the matching
   service route does not exist yet (`pipe fire`, `vault watch`, external ingest
   links). Those should either gain routes or be locked as deferred.
2. Proposal pipeline integration: the file-backed proposal queue exists, but it
   is not yet bridged to `services/core/proposal/` or the multi-stage pipeline in
   `INT-PROPOSAL-PIPELINE`.
3. Execution dispatcher integration: `ema exec create` writes canon, but there is
   still no live dispatcher consuming approved work (`INT-EXECUTION-DISPATCHER`).

#execution #cli #commander #canon-first #service-fallback
