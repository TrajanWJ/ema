# Session Manifest

## What Shipped

### CLI sprint

- Commander-based CLI entrypoint in `cli/`
- file-backed canon store for intents, executions, proposals, canon docs, graph links, dumps, and local agent archaeology
- live command surface for:
  - `intent`
  - `proposal`
  - `exec`
  - `canon`
  - `graph`
  - `queue`
  - `blueprint`
  - `dump`
  - `vault`
  - `pipe`
  - `agent`
  - `status`
  - `services`
  - `ingest`

### Backend hardening

- root `pnpm build` green
- root `pnpm test` green
- `shared/sdk/index.ts` cleaned up so live routes are real and missing seams are explicitly `@deferred`
- real SDK-backed endpoints added for:
  - `GET /api/agents/status`
  - `POST /api/proposals`
  - `POST /api/proposals/:id/approve`
- pipe bus wiring added for:
  - brain dump create/process
  - task create/status/completion
  - project create/status change
  - proposal generated/approved/killed/redirected
  - daemon boot
- worker smoke tests added and wired into Turbo

### Ingestion vApp v1

- `services/core/ingestion/` created with schema/service/routes/router/MCP tools
- service routes:
  - `GET /api/ingestion/scan`
  - `GET /api/ingestion/sessions`
  - `POST /api/ingestion/backfeed`
  - `GET /api/ingestion/status`
- CLI ingestion commands working against real local agent histories
- new canon intent: `INT-CHANNEL-INTEGRATIONS`

## Tests Pass

- `pnpm --filter @ema/cli build`
- `pnpm --filter @ema/shared build`
- `pnpm --filter @ema/services build`
- `pnpm --filter @ema/services test -- --run`
- `pnpm --filter @ema/workers build`
- `pnpm --filter @ema/workers test`
- `pnpm build`
- `pnpm test`

## Still Broken

- generic intent patching through the SDK remains deferred; only create/list/get are honest today
- vault read/search/write service routes do not exist yet
- canon read/write service routes do not exist yet
- ingestion backfeed generates reviewable draft proposals in output, but does not persist imported session rows into a dedicated graph layer yet
- external channel imports are still stubs only (`claude.ai`, `chatgpt`, `discord`, `imessage`)
- the workspace still contains pre-existing unrelated modifications outside this session

## New Intents Created

- `ema-genesis/intents/INT-CHANNEL-INTEGRATIONS/README.md`

## Execution Records Written

- `ema-genesis/executions/EXE-004-cli-sprint/README.md`
- `ema-genesis/executions/EXE-005-backend-green/README.md`
- `ema-genesis/executions/EXE-006-ingestion-v1/README.md`

## Recommended Next Session Focus

1. Add a real `services/core/canon` surface so the SDK and renderer can stop treating canon as a CLI-only seam.
2. Add a real `services/core/vault` HTTP surface or explicitly keep that domain CLI-only and remove SDK ambiguity.
3. Persist ingestion outputs into a first-class graph layer (`ema-genesis/sessions/` or equivalent) instead of returning ephemeral reports only.
4. Bridge file-backed CLI proposals with the loop proposal/execution services so proposal review and execution dispatch use one queue.
