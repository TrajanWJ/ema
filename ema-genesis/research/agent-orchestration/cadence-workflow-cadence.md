---
id: RES-cadence
type: research
layer: research
category: agent-orchestration
title: "cadence-workflow/cadence — Uber's predecessor to Temporal (architecture reference only)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
source:
  url: https://github.com/cadence-workflow/cadence
  stars: 9254
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: B
tags: [research, agent-orchestration, signal-B, cadence, predecessor]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/temporalio-temporal]]", relation: references }
---

# cadence-workflow/cadence

> Uber's original durable workflow engine. Temporal's predecessor. Same authors, different tradeoffs. **Read for the original architecture documents, skip the runtime.**

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/cadence-workflow/cadence> |
| Stars | 9,254 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **B** |
| Language | Go (no first-class TS SDK) |

## What to read (not steal)

Same core model as Temporal — event-history-backed replay, sticky workers, task queues — but older with different tradeoffs:
- More opinionated about cluster topology
- Less modern SDK surface
- Apache 2.0, still actively maintained (v1.4.0 Feb 2026)
- Go and Java SDKs only; community Python/Ruby

**Skip in favor of Temporal for EMA** unless you specifically need a pattern Temporal removed.

## Changes canon

None directly. Reference in AGENT-RUNTIME.md as the ancestor pattern.

## Notes

- Go-only SDK officially. Not TS-friendly.
- Worth reading the architecture docs at github.com/temporalio/sdk-core/blob/master/arch_docs/sticky_queues.md — actually authored by ex-Cadence folks, the cleanest explanation of the sticky queue protocol.
- Historical interest only.

## Connections

- `[[research/agent-orchestration/temporalio-temporal]]` — successor

#research #agent-orchestration #signal-B #cadence #historical
