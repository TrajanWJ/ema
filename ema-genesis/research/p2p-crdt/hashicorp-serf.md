---
id: RES-serf
type: research
layer: research
category: p2p-crdt
title: "hashicorp/serf — SWIM gossip for cluster membership and failure detection"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/hashicorp/serf
  stars: 6050
  verified: 2026-04-12
  last_activity: 2026-04-06
signal_tier: S
tags: [research, p2p-crdt, signal-S, serf, swim, gossip, membership]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/hashicorp-nomad]]", relation: references }
---

# hashicorp/serf

> Gossip-based cluster membership and failure detection using **SWIM protocol**. The most important missing piece for EMA's self-healing dispatch story.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/hashicorp/serf> |
| Stars | 6,050 (verified 2026-04-12) |
| Last activity | 2026-04-06 |
| Signal tier | **S** |

## What to steal

### 1. SWIM protocol for failure detection

Each peer pings a random subset. Dead peers detected within seconds. The whole cluster learns via epidemic broadcast. **Scales to thousands.**

EMA's Bridge architecture mentions `node_coordinator.ex` with libcluster — but **libcluster is DISCOVERY, not failure detection**. Without Serf-style gossip, a "dead" node just sits there until someone notices. This is the most important missing piece for self-healing dispatch.

### 2. Memberlist library underneath

`hashicorp/memberlist` (4,050 stars) is the underlying SWIM implementation. Smaller, more focused. Better lift target than Serf itself.

### 3. The failure detection scenario

When your laptop drops off, your desktop detects it via gossip in <10s and takes over dispatch responsibilities — without a central coordinator.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §9` | Specify membership protocol: SWIM via Serf, not libcluster alone |
| `SCHEMATIC-v0.md` | New `Ema.Mesh.Membership` module |

## Gaps surfaced

- The Bridge architecture mentions libcluster but no SWIM. **Without SWIM, "node failure" is invisible until something else notices.**

## Notes

- Erlang has `libring` for consistent hashing and `swarm` for distributed process registry, but no SWIM implementation.
- Three options for EMA: (A) port Serf as a sidecar, (B) find/build a TS SWIM library, (C) accept libcluster's limitations.
- Since EMA is moving to TypeScript, look for `ts-swim`, `node-memberlist`, or similar.

## Connections

- `[[research/p2p-crdt/hashicorp-nomad]]` — uses Serf for membership
- `[[research/p2p-crdt/syncthing-syncthing]]` — alternative discovery via introducer

#research #p2p-crdt #signal-S #serf #swim #gossip
