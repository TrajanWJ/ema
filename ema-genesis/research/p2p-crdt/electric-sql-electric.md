---
id: RES-electric
type: research
layer: research
category: p2p-crdt
title: "electric-sql/electric — Elixir sync engine with shape-based partial replication"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/electric-sql/electric
  stars: 10058
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, p2p-crdt, signal-S, electric, sync, shapes, elixir]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/loro-dev-loro]]", relation: references }
---

# electric-sql/electric

> 10k stars. Elixir sync engine that streams **filtered Postgres shapes** to clients — replaces bespoke WebSocket backends. **The Shape concept is what EMA needs.** Bonus: same language as the old daemon, so it's a direct code study.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/electric-sql/electric> |
| Stars | 10,058 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **S** |
| Language | Elixir + Postgres |

## What to steal

### 1. The Shape concept

A "Shape" is a filtered slice of a database table. Clients subscribe to shapes, not to the whole table. Example: "give me intents in space:work tagged urgent."

EMA's old build broadcasts ALL mutations to ALL subscribed clients via Phoenix channels. The 67 Zustand stores each subscribe to a full channel — nothing supports "subscribe to just this slice." **Electric names the problem and shows the fix.**

### 2. Elixir reference implementation

Read `Electric.ShapeCache` and `Electric.Replication.ShapeLogCollector` for how they handle partial replication with back-pressure inside an OTP supervision tree. The patterns transfer to TypeScript even though the code stays Elixir.

### 3. Shape module sits between writes and broadcasts

```
Context module → mutates DB
       ↓
Shape module → filters → matches subscribed clients
       ↓
Channel broadcast → only to interested clients
```

EMA's TypeScript port should have the same middleware: a `Sync.Shape` module between writes and broadcasts.

## Changes canon

| Doc | Change |
|---|---|
| `SCHEMATIC-v0.md` | Add Shape module between contexts and channels |
| `vapps/CATALOG.md` | Reference Electric patterns for partial replication |

## Gaps surfaced

- EMA's broadcast strategy doesn't scale past a single user. Electric's shapes are the primitive for "subscribe to a filtered slice."

## Notes

- Electric is NOT P2P — Postgres is the source of truth. Use it as the partial-replication pattern, not as a sync topology.
- **Same language as the old daemon** — direct code study.

## Connections

- `[[research/p2p-crdt/loro-dev-loro]]` — alternative architecture (CRDT vs Postgres-source)
- `[[research/p2p-crdt/automerge-automerge-repo]]`

#research #p2p-crdt #signal-S #electric #shapes #elixir
