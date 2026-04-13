---
id: RES-loro
type: research
layer: research
category: p2p-crdt
title: "loro-dev/loro — Rust CRDT with movable tree, columnar encoding, time-travel history"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/loro-dev/loro
  stars: 5502
  verified: 2026-04-12
  last_activity: 2026-04-09
signal_tier: S
tags: [research, p2p-crdt, signal-S, loro, crdt, movable-tree]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/automerge-automerge-repo]]", relation: references }
  - { target: "[[research/p2p-crdt/yjs-yjs]]", relation: references }
  - { target: "[[DEC-002]]", relation: references }
---

# loro-dev/loro

> Rust-core CRDT framework with **movable tree CRDT** as a first-class operation. The right pick for EMA's structured data sync per `[[DEC-002]]`. Newer, smaller, faster than Automerge for whole-tree semantics.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/loro-dev/loro> |
| Stars | 5,502 (verified 2026-04-12) |
| Last activity | 2026-04-09 |
| Signal tier | **S** |
| Bindings | Rust core + WASM (JS/TS) + Swift |

## What to steal

### 1. Movable tree CRDT

The killer feature. Tree moves preserve identity across rename and move operations. EMA's space nesting (org > team > project) is a tree where users *will* drag things around — Loro handles this without splitting the moved subtree's identity.

Yjs and Automerge don't have this. Loro is the only CRDT that does it cleanly.

### 2. Columnar encoding

Snapshots are columnar (inspired by Automerge) — smaller on disk and on the wire than row-based formats. EMA's eventual P2P story benefits.

### 3. Built-in time-travel history

Free version history for any Loro doc. EMA gets per-intent / per-task / per-canvas history without writing a separate history schema.

### 4. Rich text + movable list + LWW map

Multiple CRDT primitives in one library. EMA can pick the right type per data shape:
- `LoroText` for rich text (intent description, canon docs)
- `LoroList` for ordered collections (task list, journal entries)
- `LoroMap` for key-value (settings, frontmatter)
- `LoroTree` for hierarchies (spaces, intent parent/child)

### 5. WASM bindings

Direct integration with EMA's Electron renderer. No FFI shenanigans, no separate process.

## Changes canon

| Doc | Change |
|---|---|
| `[[DEC-002]]` | Loro is the named pick for structured-data CRDT (vs Yjs/Automerge) |
| `EMA-GENESIS-PROMPT.md §9` | The CRDT-everywhere assumption is wrong; Loro for structured data, Syncthing for files |

## Gaps surfaced

- EMA canon assumed CRDT is the answer for everything. Loro proves you can pick the right CRDT *type* per data shape, but only if the engine has multiple types.

## Notes

- Active development, weekly commits.
- Time-travel history is a free feature EMA didn't ask for but should design around.
- Columnar encoding is the same trick Automerge uses, smaller snapshots than Yjs.

## Connections

- `[[research/p2p-crdt/automerge-automerge-repo]]` — Repo abstraction cousin
- `[[research/p2p-crdt/yjs-yjs]]` — alternative for collaborative text editing
- `[[research/p2p-crdt/syncthing-syncthing]]` — file-sync complement
- `[[DEC-002]]` — sync split decision

#research #p2p-crdt #signal-S #loro #crdt #movable-tree
