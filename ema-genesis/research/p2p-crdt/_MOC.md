---
id: MOC-p2p-crdt
type: moc
layer: research
title: "P2P & CRDT — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, p2p-crdt]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
---

# P2P & CRDT — Map of Content

> Repos covering CRDT engines, P2P networks, file-folder sync, nested-space protocols, decentralized membership, self-healing distributed services, and homelab orchestration.

## Tier S

| Repo | Pattern |
|---|---|
| [[research/p2p-crdt/loro-dev-loro\|loro]] | Movable tree CRDT — recommended for structured data |
| [[research/p2p-crdt/automerge-automerge-repo\|automerge-repo]] | Repo abstraction (apply to Loro) |
| [[research/p2p-crdt/syncthing-syncthing\|syncthing]] | BEP folder sync — recommended for vault |
| [[research/p2p-crdt/garden-co-jazz\|jazz]] | Group + role permission model |
| [[research/p2p-crdt/dxos-dxos\|dxos]] | HALO/ECHO/MESH layer split |
| [[research/p2p-crdt/electric-sql-electric\|electric]] | Shape-based partial replication |
| [[research/p2p-crdt/hashicorp-serf\|serf]] | SWIM gossip failure detection |
| [[research/p2p-crdt/matrix-org-MSC1772\|MSC1772]] | Nested spaces with explicit cascade |
| [[research/p2p-crdt/element-hq-synapse\|synapse]] | Walker reference impl (Python) |
| [[research/p2p-crdt/element-hq-element-web\|element-web]] | Client-side validation logic |
| [[research/p2p-crdt/anyproto-any-sync\|any-sync]] | Linear signed ACL chain |

## Tier A

| Repo | Pattern |
|---|---|
| [[research/p2p-crdt/yjs-yjs\|yjs]] | Awareness protocol for transient state |
| [[research/p2p-crdt/vlcn-io-cr-sqlite\|cr-sqlite]] | CRDT inside SQLite as columns (dormant) |
| [[research/p2p-crdt/hashicorp-nomad\|nomad]] | Declarative reschedule policy |
| [[research/p2p-crdt/matrix-org-dendrite\|dendrite]] | Go walker (archived but readable) |
| [[research/p2p-crdt/anyproto-anytype-heart\|anytype-heart]] | Layer split: sync protocol vs business logic |
| [[research/p2p-crdt/mattermost-rocketchat\|mattermost+rocketchat]] | Negative prior art — both flat |

## Tier B

| Repo | Pattern |
|---|---|
| [[research/p2p-crdt/matrix-construct-tuwunel\|tuwunel]] | Live Rust Matrix — fork churn warning |
| [[research/p2p-crdt/k3s-io-k3s\|k3s]] | Liveness probes for homelab supervision |

## Cross-cutting takeaways

1. **EMA's sync split (`[[DEC-002]]`)** divides into two tiers: Syncthing for human-edited markdown, Loro for structured data. Each is the leader in its slot.
2. **Nested spaces are mostly negative prior art.** Matrix MSC1772 is the only positive example; Anytype, Mattermost, Rocket.Chat all chose flat. EMA should pick deliberately.
3. **The HALO/ECHO/MESH split (DXOS)** is the right architectural decomposition: identity, data, transport are three independent concerns.
4. **SWIM gossip is the missing piece** for failure detection. libcluster does discovery, not failure detection.
5. **ACL chains (any-sync) + Group roles (Jazz)** together give EMA a clean membership story across both sync mechanisms.

## Connections

- [[research/_moc/RESEARCH-MOC]]
- [[DEC-002]] — sync split decision
- [[canon/specs/EMA-GENESIS-PROMPT]] §9

#moc #research #p2p-crdt
