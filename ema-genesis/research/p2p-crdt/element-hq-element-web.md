---
id: RES-element-web
type: research
layer: research
category: p2p-crdt
title: "element-hq/element-web — Matrix client-side validation for nested spaces"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-b
source:
  url: https://github.com/element-hq/element-web
  stars: 12968
  verified: 2026-04-12
  last_activity: 2026-04-11
  license: AGPL-3.0
signal_tier: S
tags: [research, p2p-crdt, matrix, element-web, client-validation]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/matrix-org-MSC1772]]", relation: references }
  - { target: "[[research/p2p-crdt/element-hq-synapse]]", relation: references }
---

# element-hq/element-web

> Matrix reference web client. Implements **client-side validation** for MSC1772 spaces in `apps/web/src/stores/spaces/SpaceStore.ts`. The TS code is more readable than synapse's Python for understanding "what does a client actually need to compute."

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/element-hq/element-web> |
| Stars | 12,968 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Key file | `apps/web/src/stores/spaces/SpaceStore.ts` |
| Signal tier | **S** |
| Language | TypeScript |
| License | AGPL-3.0 |

## What it is

Element's reference Matrix web client, written in TypeScript. The `SpaceStore` is the canonical client-side implementation of "given the Matrix protocol's space events, compute a usable navigable tree." This is what EMA's frontend needs to do.

## What to steal for EMA

### 1. `getParents()` — both-sides-required validation

> "Only respect a claimed parent if the sender has sufficient permissions in the parent to set child relations AND the parent still lists the room as a child."

Pseudocode:

```typescript
function getParents(roomId: string): string[] {
  const claimedParents = getMatrixState(roomId, "m.space.parent");
  return claimedParents.filter(parentId => {
    const parentChildren = getMatrixState(parentId, "m.space.child");
    if (!parentChildren.includes(roomId)) return false;
    const sender = parentChildren[roomId].sender;
    if (!hasPower(sender, parentId, "set-child")) return false;
    return true;
  });
}
```

### 2. `findRootSpaces()` — cycle handling

Resolves the global tree by finding spaces nobody else lists as a child. **Handles cycles by sorting room IDs deterministically.** When two spaces claim each other as parent, the one with the lower ID wins.

### 3. `rebuildParentMap()` — full rebuild path

When state changes invalidate the cached tree, rebuild from scratch in O(N). Linear; no incremental updates that can drift out of sync.

### 4. `getCanonicalParent()` — multi-parent resolution

When a room claims multiple parents (polyhierarchy), pick the primary one based on the `canonical: true` flag. Falls back to lowest room ID if no canonical flag.

### 5. `traverseSpace()` — DFS with visited-set

Cycle prevention via a visited set. Standard DFS pattern but worth copying because it's the load-bearing line between "tree" and "infinite recursion."

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `vapps/CATALOG.md` Space Manager | Mandate cycle detection, both-sides-verified edges, canonical parent selection, deterministic-ID tiebreak |
| `EMA-GENESIS-PROMPT.md §9` | Add client-side validation as a separate concern from server-side (the client must independently re-verify; can't trust the server's hierarchy) |

## Gaps surfaced

- **Canon is silent on cycle handling.** A UI that lets the user drag "project X under project Y" where Y is already under X needs explicit resolution. Element's deterministic room-ID sort is the simplest answer.
- **No client-side validation.** EMA assumes the daemon's view of the hierarchy is trusted. Matrix's design is "client must independently verify protocol-level constraints" — more robust against state desync.

## Notes

- TypeScript code is more readable than synapse's Python for understanding the validation logic. Read this file before designing EMA's space-hierarchy frontend.
- AGPL-3.0 — viral copyleft. **Do NOT copy code into EMA.** Read patterns, write fresh.
- The validation logic is ~600 lines in `SpaceStore.ts`. Worth a full read.

## Connections

- `[[research/p2p-crdt/_MOC]]`
- `[[research/p2p-crdt/matrix-org-MSC1772]]` — the spec
- `[[research/p2p-crdt/element-hq-synapse]]` — server-side reference impl
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9
- `[[vapps/CATALOG]]` Space Manager

#research #p2p-crdt #signal-S #matrix #element-web #client-validation #typescript
