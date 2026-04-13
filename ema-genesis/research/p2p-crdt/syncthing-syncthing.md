---
id: RES-syncthing
type: research
layer: research
category: p2p-crdt
title: "syncthing/syncthing — BEP protocol for P2P file folder sync"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/syncthing/syncthing
  stars: 81623
  verified: 2026-04-12
  last_activity: 2026-04-12
  license: MPL-2.0
signal_tier: S
tags: [research, p2p-crdt, signal-S, syncthing, file-sync, bep]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/loro-dev-loro]]", relation: references }
  - { target: "[[DEC-002]]", relation: references }
---

# syncthing/syncthing

> 81k stars. The reference implementation of "two machines agree on the state of a folder without a central server." Per `[[DEC-002]]`, this is the right transport for EMA's wiki/canon/intents/research markdown folders. **CRDTs are wrong for human-edited markdown — Syncthing is right.**

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/syncthing/syncthing> |
| Stars | 81,623 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **S** |
| License | MPL-2.0 (embeddable) |
| Language | Go |

## What to steal

### 1. The BEP (Block Exchange Protocol)

10+ years of production hardening. Block-level deduplication (good for vault scale). Conflict resolution via version suffix preservation. Selective sync per folder. Bandwidth limits. Discovery via introducer pattern.

EMA can either:
- **Embed Syncthing as a sidecar** — bundle the binary, run as a subprocess, configure folder mappings via API
- **Re-implement BEP** — too much work, don't do this

### 2. The introducer pattern → "host peer"

Syncthing has the concept of an "introducer" — a peer that introduces other peers to each other. Maps directly onto EMA's "host peer" concept from canon. Free service-discovery story.

### 3. Per-folder selective sync

Each folder can be:
- Bidirectional sync
- Send-only (this device pushes, others receive)
- Receive-only (this device pulls, never overwrites locally)
- Pattern-based (only sync `*.md`, ignore `*.tmp`)

EMA's per-space public/private and selective sync model is exactly this. Per-space folder mapping.

### 4. Conflict resolution preserves both versions

When two devices edit the same file simultaneously, Syncthing keeps both:
```
note.md
note.sync-conflict-20260412-080000-AB12CD3.md
```

The user picks. EMA's Vault vApp surfaces conflict files in a dedicated tray.

### 5. Block-level dedup

Files are split into blocks. Identical blocks are referenced, not duplicated. Big files (videos, PDFs, large markdown) sync incrementally and de-dup across files.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §9` | Reconsider CRDT-everywhere assumption. Wiki sync = Syncthing; structured-data sync = CRDT. |
| `[[DEC-002]]` | Syncthing is the named pick for vault folder sync |
| `vapps/CATALOG.md` Vault | Add conflict-file UI for Syncthing-style two-version resolution |

## Gaps surfaced

- **BIG contradiction in canon.** EMA was assuming CRDT for wiki sync. But the wiki is markdown files in a folder edited in Obsidian. Obsidian writes raw bytes; CRDTs need operation streams. Syncthing solves this directly. CRDT for *structured* data only.

## Notes

- 81k stars, MPL-2.0 license (embeddable), 10+ years production-tested.
- Go binary — embed as sidecar.
- The introducer pattern is the cleanest discovery mechanism in P2P file sync. EMA's host peer becomes a Syncthing introducer.

## Connections

- `[[research/p2p-crdt/loro-dev-loro]]` — the CRDT half (structured data)
- `[[research/p2p-crdt/automerge-automerge-repo]]` — Repo wrapper for the CRDT half
- `[[DEC-002]]` — sync split decision

#research #p2p-crdt #signal-S #syncthing #file-sync #bep
