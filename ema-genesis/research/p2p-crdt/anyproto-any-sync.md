---
id: RES-any-sync
type: research
layer: research
category: p2p-crdt
title: "anyproto/any-sync — Anytype's open Go P2P sync with linear-signed-chain ACL"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-b
source:
  url: https://github.com/anyproto/any-sync
  stars: 1573
  verified: 2026-04-12
  last_activity: 2026-04-08
  license: MIT
signal_tier: S
tags: [research, p2p-crdt, acl, sync, anytype, go]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/anyproto-anytype-heart]]", relation: references }
  - { target: "[[research/p2p-crdt/garden-co-jazz]]", relation: references }
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
---

# anyproto/any-sync

> Anytype's open-source Go CRDT sync protocol. **Spaces are FLAT** (negative signal for EMA's nested-space canon). But the **ACL chain pattern** is gold and worth stealing as the membership replication mechanism EMA is missing.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/anyproto/any-sync> |
| Stars | 1,573 (verified 2026-04-12) |
| Last activity | 2026-04-08 |
| Signal tier | **S** (for ACL pattern, not for spaces) |
| Language | Go |
| License | MIT |
| Production scale | 200,000+ Anytype users |

## What it is

Anytype's open Go CRDT sync protocol. Storage is protobuf DAGs, **not markdown** (negative signal for EMA's vault-is-markdown canon rule). Spaces are flat — nested spaces are not a concept in any-sync. But the ACL system is the cleanest production-tested membership replication layer in OSS.

## What to steal for EMA

### 1. Linear signed ACL chain (the gold)

`commonspace/object/acl/list/aclstate.go` defines ACL as a linear, cryptographically signed chain of records:

```
ACL chain:
  record_0: {prev: null, op: AddAccount, account: alice, sig: alice_key}
  record_1: {prev: record_0, op: AddAccount, account: bob, sig: alice_key}
  record_2: {prev: record_1, op: PermissionChange, target: bob, role: Admin, sig: alice_key}
  record_3: {prev: record_2, op: KeyRotation, sig: alice_key}
  ...
  lastRecordId: record_N
```

Each record has `lastRecordId` and `PrevId`. Verification walks backward through signatures. Tampering with any record breaks the chain.

Operations:
- `AddAccount`
- `RemoveAccount`
- `PermissionChange`
- `InviteCreate`
- `JoinRequest`
- `OwnershipTransfer`
- `KeyRotation`

Permissions are a flat enum (Owner / Admin / Writer / Reader / None), one-per-account-per-space.

### 2. Separate consensus path for ACL changes

Crucially, **consensus nodes watch ACL changes as a separate node type**. ACL changes can't go through a compromised sync node — there's a dedicated trust path for membership.

EMA's `Ema.Bridge.NodeCoordinator` (which `[[DEC-002]]` already drops) tried to do "all sync goes through one path." Anytype proves you want membership changes on a separate channel with stricter trust.

### 3. Backward ratcheting on key rotation

Every read-key change re-encrypts metadata so removed members can't decrypt new content. EMA's permissions model has no concept of "what does a removed member still see"; this is the answer.

### 4. Four-node-type architecture

- **Sync nodes** — store and replicate data
- **File nodes** — store binary attachments
- **Consensus nodes** — validate ACL changes
- **Coordinator** — bootstrap and discovery

EMA's "just one daemon" model will break at the P2P boundary. Anytype's separation is the reference for what each node *type* needs to do. EMA can collapse them into one daemon for v1 and split them later — but the role separation is a useful design constraint.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `EMA-GENESIS-PROMPT.md §9 P2P` | Adopt the linear-signed ACL chain as the membership replication mechanism. Split "data sync" and "ACL sync" into two channels with different failure domains. |
| `SCHEMATIC-v0.md` | Add Sync / File / Consensus / Coordinator role separation as future architecture target |
| `vapps/CATALOG.md` Permissions | Adopt the five-role enum (Owner / Admin / Writer / Reader / None). Add KeyRotation as a primitive. |

## Gaps surfaced

- **EMA's space membership is currently implicit** (derived from "linked paths" in Project schema). No schema for: who is in a space, who added them, who can add others, how it's signed, how it's verified when two nodes disagree.
- **No backward ratcheting** — no answer to "what does a removed member still see."
- **No separate trust path for membership changes.**
- **No node-type separation** — EMA daemon does everything as one process.

## Notes

- **Negative signal on nested spaces.** Anytype found nesting wasn't needed for their use case. This is one of three production data points (Anytype + Mattermost + Rocket.Chat) that suggest EMA's nested-space canon may be over-engineered.
- **Markdown vs protobuf storage.** Anytype is protobuf-binary; EMA is markdown. The storage format is different but the ACL pattern is transferable.
- Go-native — would need to be a sidecar binary or re-implemented in TypeScript for EMA. The schema/algorithm is the steal-target, not the code.
- MIT licensed, production-hardened, 200k+ users.

## Connections

- `[[research/p2p-crdt/_MOC]]`
- `[[research/p2p-crdt/anyproto-anytype-heart]]` — middleware that builds on this protocol
- `[[research/p2p-crdt/garden-co-jazz]]` — Group + role model cousin
- `[[research/p2p-crdt/matrix-org-MSC1772]]` — opposite design (nested spaces, weaker ACL)
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9
- `[[DEC-002]]` — sync split decision

#research #p2p-crdt #signal-S #anytype #any-sync #acl #membership
