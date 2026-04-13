---
id: EXE-006
type: execution
layer: executions
title: "Ingestion v1 — local agent archaeology service + CLI backfeed surface"
status: completed
created: 2026-04-12
updated: 2026-04-12
completed_at: 2026-04-12
connections:
  - { target: "[[intents/INT-CHANNEL-INTEGRATIONS]]", relation: surfaces }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[executions/EXE-004-cli-sprint]]", relation: builds_on }
tags: [execution, ingestion, archaeology, sessions, agent-configs, backfeed]
---

# EXE-006 — Ingestion v1

The Archaeologist exists now in both the CLI and the services layer.

## What landed

### CLI surface

The `ema ingest` surface is live against real local data:

- `ema ingest scan`
- `ema ingest sessions [--agent=X]`
- `ema ingest backfeed [--agent=X]`
- `ema ingest status`

Future external links are reserved and explicitly deferred:

- `ema ingest link claude.ai`
- `ema ingest link chatgpt`
- `ema ingest link discord <channel>`
- `ema ingest link imessage`

### Core service

`services/core/ingestion/` now exists with the expected pattern:

- `schema.ts`
- `service.ts`
- `routes.ts`
- `mcp-tools.ts`
- `index.ts`
- `ingestion.router.ts`

HTTP surface:

- `GET /api/ingestion/scan`
- `GET /api/ingestion/sessions`
- `POST /api/ingestion/backfeed`
- `GET /api/ingestion/status`

### Local archaeology coverage

The implementation currently understands:

- agent config discovery under `$HOME` and repo-local config roots
- Codex local history/session files
- Claude local session files
- unified session timeline entries with:
  - timestamp
  - agent
  - project
  - message count
  - opening prompt
  - session path

Backfeed generation now derives draft proposals from those opening prompts with
`source: agent_session_import`.

### Canon follow-up

`INT-CHANNEL-INTEGRATIONS` was created so the deferred external-import commands
point at a real canon node instead of a fictional placeholder.

## Verification

- `pnpm --filter @ema/services build`
- `pnpm --filter @ema/services test -- --run`
- `pnpm --filter @ema/cli build`
- `pnpm --filter @ema/cli exec node dist/index.js ingest scan --format json`
- `pnpm --filter @ema/cli exec node dist/index.js ingest sessions --agent codex --format json`
- `pnpm --filter @ema/cli exec node dist/index.js ingest backfeed --agent codex --format json`

That satisfies the v1 success bar:

- scan finds real local agent configs
- sessions parses at least one real history source into a timeline
- backfeed generates at least one draft proposal from discovered session data

## Explicitly not built yet

- OAuth/API ingestion for remote services
- automatic canon writes from discovered sessions
- persistent graph storage for imported session rows
- Discord/iMessage/ChatGPT/claude.ai connectors

Those remain deferred behind `INT-CHANNEL-INTEGRATIONS`.

#execution #ingestion #sessions #backfeed #agent-archaeology
