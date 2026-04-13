---
id: RES-dxos
type: research
layer: research
category: p2p-crdt
title: "dxos/dxos — three-layer HALO/ECHO/MESH split for identity, data, transport"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/dxos/dxos
  stars: 501
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, p2p-crdt, signal-S, dxos, halo, echo, mesh, identity]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/garden-co-jazz]]", relation: references }
  - { target: "[[research/p2p-crdt/automerge-automerge-repo]]", relation: references }
---

# dxos/dxos

> Decentralized OS with the cleanest **identity/data/transport layer split** in the P2P space. Small (501 stars) but the architectural decomposition is exactly right for EMA's P2P story.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/dxos/dxos> |
| Stars | 501 (verified 2026-04-12) |
| Last activity | 2026-04-12 (active) |
| Signal tier | **S** |

## What to steal

### 1. The HALO/ECHO/MESH three-layer split

| Layer | Purpose | EMA mapping |
|---|---|---|
| **HALO** | Local key-pair identity | `Ema.Identity` |
| **ECHO** | P2P database over WebRTC | `Ema.Spaces.Membership` + `Ema.Sync.Doc` |
| **MESH** | Transport (signaling, NAT traversal) | `Ema.Sync.Transport` |

EMA's architecture currently has no clean separation. Identity (who you are), space membership (what you can see), and transport (how bytes move) are all tangled. **DXOS proves these are three independent concerns.**

### 2. Cryptographic peer identity (HALO)

Each peer generates its own keypair locally. Identity is independent of any server. EMA has no identity layer — current assumption is "the user is whoever runs the daemon," which breaks the moment you have two machines.

### 3. ECHO uses Automerge underneath

ECHO is built on `[[research/p2p-crdt/automerge-automerge-repo]]`. The Repo pattern at the data layer + DXOS's HALO/MESH at the wrapper layers = a working architecture EMA can reproduce.

### 4. Composer is the existence proof

DXOS's Composer app is the closest existing thing to "Obsidian but P2P." Read it as a reference for what an EMA-shaped product looks like.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §9` | Explicitly adopt HALO/ECHO/MESH decomposition |
| `SCHEMATIC-v0.md` | Add `Ema.Identity` as a separate concern from `Ema.Spaces.Membership` and `Ema.Sync.Transport` |

## Gaps surfaced

- **EMA has no identity layer.** Cryptographic peer identity is mandatory before "host" vs "regular" peer means anything.

## Notes

- Small community (501 stars) but the only project that genuinely nailed P2P spaces with identity.
- DXOS spaces are flat (no nesting) — same negative signal as Anytype.

## Connections

- `[[research/p2p-crdt/garden-co-jazz]]` — alternative permission model
- `[[research/p2p-crdt/automerge-automerge-repo]]` — the data layer DXOS uses
- `[[research/p2p-crdt/anyproto-any-sync]]` — alternative ACL model

#research #p2p-crdt #signal-S #dxos #halo #echo #mesh #identity
