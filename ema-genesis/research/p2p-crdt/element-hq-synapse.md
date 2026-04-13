---
id: RES-synapse
type: research
layer: research
category: p2p-crdt
title: "element-hq/synapse — Python Matrix homeserver, reference impl of MSC1772 walker"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-b
source:
  url: https://github.com/element-hq/synapse
  stars: 12058
  verified: 2026-04-12
  last_activity: 2024-04-26 (archived at matrix-org; active dev moved to element-hq)
signal_tier: S
tags: [research, p2p-crdt, matrix, synapse, walker, reference-impl]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/matrix-org-MSC1772]]", relation: references }
  - { target: "[[research/p2p-crdt/element-hq-element-web]]", relation: references }
---

# element-hq/synapse

> The reference Python Matrix homeserver implementing MSC1772/2946 in `synapse/handlers/room_summary.py`. The walking algorithm + production caps are the lift target.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/element-hq/synapse> |
| Stars | 12,058 (verified 2026-04-12) |
| Last activity | 2024-04-26 (archived at matrix-org; active dev at element-hq) |
| Key file | `synapse/handlers/room_summary.py` |
| Signal tier | **S** |
| Language | Python |

## What it is

The reference Matrix homeserver. Implements MSC1772 (nested spaces), MSC2946 (hierarchy walker), MSC3083 (restricted join rules) in production code. The hierarchy walker is the canonical reference.

## What to steal for EMA

### 1. The walking algorithm

```python
# Synapse pattern (paraphrased)
async def get_room_hierarchy(root_room_id, max_rooms=50):
    room_queue = [root_room_id]
    seen_rooms = set()
    results = []

    while room_queue and len(results) < max_rooms:
        room_id = room_queue.pop()
        if room_id in seen_rooms:
            continue
        seen_rooms.add(room_id)

        if not await self._is_local_room_accessible(room_id, requester):
            continue

        children = await self._get_child_events(room_id)
        results.append(summarize(room_id))
        room_queue.extend(c.state_key for c in children)

    return paginated(results)
```

### 2. Production caps and pagination

- **`MAX_ROOMS = 50`** — hard cap per call. Even if the tree has 10,000 rooms, the walker returns at most 50 per request.
- **Per-room access check, not inherited.** `_is_local_room_accessible()` evaluates each room independently. Permission cascade only happens via MSC3083 allow rules when the child room explicitly opts in.
- **Two entry points**: local (direct DB) + remote (federation API with `inaccessible_children` list returned by target server).
- **Pagination state** in the response so a client can resume.

EMA's space hierarchy endpoint must:
- Hard-cap responses (not "the whole tree")
- Per-space visibility check, not cascade-based
- Paginate explicitly

### 3. Federation walker

The federation flavor returns `inaccessible_children` as metadata. A server can reveal "this child room exists, but you're not allowed to know its members" — useful for EMA's "host peer / regular peer / invisible peer" trust model where some children are visible-but-opaque.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `vapps/CATALOG.md` Space Manager | Mandate paginated walker with `max_rooms` cap, per-space access check, federation-style "inaccessible_children" list for opaque-but-visible spaces |
| `EMA-GENESIS-PROMPT.md §9` | Add per-space visibility check (not cascade-based) as a hard requirement |

## Gaps surfaced

- **Canon assumes walking the space tree is cheap.** Matrix production learned it's expensive enough to need hard caps + pagination + cross-server filtering trust.
- **No "opaque but visible" mode** for spaces — currently it's "see fully" or "don't see at all."

## Notes

- Archived at matrix-org 2024-04-26; active fork at `element-hq/synapse`. Read the latter.
- Python codebase. Not directly portable to EMA's TypeScript stack, but the algorithm is straightforward.
- The `room_summary.py` module is the canonical reference impl. ~500 lines. Read it end-to-end.

## Connections

- `[[research/p2p-crdt/_MOC]]`
- `[[research/p2p-crdt/matrix-org-MSC1772]]` — the spec this implements
- `[[research/p2p-crdt/element-hq-element-web]]` — client-side validation logic
- `[[research/p2p-crdt/matrix-org-dendrite]]` — Go reference impl (archived)
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9

#research #p2p-crdt #signal-S #matrix #synapse #walker
