---
id: EXTRACT-matrix-org-matrix-spec-proposals
type: extraction
layer: research
category: p2p-crdt
title: "Source Extractions — matrix-org/matrix-spec-proposals"
status: active
created: 2026-04-12
updated: 2026-04-12
author: A6
clone_path: "../_clones/matrix-org-matrix-spec-proposals/"
source:
  url: https://github.com/matrix-org/matrix-spec-proposals
  sha: 0251b75
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 7.4
tags: [extraction, p2p-crdt, matrix, spec, msc1772, msc2946, msc3083]
connections:
  - { target: "[[research/p2p-crdt/matrix-org-matrix-spec-proposals]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
  - { target: "[[research/_extractions/element-hq-synapse]]", relation: sibling }
  - { target: "[[research/_extractions/matrix-org-dendrite]]", relation: sibling }
  - { target: "[[research/_extractions/element-hq-element-web]]", relation: sibling }
---

# Source Extractions — matrix-org/matrix-spec-proposals

> The **canonical spec** for Matrix spaces, space hierarchy, and restricted join rules. The three MSCs here are the only positive prior art for the org→team→project nested permission model EMA needs. All event type definitions are extracted verbatim.

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/matrix-org/matrix-spec-proposals |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~7.4 MB |
| Language | Markdown |
| License | Apache-2.0 (spec text), various |
| Key commit SHA | 0251b75 |

## Install attempt

- **Attempted:** no
- **Command:** n/a
- **Result:** skipped
- **Why:** Markdown spec repo; nothing to install or run. Read-only.

## Run attempt

- **Attempted:** no
- **Why:** same as above.

## Key files identified

Ordered by porting priority:

1. `proposals/1772-groups-as-rooms.md` — **spaces as rooms**, `m.space.child` / `m.space.parent` state events, cycle rules, canonical parent
2. `proposals/2946-spaces-summary.md` — `/hierarchy` walker API, depth-first walk contract, pagination, ordering key
3. `proposals/3083-restricted-rooms.md` — `restricted` join rule + `allow` list of parent rooms (the actual ACL cascade primitive)

## Extracted patterns

### Pattern 1: m.space.child — the parent → child typed edge

**Files:**
- `proposals/1772-groups-as-rooms.md:86-132` — event shape, ordering rules, canonical definition

**Snippet (verbatim from source):**
```jsonc
// proposals/1772-groups-as-rooms.md:92-118
// a child room
{
    "type": "m.space.child",
    "state_key": "!abcd:example.com",
    "content": {
        "via": ["example.com", "test.org"]
    }
}

// a child room with an ordering.
{
    "type": "m.space.child",
    "state_key": "!efgh:example.com",
    "content": {
        "via": ["example.com"],
        "order": "abcd"
    }
}

// no longer a child room
{
    "type": "m.space.child",
    "state_key": "!jklm:example.com",
    "content": {}
}
```

Key rules (1772:120-132):
- **Children where `via` is not present or invalid (not an array) are ignored.** This is load-bearing — it's how children get "deleted": set content to `{}`.
- `order` is a string lexicographically sorted, Unicode codepoints, max 50 chars, only ASCII `\x20..\x7E`.
- Ties broken by `origin_server_ts` then `room_id` lexicographic.

**What to port to EMA:**
The EMA canon calls for nested spaces (org > team > project). This MSC gives us the **typed edge primitive**. Port as `SpaceChild` graph edge type with:
- `source` = parent space ID
- `target` = child space/entity ID  
- `via` = list of EMA node URLs that can hydrate the child (P2P resolver hints)
- `order` = string sort key
- `suggested` = boolean flag

The "children where via is missing are ignored" rule = **tombstone semantics for free** in the CRDT layer. No separate delete operation needed; you rewrite the state event with `content: {}`.

**Adaptation notes:**
- In EMA we don't need Matrix's room versioning or event auth chain; we can just use a CRDT map keyed by `(parent_id, child_id)` → edge content.
- The `via` field maps cleanly to the EMA P2P node hint list.
- Enforce max 50-char `order` in the schema Zod validator.

### Pattern 2: m.space.parent — child → parent back-reference with anti-abuse

**Files:**
- `proposals/1772-groups-as-rooms.md:134-173` — event shape + power level check
- `proposals/1772-groups-as-rooms.md:160-170` — the critical anti-abuse rule

**Snippet (verbatim from source):**
```jsonc
// proposals/1772-groups-as-rooms.md:141-150
{
    "type": "m.space.parent",
    "state_key": "!space:example.com",
    "content": {
        "via": ["example.com"],
        "canonical": true
    }
}
```

**Anti-abuse rule (1772:162-170):**
> To avoid abuse where a room admin falsely claims that a room is part of a space that it should not be, clients could ignore such `m.space.parent` events unless either (a) there is a corresponding `m.space.child` event in the claimed parent, or (b) the sender of the `m.space.parent` event has a sufficient power-level to send such an `m.space.child` event in the parent.

**What to port to EMA:**
This is the **mutual-consent** rule for parent-child relations. A child can claim a parent, but the claim is only honored if:
1. The parent also has an `m.space.child` pointing back, OR
2. The claimant has write-permission in the parent space.

For EMA, this means: **never trust a unilateral parent assertion**. When rendering the graph, a `SpaceParent` edge from C→P is only visualized if either:
- `SpaceChild(P, C)` also exists in the parent's state, or
- The sender of the `SpaceParent` edge has `can_edit_children` permission on P.

This prevents drive-by squatting (random space adds itself as "child of EMA Core").

### Pattern 3: canonical parent selection

**Files:**
- `proposals/1772-groups-as-rooms.md:152-159`

**Rule:**
> `canonical` determines whether this is the main parent for the space. When a user joins a room with a canonical parent, clients may switch to view the room in the context of that space... In practice, well behaved rooms should only have one `canonical` parent, but given this is not enforced: if multiple are present the client should select the one with the lowest room ID, as determined via a lexicographic ordering of the Unicode code-points.

**What to port to EMA:**
Lowest-ID tiebreak for canonical parent is a deterministic, CRDT-safe rule. Use it verbatim. `getCanonicalParent(entityId) → spaceId` returns `parents.filter(canonical).sort(id)[0]`.

### Pattern 4: cycle policy — detect, don't forbid

**Files:**
- `proposals/1772-groups-as-rooms.md:191-193`

**Rule:**
> Cycles in the parent->child and child->parent relationships are *not* permitted, but clients (and servers) should be aware that they may be encountered, and MUST spot and break cycles rather than infinitely looping.

**What to port to EMA:**
In distributed systems with concurrent writes, you cannot *prevent* cycles locally. The rule is:
1. Do not enforce acyclic at write time (can't, without global consensus).
2. Every tree walker MUST carry a visited-set and abort on revisit.
3. Document the contract: "cycles are possible; walkers must be cycle-safe."

This is the philosophical opposite of e.g. relational FK constraints. Build it into the walker contract from day one, not as a defensive afterthought.

### Pattern 5: /hierarchy walker API (MSC2946)

**Files:**
- `proposals/2946-spaces-summary.md:31-79` — endpoint + query params
- `proposals/2946-spaces-summary.md:163-192` — server behaviour (depth-first + pagination)

**Query params to port:**
- `suggested_only` — transitively filter to `suggested: true` children
- `limit` — max rooms per page (server must cap)
- `max_depth` — cap tree depth from root
- `from` — opaque pagination token (must match original suggested_only and max_depth)

**Key server rule (2946:41-46):**
> In order to provide a consistent experience, the space tree should be walked in a depth-first manner, e.g. whenever a space is found it should be recursed into by sorting the children rooms and iterating through them.
> 
> There could be loops in the returned child events; clients and servers should handle this gracefully. Similarly, note that a child room might appear multiple times (e.g. also be a grandchild). Clients and servers should handle this appropriately.

**What to port to EMA:**
EMA's `space hierarchy` API (CLI: `ema space tree <id> --depth 3 --limit 50`) maps 1:1:
- DFS walker, sorted by `order` → `created_at` → `id`
- Hold a `processed: Set<id>` across recursion
- Paginate on `(walker_state, limit)` with opaque token
- Never mutate state during walk; accumulate into a result list

### Pattern 6: restricted join rule (MSC3083) — the ACL primitive

**Files:**
- `proposals/3083-restricted-rooms.md:22-66` — restricted join rule shape
- `proposals/3083-restricted-rooms.md:100-129` — auth chain requirements

**Snippet (verbatim from source):**
```json
// proposals/3083-restricted-rooms.md:25-42
{
    "type": "m.room.join_rules",
    "state_key": "",
    "content": {
        "join_rule": "restricted",
        "allow": [
            {
                "type": "m.room_membership",
                "room_id": "!mods:example.org"
            },
            {
                "type": "m.room_membership",
                "room_id": "!users:example.org"
            }
        ]
    }
}
```

**Auth chain rule (3083:100-112):**
> The auth chain of the join event needs to include events which prove the homeserver can be issuing the join. This can be done by including:
> * The `m.room.power_levels` event.
> * The join event of the user specified in `join_authorised_via_users_server`.
> 
> It should be confirmed that the authorising user is in the room.

**What to port to EMA:**
This is the **permission cascade primitive**. In EMA, a project "belongs" to a team when its ACL has a `restricted` rule with `allow: [{type: 'space_membership', space_id: 'team:xyz'}]`.

**Critical detail:** MSC3083 does NOT auto-kick users if they leave the parent. (See 3083:199-209). Join rules govern **joins**, not ongoing membership. EMA should mirror this:
- Cascade controls who can *enter* a child.
- Does NOT retroactively evict if parent membership is lost.
- If EMA wants retroactive eviction, that's a separate (hard) problem left to a future spec — and MSC3083 explicitly punts on it because the semantics are thorny.

### Pattern 7: MSC3083 summary of join rule behaviors

From `proposals/3083-restricted-rooms.md:131-144`:

- `public`: anyone can join
- `invite`: only invited can join
- `knock`: like invite, but anyone can request
- `private`: reserved, unspecified
- `restricted`: like `invite`, except users may also join if they are a member of a room listed in the `allow` rules

EMA equivalent types for space join rules: `public`, `invite_only`, `knock_allowed`, `restricted_by_parent`. The `restricted_by_parent` is the cascade.

## Gotchas found while reading

- **`via` empty/missing = deleted.** Not a flag, not a tombstone. Just empty content. Any port must treat "no via" as "no edge". Do not store the empty state as a "soft delete" flag; the absence IS the delete.
- **`order` has charset constraints (ASCII 0x20-0x7E, max 50 chars).** Strings outside this range are ignored, not errored. Fail gracefully.
- **Canonical parent = lowest lexicographic room ID.** Deterministic tiebreak — easy to get wrong if you use insertion order or timestamp.
- **Cycles CAN exist.** Walkers must carry a visited set. Do not try to prevent cycles at write time.
- **MSC3083 changes auth rules.** A join event via a restricted rule needs BOTH the joining server's sig AND the resident server's sig via `join_authorised_via_users_server`. In EMA P2P this translates to: a cascade-join from child to parent must be countersigned by a node that has write access to the parent.
- **Space membership is copied into the room state.** MSC1772 mentions a large-space scaling issue: if a parent has 10k members, every child room needs 10k `m.room.member` events in its own state. EMA should NOT copy membership; it should reference parent membership by pointer (this is actually *easier* in a CRDT graph than in Matrix).
- **MSC1772 explicitly says the `via` field can go stale.** (`proposals/1772-groups-as-rooms.md:355-357` — "The via servers listed in the m.space.child and m.space.parent events could get out of date, and will need to be updated from time to time. This remains an unsolved problem.")

## Port recommendation

1. **Start here.** Define the EMA graph edge types for `SpaceChild`, `SpaceParent`, `RestrictedAllow` using these specs as the data model. Land in `ema-genesis/schemas/edges/` as YAML.
2. **Walker contract.** Write the walker interface spec in `canon/specs/SPACE-WALKER.md` based on MSC2946. Call out: DFS, visited-set, cycle-break, pagination, max-depth, sorted children.
3. **Cascade primitive.** Put MSC3083's `restricted` model in `canon/specs/PERMISSION-CASCADE.md`. Reference this extraction verbatim.
4. **Do NOT port the auth chain / federation bits.** EMA's P2P model is CRDT-based, not auth-chain based. The spec's auth chain is Matrix-specific compensation for Byzantine federation; EMA uses Y.js or Automerge and doesn't need it.
5. **Risks:**
   - The cycle rule requires every walker author to remember the visited-set contract. Codify this in the walker trait/interface so you can't implement a walker without it.
   - Canonical parent tiebreak MUST be deterministic across all clients, or spaces will appear to "flip" parents between sessions.

## Related extractions

- `[[research/_extractions/element-hq-synapse]]` — Python reference implementation of MSC2946 walker
- `[[research/_extractions/matrix-org-dendrite]]` — Go reference (cleaner than synapse)
- `[[research/_extractions/element-hq-element-web]]` — TypeScript client-side walker + parent map (direct port candidate)
- `[[research/_extractions/anyproto-anytype-heart]]` — alternate space model (proprietary binary, anti-pattern)

## Connections

- `[[research/p2p-crdt/matrix-org-matrix-spec-proposals]]` — original research node
- `[[research/_clones/INDEX]]`

#extraction #p2p-crdt #matrix #msc1772 #msc2946 #msc3083
