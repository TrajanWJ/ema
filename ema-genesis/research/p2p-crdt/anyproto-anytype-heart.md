---
id: RES-anytype-heart
type: research
layer: research
category: p2p-crdt
title: "anyproto/anytype-heart — Anytype middleware (proprietary storage warning)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-b
source:
  url: https://github.com/anyproto/anytype-heart
  stars: 387
  verified: 2026-04-12
  last_activity: 2026-04-09
signal_tier: A
tags: [research, p2p-crdt, signal-A, anytype, proprietary-storage, anti-pattern]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/anyproto-any-sync]]", relation: references }
---

# anyproto/anytype-heart

> Anytype's Go middleware that builds on `[[research/p2p-crdt/anyproto-any-sync]]`. Confirms that Anytype's storage is **protobuf, not markdown** — an architectural anti-pattern for EMA's vault-is-markdown rule, but a useful structural reference for the layer split.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/anyproto/anytype-heart> |
| Stars | 387 (verified 2026-04-12) |
| Last activity | 2026-04-09 |
| Signal tier | **A** |

## What to learn (not steal)

### 1. The storage format anti-pattern

Confirms via `/pb` (protobuf) directories: Anytype is **closed-format by design** — files are not human-readable markdown, they're proto-serialized blobs inside encrypted DAGs. For EMA's "vault is markdown" canon rule, this is the wrong direction.

### 2. The layer split is worth stealing

Anytype separates:
- **`any-sync`** — sync protocol (clean API, MIT, open)
- **`anytype-heart`** — middleware business rules

EMA's old daemon mashes both into one process. The split would force EMA to define a sync wire format independent of Ecto schemas. **Architectural reference, not a dependency.**

## Changes canon

| Doc | Change |
|---|---|
| `SCHEMATIC-v0.md` | Note the layer split: sync protocol is independent of business logic |

## Gaps surfaced

- Confirms EMA's bet on markdown-as-source-of-truth diverges from the leading P2P knowledge tool. Good or bad, the user should know they're betting the other way.

## Notes

- Skip as a direct source.
- Keep as architectural reference for the layer split.

## Connections

- `[[research/p2p-crdt/anyproto-any-sync]]` — the underlying open protocol

#research #p2p-crdt #signal-A #anytype #proprietary-storage
