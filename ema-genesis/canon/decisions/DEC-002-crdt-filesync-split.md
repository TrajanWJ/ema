---
id: DEC-002
type: canon
subtype: decision
layer: canon
title: "Sync split: file-sync (Syncthing) for human-edited markdown, CRDT (Loro/Automerge) for structured data"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
decided_by: human
supersedes:
  - "EMA-GENESIS-PROMPT.md §5 (CRDT for everything)"
  - "EMA-GENESIS-PROMPT.md §9 (P2P sync handwave)"
connections:
  - { target: "[[EMA-GENESIS-PROMPT]]", relation: supersedes }
  - { target: "[[research/p2p-crdt/syncthing-syncthing]]", relation: derived_from }
  - { target: "[[research/p2p-crdt/loro-dev-loro]]", relation: derived_from }
  - { target: "[[research/p2p-crdt/automerge-automerge-repo]]", relation: derived_from }
  - { target: "[[research/p2p-crdt/yjs-yjs]]", relation: references }
  - { target: "[[research/p2p-crdt/electric-sql-electric]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
tags: [decision, sync, crdt, syncthing, p2p, locked]
---

# DEC-002 — Sync Split: File-Sync vs CRDT

> **Status:** Locked 2026-04-12. Closes the "CRDT for everything" assumption in `EMA-GENESIS-PROMPT.md` §5.

## The Decision

EMA uses **two different sync mechanisms** for two different classes of data:

| Class | Sync mechanism | Why |
|---|---|---|
| **Human-edited markdown** (wiki, canon, intents, research, vault notes) | **Syncthing-style file folder sync** (BEP protocol) | Humans edit these in Obsidian / vim / VS Code / any text editor that emits raw bytes. CRDTs require operation streams from CRDT-aware editors. They don't help when the write path is "text editor saves bytes." |
| **Structured app state** (tasks, brain dump items, canvas elements, intent state, schedule, pomodoro state, agent execution state) | **Loro / Automerge CRDT** | These are EMA-internal data structures mutated by EMA's own UI. Multiple EMA instances on multiple machines can edit them concurrently. CRDTs solve concurrent edits cleanly. |

Two transports. One app. Clean boundaries. No overlap.

## Why

### The big finding from cross-pollination research

`[[research/p2p-crdt/syncthing-syncthing]]` (81k stars, BEP protocol) is the production reference for "two machines agree on the state of a folder without a central server." It solves problems EMA was about to reinvent badly:

- Conflict resolution (keeps both with version suffix)
- Ignore patterns
- Selective sync per folder
- Bandwidth limits
- Introducer-based peer discovery (which maps directly onto EMA's "host peer" concept)

Meanwhile, `[[research/p2p-crdt/loro-dev-loro]]` (5.5k stars) and `[[research/p2p-crdt/automerge-automerge-repo]]` (Repo abstraction over Automerge core) are designed for *operation streams from CRDT-aware editors*. They expect each edit to be expressed as a CRDT op, not a text-editor save.

### The contradiction in canon

`EMA-GENESIS-PROMPT.md` §5 says **"CRDT-based collaborative editing of wiki"** and `§9` extends this to "all storage." This is wrong for the wiki layer specifically. Here's why:

1. The wiki / canon / intents / research folders exist in `~/.local/share/ema/vault/` (or equivalent) and are edited in **Obsidian** (the user's actual workflow).
2. Obsidian writes raw markdown bytes to disk. It does not emit Y.Doc operations or Automerge changesets.
3. To force Obsidian writes through a CRDT, you'd need either (a) a CRDT-aware Obsidian plugin (doesn't exist for full vault sync), or (b) a watcher that diffs file states and emits operations (loses fidelity, can't recover from concurrent edits).
4. **Syncthing solves this directly**: two Obsidian instances on two machines, each writing files normally, Syncthing reconciles the folder state.

### Where CRDTs actually help

Loro/Automerge **shine** for the structured-data half of EMA — the things where multiple machines might edit the same record at the same time:

| Data | Why CRDT |
|---|---|
| Task status changes | Two machines might mark a task done/cancelled simultaneously |
| Brain dump entries | New captures from any device should merge |
| Canvas element positions | Two users dragging the same element |
| Intent state transitions | Phase changes from any device |
| Agent execution journals | Step recording from any node |
| Schedule blocks | Drag/drop reordering across devices |

For these, the CRDT is the right primitive. There is no Obsidian writing the bytes; EMA's own UI is the only writer.

### Why specifically Syncthing + Loro

**Syncthing winners over alternatives:**
- 81k stars, MPL-2.0 (embeddable)
- Production-tested for 10+ years
- Block-level deduplication (good for vault scale)
- Introducer pattern = EMA's "host peer" concept
- Selective sync (per-folder visibility = per-space visibility)
- Conflict resolution preserves both versions

**Loro winners over alternatives for structured data:**
- Movable tree CRDT (first-class folder/tree moves preserving identity across rename)
- Rust core + WASM bindings = clean Electron integration
- Columnar encoding (smaller snapshots than Yjs or Automerge)
- Built-in time-travel history (free version history for intents/tasks)
- Active development (5.5k stars, weekly commits)

**Why not Yjs:** Excellent for collaborative text editing (Notion-style use cases) but Y.Doc is per-document and EMA needs whole-tree CRDT semantics. Yjs's awareness protocol is still worth stealing for transient cursor/presence state — that's a separate concern (`[[DEC-XXX-presence-protocol]]`, future).

**Why not just Automerge:** Loro is newer, smaller, faster, and has the movable-tree CRDT Automerge lacks. But the **`automerge-repo` Repo abstraction** is conceptually right and Loro should adopt the same shape: a Repo owns many docs (one per intent, one per canvas, one per task list), with pluggable storage and transport adapters. Implement EMA's `Loro.Repo` wrapper following automerge-repo's interface.

### Why not single-storage-everything

Three options were considered:

1. **CRDT for everything** (canon's original assumption) — fails because Obsidian writes bytes, not ops.
2. **File-sync for everything** (just use Syncthing) — fails because EMA's UI generates concurrent structured edits that file-sync can't merge cleanly (it'd produce `task.json.sync-conflict-20260412-080000-AB12CD3.json` files).
3. **Split by data class (this decision)** — clean boundaries, each tool used for what it's best at, no fighting either tool's grain.

## Implementation Phases

### Phase 1 (Bootstrap v0.1) — manual

There is no sync in v1. The `ema-genesis/` folder is git-tracked, the workspace state lives locally. Multi-machine sync is a v2 concern. Decision is **locked now** so v1 code doesn't make sync-hostile choices.

### Phase 2 — Loro repo for structured data

| Component | Source pattern | Notes |
|---|---|---|
| `Loro.Repo` wrapper | Automerge-repo Repo abstraction | Many-docs, pluggable storage, pluggable transport |
| `Storage adapter` | better-sqlite3 (desktop) or IndexedDB (web) | Single backend per instance |
| `Transport adapter` | Phase 2: BroadcastChannel for cross-window IPC. Phase 3: WebSocket sync server. Phase 4: WebRTC peer-to-peer. | Pluggable, swap for richer transports as needed |
| `Doc-per-record convention` | One Loro doc per intent, per canvas, per task list, per brain-dump bucket | Lets the Repo lazy-load |

### Phase 3 — Syncthing-style folder sync for vault

| Component | Source pattern | Notes |
|---|---|---|
| Embedded Syncthing | The actual `syncthing` binary as a sidecar process | Don't reimplement BEP, use the reference implementation |
| Per-space folder mapping | Each EMA space = one synced folder + pattern | Enables per-space public/private and selective sync |
| Conflict resolution UI | Surface `.sync-conflict-*` files in the Vault vApp | Let the user pick or merge |
| Introducer = host peer | Map EMA's "host peer" concept onto Syncthing's introducer protocol | Free service-discovery story |

Alternative if embedding Syncthing proves too heavy: **`vlcn-io/cr-sqlite`** as the unified store with CRDT columns on selected tables. Worth a spike but currently dormant (last push 2024-10).

### Phase 4 — Awareness protocol

For "who is editing what right now" (transient presence state), neither Syncthing nor Loro is the answer. Steal Yjs's `y-protocols/awareness` pattern: a non-persisted WebSocket channel for cursor/presence updates. This is its own decision (future `DEC-XXX`), don't bake it into either of the above.

## What This Replaces in Old Build

| Old Elixir module | Status | Notes |
|---|---|---|
| `Ema.Bridge.NodeCoordinator` (libcluster, distributed Erlang) | **DROP** | Replaced by Syncthing for files + Loro Repo transport for structured data |
| `Ema.Bridge.SyncCoordinator` (DeltaCrdt.AWLWWMap) | **DROP** | DeltaCrdt is stuck-on-Erlang; Loro is stack-native for TS |
| `Ema.Bridge.ClusterConfig` (libcluster topologies) | **DROP** | Tailscale + Syncthing introducer covers the discovery problem cleanly |
| Phoenix.PubSub between nodes | **DROP** | Per-instance EventEmitter only; cross-machine eventing happens through the Loro Repo transport |

## Open Follow-Ups

1. **How does Loro handle 1000+ docs per repo at scale?** Round 1 didn't surface benchmarks. Round 2 R2-A is investigating durable workflow engines (relevant). A targeted spike with EMA's actual data shapes is needed before Phase 2.
2. **Tailscale as the implicit transport for cross-machine sync** — the user mentioned Tailscale earlier. Document this in `[[DEC-XXX-network-transport]]` as the assumed underlay; both Syncthing and Loro Repo use it transparently.
3. **What about a single user, single machine?** Do we still need both? Yes — Loro Repo gives free version history for structured data even with no peers; Syncthing folder watch is just a no-op in single-instance mode.
4. **When two machines disagree on schema (different EMA versions)**, what wins? Syncthing keeps both files; Loro needs schema migration. This is a Phase 3 problem.
5. **Permission model integration with Jazz Groups** — `[[research/p2p-crdt/garden-co-jazz]]` showed the Group + role model is cleaner than what canon currently has. Steal it as a separate decision (`DEC-XXX-membership-model`) and apply it to both sync transports.
6. **`vlcn-io/cr-sqlite` as a third option** — dormant but conceptually clean. Re-evaluate before Phase 3 if it's been forked or revived.

## Connections

- `[[_meta/CANON-STATUS]]` — the ruling that says Genesis maximalist canon wins
- `[[DEC-001]]` — graph engine decision (the Object Index lives in SQLite, not synced via either of these)
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §5 graph wiki — what this decision contradicts
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9 P2P — what this decision starts to fill in
- `[[research/p2p-crdt/syncthing-syncthing]]` — primary file-sync source
- `[[research/p2p-crdt/loro-dev-loro]]` — primary CRDT source
- `[[research/p2p-crdt/automerge-automerge-repo]]` — Repo abstraction source
- `[[research/p2p-crdt/garden-co-jazz]]` — permission model future-source
- `[[research/p2p-crdt/dxos-dxos]]` — HALO/ECHO/MESH layer split future-source

#decision #canon #sync #crdt #syncthing #loro #p2p #locked
