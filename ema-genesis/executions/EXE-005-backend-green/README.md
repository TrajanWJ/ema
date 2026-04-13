---
id: EXE-005
type: execution
layer: executions
title: "Backend hardening — green root build, SDK parity cleanup, worker smoke tests"
status: completed
created: 2026-04-12
updated: 2026-04-12
completed_at: 2026-04-12
connections:
  - { target: "[[intents/INT-RECOVERY-WAVE-1]]", relation: fulfills }
  - { target: "[[intents/INT-PROPOSAL-PIPELINE]]", relation: advances }
  - { target: "[[canon/specs/PIPES-SYSTEM]]", relation: references }
  - { target: "[[intents/GAC-006]]", relation: advances }
tags: [execution, backend, sdk, pipe-bus, workers, green]
---

# EXE-005 — Backend hardening

The workspace is green at the root and the contracts are materially less dishonest.

## What landed

### Build + test health

- `pnpm build` passes at the repo root.
- `pnpm test` passes at the repo root.
- `workers/` now has a real `test` script and smoke coverage instead of being
  invisible to Turbo's test graph.

### SDK parity cleanup

`shared/sdk/index.ts` was updated so the facade matches the daemon that actually
exists:

- real routes now unwrap the daemon envelopes correctly:
  - intents list/get/create
  - proposals seeds/harvested/create/approve
  - executions list/get/create
  - brain-dump list/create
  - spaces list/get/create
  - agents status
  - user-state current/update
- stale `@pending` markers are gone
- routes that still do not exist are explicitly marked `@deferred` with the
  missing service seam named:
  - generic intents patch
  - vault HTTP surface
  - canon HTTP surface

### Pipe bus wiring

The pipe registry stopped being mostly declarative. Live services now emit real
trigger traffic for the seams they own:

- `brain_dump:item_created`
- `brain_dump:item_processed`
- `tasks:created`
- `tasks:status_changed`
- `tasks:completed`
- `projects:created`
- `projects:status_changed`
- `proposals:generated`
- `proposals:approved`
- `proposals:killed`
- `proposals:redirected`
- `system:daemon_started`

### Missing route recovery

- `GET /api/agents/status` now exists in `services/core/actors/routes.ts`
- `POST /api/proposals` now mints a loop proposal from an intent id
- `POST /api/proposals/:id/approve` now approves a loop proposal

### Worker smoke coverage

`workers/src/workers.smoke.test.ts` exercises clean start/stop for:

- vault watcher
- session watcher
- intent watcher
- agent runtime heartbeat

The watcher modules now read environment variables at runtime instead of module
load, which makes them testable and less brittle in long-lived dev shells.

## Verification

- `pnpm --filter @ema/shared build`
- `pnpm --filter @ema/services build`
- `pnpm --filter @ema/services test -- --run`
- `pnpm --filter @ema/workers build`
- `pnpm --filter @ema/workers test`
- `pnpm build`
- `pnpm test`

## Deferred, explicitly

The SDK still defers three seams because there is no honest backend to point at:

1. generic `intents.update()` patch route
2. vault read/search/write HTTP surface
3. canon read/write HTTP surface

Those are deferred in code now rather than mislabeled as pending.

#execution #backend #sdk #pipes #workers #green
