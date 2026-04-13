---
id: RES-automerge-repo
type: research
layer: research
category: p2p-crdt
title: "automerge/automerge-repo — many-doc Repo abstraction with pluggable storage + transport"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/automerge/automerge-repo
  stars: 673
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: S
tags: [research, p2p-crdt, signal-S, automerge, repo-pattern]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/loro-dev-loro]]", relation: references }
  - { target: "[[DEC-002]]", relation: references }
---

# automerge/automerge-repo

> The Repo abstraction wraps Automerge's CRDT core in a many-document store with pluggable storage and transport adapters. EMA should NOT talk to a raw CRDT — it should use a Repo. Port the adapter pattern verbatim into the Loro layer.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/automerge/automerge-repo> |
| Stars | 673 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **S** |

## What to steal

### 1. The Repo abstraction

```typescript
const repo = new Repo({
  storage: new SQLiteStorageAdapter("ema.db"),
  network: [
    new BroadcastChannelNetworkAdapter(),  // cross-window IPC
    new WebSocketNetworkAdapter(syncServer), // server sync
    new WebRTCNetworkAdapter(),              // peer-to-peer
  ],
});

const intentDoc = repo.create<Intent>();
const tasksDoc = repo.find<TaskList>(taskListId);
```

The Repo:
- Owns many docs (one per intent, one per canvas, one per task list)
- Handles persistence via storage adapters
- Handles sync via network adapters
- Lazy-loads docs on demand
- Garbage collects unused docs

EMA's Loro layer should look exactly like this — same Repo shape, same adapter pattern, same many-doc-not-one-doc semantics.

### 2. Pluggable storage adapters

```typescript
interface StorageAdapter {
  load(key: string): Promise<Uint8Array | undefined>
  save(key: string, data: Uint8Array): Promise<void>
  remove(key: string): Promise<void>
  loadRange(keyPrefix: string): Promise<Chunk[]>
  removeRange(keyPrefix: string): Promise<void>
}
```

Storage swap is a constructor parameter. SQLite for desktop, IndexedDB for web, S3 for server. EMA's Loro Repo wrapper needs the same interface.

### 3. Pluggable transport adapters

```typescript
interface NetworkAdapter {
  connect(peerId: PeerId): void
  send(message: Message): void
  on(event: 'message', handler: (msg: Message) => void): void
}
```

BroadcastChannel for cross-Electron-window. WebSocket for sync server. WebRTC for true P2P. EMA can start with BroadcastChannel and add transports as needed.

### 4. Doc-per-record convention

Don't put your whole DB in one doc. Each intent is its own doc. Each canvas is its own doc. Lazy-load on demand. This is the architectural insight: Repo + many docs > monolithic doc.

## Changes canon

| Doc | Change |
|---|---|
| `[[DEC-002]]` | The Loro layer should wrap Loro in an `automerge-repo`-shaped Repo. Not raw Loro. |
| `SCHEMATIC-v0.md` | Add a "Sync.Repo" module between Core and the CRDT layer |

## Gaps surfaced

- EMA canon doesn't separate "CRDT engine" from "sync orchestration." Reading automerge-repo makes it obvious these are two layers — EMA was conflating them.

## Notes

- Upstream `automerge/automerge` (6,159 stars) is the CRDT engine; automerge-repo is the layer you actually integrate with.
- Ignore recommendations to use raw Automerge.
- The Repo pattern is portable to Loro — the abstraction is independent of which CRDT engine sits underneath.

## Connections

- `[[research/p2p-crdt/loro-dev-loro]]` — the recommended underlying CRDT for EMA
- `[[research/p2p-crdt/yjs-yjs]]` — alternative engine (no Repo equivalent ships natively)
- `[[DEC-002]]` — sync split decision

#research #p2p-crdt #signal-S #automerge #repo-pattern
