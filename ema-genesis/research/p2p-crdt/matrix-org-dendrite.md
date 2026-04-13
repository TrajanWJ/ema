---
id: RES-dendrite
type: research
layer: research
category: p2p-crdt
title: "matrix-org/dendrite — Go Matrix homeserver (archived but readable)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-b
source:
  url: https://github.com/matrix-org/dendrite
  stars: 5643
  verified: 2026-04-12
  last_activity: 2024-11-25
signal_tier: A
tags: [research, p2p-crdt, signal-A, dendrite, matrix, archived, go-reference]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/element-hq-synapse]]", relation: references }
  - { target: "[[research/p2p-crdt/matrix-org-MSC1772]]", relation: references }
---

# matrix-org/dendrite

> Go Matrix homeserver. **Archived** but the implementation is still the cleanest reference for the MSC1772 walker. Go syntax is more readable than synapse's Python.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/matrix-org/dendrite> |
| Stars | 5,643 (verified 2026-04-12) |
| Last activity | 2024-11-25 (**archived**) |
| Signal tier | **A** (archived but still useful) |

## What to read

### 1. `roomserver/internal/query/query_room_hierarchy.go`

`QueryNextRoomHierarchyPage` is the cleanest Go implementation of the MSC2946 walker. Splits `authorised()` into `authorisedUser()` and `authorisedServer()`. The server authorisation path is the interesting one for EMA's federated story.

### 2. Server-resolved children

A server can resolve a child room even if the asking user isn't directly in it, as long as **some** user on that server is. This is the pattern for a single EMA node resolving space structure for all its agents.

### 3. `childReferences()` sorts by `origin_server_ts`

Explicit resolution of duplicate `m.space.child` claims using timestamps. Deterministic conflict handling.

## Changes canon

| Doc | Change |
|---|---|
| `SCHEMATIC-v0.md` | Add `via` list on space-child edges (which nodes know this child) |

## Gaps surfaced

- EMA canon has no "partial knowledge" concept. Federation often means knowing a space exists, knowing its ID, knowing a "via" node — but not having full state. EMA will hit this immediately on multi-device.

## Notes

- **Archived 2024-11-25.** Read the source as architecture reference, not as live dependency.
- Cleaner than Python for understanding the walker.

## Connections

- `[[research/p2p-crdt/matrix-org-MSC1772]]` — the spec
- `[[research/p2p-crdt/element-hq-synapse]]` — Python alternative

#research #p2p-crdt #signal-A #dendrite #archived #go-reference
