---
id: RES-yjs
type: research
layer: research
category: p2p-crdt
title: "yjs/yjs — battle-tested CRDT with awareness protocol for transient state"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/yjs/yjs
  stars: 21617
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: A
tags: [research, p2p-crdt, signal-A, yjs, awareness]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/loro-dev-loro]]", relation: references }
  - { target: "[[DEC-002]]", relation: references }
---

# yjs/yjs

> 21k stars. Mature CRDT for collaborative editing. **Steal the awareness protocol** for transient cursor/presence state — even though Loro is the right pick for EMA's persistent CRDT layer.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/yjs/yjs> |
| Stars | 21,617 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **A** |

## What to steal

### 1. The awareness protocol (the key insight)

Yjs ships a separate `y-protocols/awareness` for **transient** cursor/presence state that isn't persisted. This is the split EMA needs:

| Layer | Persisted? | Use |
|---|---|---|
| **CRDT doc** | Yes | Canonical intent/wiki state |
| **Awareness** | No | "Who's editing what right now", cursor positions |

Phoenix Presence covers 60% of this but not the per-document granularity. EMA's awareness layer is its own concern, separate from the persistent CRDT.

### 2. The successor for sync servers: `y-sweet`

`jamsocket/y-sweet` (989 stars, pushed Dec 2025) is how production Yjs sync servers handle persistence to S3/SQLite. Reference for EMA's eventual sync server design even though Yjs isn't the chosen CRDT.

## Changes canon

| Doc | Change |
|---|---|
| `SCHEMATIC-v0.md` | Add awareness layer separate from CRDT persistence |
| `[[DEC-002]]` | Note: Yjs awareness pattern is the model for transient state alongside Loro's persistent state |

## Gaps surfaced

- EMA conflates "who's online" (Phoenix Presence) with "who's editing intent-47 right now" (per-doc awareness). These are different problems.

## Notes

- Skip Yjs as the persistent CRDT (Loro is better for whole-tree). Steal the awareness pattern only.

## Connections

- `[[research/p2p-crdt/loro-dev-loro]]` — recommended persistent CRDT
- `[[research/p2p-crdt/automerge-automerge-repo]]` — Repo abstraction
- `[[DEC-002]]`

#research #p2p-crdt #signal-A #yjs #awareness
