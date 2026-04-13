---
id: RES-MSC1772
type: research
layer: research
category: p2p-crdt
title: "matrix-org/matrix-spec-proposals MSC1772 + MSC2946 + MSC3083 — nested spaces with explicit cascade"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-b
source:
  url: https://github.com/matrix-org/matrix-spec-proposals/blob/main/proposals/1772-groups-as-rooms.md
  stars: 1205
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: S
tags: [research, p2p-crdt, nested-spaces, matrix, spec, msc1772]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/element-hq-synapse]]", relation: references }
  - { target: "[[research/p2p-crdt/element-hq-element-web]]", relation: references }
  - { target: "[[research/p2p-crdt/anyproto-any-sync]]", relation: references }
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
---

# Matrix MSC1772 + MSC2946 + MSC3083

> The gold-standard prior art for nested spaces with permission cascade. Three MSCs together. Read the specs, not the implementations.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/matrix-org/matrix-spec-proposals/blob/main/proposals/1772-groups-as-rooms.md> |
| Type | Spec proposals (not code) |
| Verified | 2026-04-12 |
| Signal tier | **S** |
| Production use | 5+ years across all major Matrix homeservers |

## What it is

Three Matrix Spec Change documents (MSCs) that together define how nested spaces work in Matrix:

- **MSC1772**: bidirectional `m.space.child` / `m.space.parent` state events. Either side alone is a *claim*; both sides together is a *confirmed* relationship.
- **MSC2946**: depth-first walker API with `max_depth`, `limit`, pagination.
- **MSC3083**: `restricted` join rule with explicit `allow` list. Permission cascade is **opt-in per child**, not implicit inheritance.

## What to steal for EMA

### 1. Bidirectional both-sides-required edges

```
parent_room state event:
  type: m.space.child
  state_key: child_room_id
  content: { via: ["server1", "server2"], canonical: true }

child_room state event:
  type: m.space.parent
  state_key: parent_room_id
  content: { canonical: true, via: ["server1"] }
```

A claim is only valid when **both events exist** AND the sender of each had power to set the relationship. EMA's nested-space schema needs the same: a `parent_id` on Space alone is insufficient — the parent must also list the child explicitly. Verification:

```
edge_valid(parent, child) ⟺
  parent.children includes child.id
  AND child.parents includes parent.id
  AND sender_of_parent_claim has power_to_set_children(parent)
  AND sender_of_child_claim has power_to_set_parents(child)
```

### 2. The walker algorithm (MSC2946)

Depth-first traversal with hard caps:

```
hierarchy(root, max_depth=N, limit=M):
  queue = [root]
  visited = {}
  results = []
  while queue and len(results) < M:
    room = queue.pop()
    if room in visited: continue  # cycle protection
    visited.add(room)
    results.append(summarize(room))
    if depth(room, root) < max_depth:
      for child in get_children(room):
        if can_see(child, current_user):
          queue.append(child)
  return paginated(results, page_size=M)
```

Production wisdom: Synapse hard-caps `MAX_ROOMS = 50` per call. Pagination is mandatory.

### 3. Restricted join rule (MSC3083) — opt-in cascade

```
child_room state event:
  type: m.room.join_rules
  content:
    join_rule: restricted
    allow:
      - type: m.room.membership
        room_id: parent_space_id
```

This says: "anyone with membership in `parent_space_id` can join me without invite." **The child explicitly opts into accepting parent membership.** Cascade is not automatic; the child publishes its allow rule.

EMA should mirror this: `Space` schema gains an `allow_from_space_ids: string[]` field separate from `parent_space_id`. Containment (parent_id) is structural; cascade (allow_from) is permissions.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `EMA-GENESIS-PROMPT.md §9 P2P spaces` | Split "permission cascade" into structural containment (bidirectional parent/child, both required) AND explicit opt-in cascade (child declares which parents grant access) |
| `SCHEMATIC-v0.md` Entity Model | Space gets `parent_space_id` + separate `allow_from_space_ids: string[]` |
| `vapps/CATALOG.md` Space Manager | Mandate cycle detection, both-sides-verified edges, canonical parent selection, paginated walker |

## Gaps surfaced

- **EMA canon implies automatic cascade.** Matrix proves automatic cascade is the wrong default after 5 years of production use. Clients must verify both sides; children must opt in.
- **No concept of "who can declare a parent/child link."** Power-level checks are mandatory.
- **No cycle handling.** A UI that lets the user drag "project X under project Y" where Y is already under X needs explicit resolution. Matrix uses deterministic room-ID sort.
- **No paginated walker.** EMA assumes walking the tree is cheap. Matrix production learned it's expensive enough to need hard caps + pagination.

## Notes

- Read the **specs**, not the implementations. The MSCs are stable; the implementations churn (Synapse archived → element-hq, Dendrite archived, conduit/conduwuit/tuwunel/continuwuity all forks).
- The combined three-MSC pattern is the only place "real nested spaces with cascade" is fully solved in OSS. Anytype is flat. Mattermost is flat. Rocket.Chat is flat. Matrix is the only positive prior art.
- **EMA should adopt the protocol's separation of mechanics**, not the wire format. EMA isn't Matrix-compatible.

## Connections

- `[[research/p2p-crdt/_MOC]]`
- `[[research/p2p-crdt/element-hq-synapse]]` — Python reference impl of the walker
- `[[research/p2p-crdt/matrix-org-dendrite]]` — Go reference impl (archived)
- `[[research/p2p-crdt/element-hq-element-web]]` — Client-side validation logic
- `[[research/p2p-crdt/anyproto-any-sync]]` — Negative prior art (chose flat)
- `[[research/p2p-crdt/mattermost-rocketchat]]` — Negative prior art (both flat)
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9
- `[[canon/specs/SCHEMATIC-v0]]` Entity Model

#research #p2p-crdt #signal-S #matrix #msc1772 #nested-spaces #spec
