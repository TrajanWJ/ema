---
id: EXTRACT-element-hq-synapse
type: extraction
layer: research
category: p2p-crdt
title: "Source Extractions — element-hq/synapse"
status: active
created: 2026-04-12
updated: 2026-04-12
author: A6
clone_path: "../_clones/element-hq-synapse/"
source:
  url: https://github.com/element-hq/synapse
  sha: 0e3e947
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 55
tags: [extraction, p2p-crdt, matrix, synapse, python, walker]
connections:
  - { target: "[[research/p2p-crdt/element-hq-synapse]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
  - { target: "[[research/_extractions/matrix-org-matrix-spec-proposals]]", relation: spec_for }
  - { target: "[[research/_extractions/matrix-org-dendrite]]", relation: sibling_impl }
---

# Source Extractions — element-hq/synapse

> Reference Python implementation of the Matrix `/hierarchy` walker (MSC2946). This is the **original canonical implementation** — dendrite's Go version copies the same algorithm more cleanly. Synapse is the source of truth for MAX_ROOMS = 50 and the pagination-session state shape.

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/element-hq/synapse |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~55 MB |
| Language | Python |
| License | AGPL-3.0 + Element Commercial (dual) |
| Key commit SHA | 0e3e947 |

## Install attempt

- **Attempted:** no
- **Command:** n/a
- **Result:** skipped
- **Why:** Synapse is a full Matrix homeserver requiring PostgreSQL, federation config, signing keys, Redis for workers, Python 3.12+, and half a GB of deps. We only need to read the walker file. Running it would require days of setup.

## Run attempt

- **Attempted:** no
- **Why:** same as above.

## Key files identified

Ordered by porting priority:

1. `synapse/handlers/room_summary.py:132-414` — the `get_room_hierarchy()` + `_get_room_hierarchy()` walker
2. `synapse/handlers/room_summary.py:57-63` — the hard-coded limits (MAX_ROOMS=50, MAX_ROOMS_PER_SPACE=50, MAX_SERVERS_PER_SPACE=3)
3. `synapse/handlers/room_summary.py:595-722` — `_is_local_room_accessible()` — the access check
4. `synapse/handlers/room_summary.py:724-770` — `_is_remote_room_accessible()` — the federation access check
5. `synapse/handlers/room_summary.py:66-89` — `_PaginationKey` and `_PaginationSession` dataclasses (state shape)

## Extracted patterns

### Pattern 1: Hard limits

**Files:**
- `synapse/handlers/room_summary.py:56-63`

**Snippet (verbatim from source):**
```python
# synapse/handlers/room_summary.py:56-63
# number of rooms to return. We'll stop once we hit this limit.
MAX_ROOMS = 50

# max number of events to return per room.
MAX_ROOMS_PER_SPACE = 50

# max number of federation servers to hit per room
MAX_SERVERS_PER_SPACE = 3
```

And the cap-application:

```python
# synapse/handlers/room_summary.py:288-292
# Cap the limit to a server-side maximum.
if limit is None:
    limit = MAX_ROOMS
else:
    limit = min(limit, MAX_ROOMS)
```

**What to port to EMA:**
Pin these as defaults in `canon/specs/SPACE-WALKER.md` and in a config file:
- `ema.space.walker.max_rooms_per_page = 50`
- `ema.space.walker.max_children_per_space = 50`
- `ema.space.walker.max_peers_per_room = 3`

These are **not** arbitrary numbers. They are the product of years of production tuning at matrix.org scale. Do not start from scratch. Let users override via config, but keep the defaults.

### Pattern 2: Pagination session shape

**Files:**
- `synapse/handlers/room_summary.py:66-89`

**Snippet (verbatim from source):**
```python
# synapse/handlers/room_summary.py:66-89
@attr.s(slots=True, frozen=True, auto_attribs=True)
class _PaginationKey:
    """The key used to find unique pagination session."""

    # The first three entries match the request parameters (and cannot change
    # during a pagination session).
    room_id: str
    suggested_only: bool
    max_depth: int | None
    # The randomly generated token.
    token: str


@attr.s(slots=True, frozen=True, auto_attribs=True)
class _PaginationSession:
    """The information that is stored for pagination."""

    # The time the pagination session was created, in milliseconds.
    creation_time_ms: int
    # The queue of rooms which are still to process.
    room_queue: list["_RoomQueueEntry"]
    # A set of rooms which have been processed.
    processed_rooms: set[str]
```

**What to port to EMA:**
EMA's opaque pagination token should encode the same structure:
- **Immutable fields** (can NOT change between pages): `space_id`, `suggested_only`, `max_depth`
- **Mutable state**: `room_queue` (stack), `processed_rooms` (set), `creation_time_ms`

The session is valid for 5 minutes (`_PAGINATION_SESSION_VALIDITY_PERIOD_MS = 5 * 60 * 1000`, see room_summary.py:96). Expiring old sessions prevents state leaks.

**Critical detail (room_summary.py:262-272):**
```python
# If the requester, room ID, suggested-only, max depth,
# omit_remote_room_hierarchy, or admin_skip_room_visibility_check
# were modified the session is invalid.
if (
    requester != pagination_session["requester"]
    or requested_room_id != pagination_session["room_id"]
    or suggested_only != pagination_session["suggested_only"]
    or max_depth != pagination_session["max_depth"]
    or omit_remote_room_hierarchy
    != pagination_session["omit_remote_room_hierarchy"]
    or admin_skip_room_visibility_check
    != pagination_session["admin_skip_room_visibility_check"]
):
    raise SynapseError(400, "Unknown pagination token", Codes.INVALID_PARAM)
```

**Port:** Every pagination continuation MUST re-validate the filter params match the original request. If a user sends page 2 with different params, error 400. This is a subtle correctness requirement — without it, you can get inconsistent result sets.

### Pattern 3: The walker itself (DFS with stack)

**Files:**
- `synapse/handlers/room_summary.py:203-414` — `_get_room_hierarchy()`

**Structure (paraphrased, ~200 lines of Python):**

```python
# synapse/handlers/room_summary.py:279-389 — the core loop
else:
    # The queue of rooms to process, the next room is last on the stack.
    room_queue = [_RoomQueueEntry(requested_room_id, remote_room_hosts or ())]
    processed_rooms = set()

rooms_result: list[JsonDict] = []

# Cap the limit to a server-side maximum.
if limit is None:
    limit = MAX_ROOMS
else:
    limit = min(limit, MAX_ROOMS)

# Iterate through the queue until we reach the limit or run out of
# rooms to include.
while room_queue and len(rooms_result) < limit:
    queue_entry = room_queue.pop()
    room_id = queue_entry.room_id
    current_depth = queue_entry.depth
    if room_id in processed_rooms:
        # already done this room
        continue

    # A map of summaries for children rooms that might be returned over
    # federation. The rationale for caching these and *maybe* using them
    # is to prefer any information local to the homeserver before trusting
    # data received over federation.
    children_room_entries: dict[str, JsonDict] = {}
    inaccessible_children: set[str] = set()

    # If the room is known locally, summarise it!
    is_in_room = await self._store.is_host_joined(room_id, self._server_name)
    if is_in_room:
        room_entry = await self._summarize_local_room(...)
    else:
        # ... federation fallback ...
        if queue_entry.remote_room and (...):
            room_entry = _RoomEntry(queue_entry.room_id, queue_entry.remote_room)
        elif not omit_remote_room_hierarchy:
            (room_entry, children_room_entries, inaccessible_children) = (
                await self._summarize_remote_room_hierarchy(queue_entry, suggested_only)
            )
        # Ensure this room is accessible to the requester
        if room_entry and not await self._is_remote_room_accessible(...):
            room_entry = None

    # This room has been processed
    processed_rooms.add(room_id)

    if room_entry:
        rooms_result.append(room_entry.as_json(for_client=True))

        # If this room is not at the max-depth, check if there are any
        # children to process.
        if max_depth is None or current_depth < max_depth:
            # The children get added in reverse order so that the next
            # room to process, according to the ordering, is the last
            # item in the list.
            room_queue.extend(
                _RoomQueueEntry(
                    ev["state_key"],
                    ev["content"]["via"],
                    current_depth + 1,
                    children_room_entries.get(ev["state_key"]),
                )
                for ev in reversed(room_entry.children_state_events)
                if ev["type"] == EventTypes.SpaceChild
                and ev["state_key"] not in inaccessible_children
            )
```

**What to port to EMA:**
This is the canonical DFS-via-stack algorithm. Port as `Ema.Space.Walker.walk/3` (TypeScript/Elixir agnostic):

1. Stack `unvisited: [WalkerEntry]`, pop from the end
2. Set `processed: Set<id>`
3. For each popped entry:
   - Skip if processed
   - Fetch local if available, else fetch via P2P peers
   - Check access (see pattern 4)
   - Append to `result`
   - If under max_depth, push children **in reverse** so iteration order matches sorted order
4. Stop on `len(result) >= limit` or `stack empty`
5. Return pagination token if stack non-empty

**The "reverse" trick (room_summary.py:376-389)** is load-bearing: because it's a stack (LIFO), pushing sorted children forward gives you reverse-sorted popping. Push in reverse to get the natural order. Easy to miss in a port.

### Pattern 4: Access check (`_is_local_room_accessible`)

**Files:**
- `synapse/handlers/room_summary.py:595-722`

**Algorithm (paraphrased):**

1. Fetch state events: `join_rules`, `history_visibility`, and the requester's `m.room.member` event
2. If no state → might be a pending invite; check invites. If no invite either → room unknown, omit.
3. If `join_rule == public` OR (`knock_join_rule` room_version AND `join_rule == knock`) OR (`knock_restricted` support AND `join_rule == knock_restricted`) → **allow**
4. If `history_visibility == world_readable` → **allow** (peekable)
5. If user is joined or invited → **allow**
6. If room has restricted join rules → check if user is in any `allowed_rooms` → **allow** if yes
7. Otherwise → **deny**

**Key snippet (verbatim):**
```python
# synapse/handlers/room_summary.py:684-694
# Otherwise, check if they should be allowed access via membership in a space.
if await self._event_auth_handler.has_restricted_join_rules(
    state_ids, room_version
):
    allowed_rooms = (
        await self._event_auth_handler.get_rooms_that_allow_join(state_ids)
    )
    if await self._event_auth_handler.is_user_in_rooms(
        allowed_rooms, requester
    ):
        return True
```

**What to port to EMA:**
EMA's `SpaceAccessCheck.canRead(user, space) → bool` needs this exact ladder:
1. Public → yes
2. Knockable → yes
3. World-readable → yes (peekable)
4. Direct member → yes
5. Member of any parent space whose cascade rule allows this space → yes
6. Otherwise → no

The cascade check (step 5) is the "MSC3083 equivalent" in EMA. When you have a `restricted` rule with `allow: [parent_space_ids...]`, being in ANY of those parents grants read access. Any member is enough (OR, not AND).

### Pattern 5: Federation accessibility (`_is_remote_room_accessible`)

**Files:**
- `synapse/handlers/room_summary.py:724-770`

**Trusted-client rule (724-757):**
```python
# The API doesn't return the room version so assume that a
# join rule of knock is valid.
if (
    room.get("join_rule", JoinRules.PUBLIC)
    in (JoinRules.PUBLIC, JoinRules.KNOCK, JoinRules.KNOCK_RESTRICTED)
    or room.get("world_readable") is True
):
    return True
elif not requester:
    return False

# Check if the user is a member of any of the allowed rooms from the response.
allowed_rooms = room.get("allowed_room_ids")
if allowed_rooms and isinstance(allowed_rooms, list):
    if await self._event_auth_handler.is_user_in_rooms(
        allowed_rooms, requester
    ):
        return True
```

**What to port to EMA:**
When EMA fetches space metadata from a peer (not the local store), the peer returns `allowed_rooms` as part of the response. The local node then verifies locally "is user X in any of these parent spaces?". This is the **trust-but-verify** pattern — the peer can lie about who's a member of *its* rooms, but it cannot force us to believe the user is in *our* rooms. The local check is the security boundary.

### Pattern 6: Child event comparison / sort key

**Files:**
- `synapse/handlers/room_summary.py:832-860` — `_get_child_events()` uses `_child_events_comparison_key`
- `synapse/handlers/room_summary.py:1024+` — `_child_events_comparison_key` (implements MSC2946 ordering)

**Key rule (832-860):**
```python
# filter out any events without a "via" (which implies it has been redacted),
# and order to ensure we return stable results.
return sorted(filter(_has_valid_via, events), key=_child_events_comparison_key)
```

**What to port to EMA:**
- Filter children with missing/empty `via` (they're deleted)
- Sort by composite key: `(validated_order ?? +Inf, origin_server_ts, room_id)`
- Stable sort — two children with same key use a deterministic tiebreak

In TypeScript: `children.filter(c => Array.isArray(c.via) && c.via.length).sort(byOrderThenTimeThenId)`.

## Gotchas found while reading

- **MAX_ROOMS is both a client cap and a server cap.** Users passing `limit=1000` get silently clamped to 50. Document this in EMA — don't let it surprise users.
- **Reverse-push on the stack.** You push children in reverse sorted order so pop gives you natural order. Easy to port-bug.
- **Pagination session ≠ response cache.** Synapse has BOTH: a `ResponseCache` for "user hammered the same request" dedup, AND a pagination session store for continuation. Separate concerns, separate TTLs.
- **`omit_remote_room_hierarchy` exists specifically for admin endpoints** that want to not trigger federation queries. EMA equivalent: `--local-only` flag for CLI walkers.
- **Pending invites count as accessibility** (room_summary.py:632-636): even if state is empty, if the user has a pending invite, the room is shown. Port this — inviting a user to a sub-space should make it appear in their hierarchy before they accept.
- **Room version matters for restricted join rules** (room_summary.py:641-646). Some older room versions don't support `restricted`. EMA doesn't have "room versions" but DOES have schema migrations; the equivalent gotcha is: older clients might not understand the newest join-rule types.
- **Response cache key includes `requester`** (room_summary.py:115-130). Don't share pagination-cache entries across users — would be a privacy leak.

## Port recommendation

1. **Start with dendrite, not synapse.** Dendrite's Go version (~567 lines, single file) is cleaner because Go forces explicit error handling. Synapse is 1054 lines of Python with async/await soup. Use synapse only for: the MAX_ROOMS constant, the pagination session shape, and the `_is_local_room_accessible` access ladder.
2. **Map to EMA module:** `ema-core/src/lib/space/walker.ts` (TypeScript) or `ema_daemon/lib/ema/space/walker.ex` (Elixir).
3. **Testing:** synapse has `_is_local_room_accessible` as a pure async function. Easy to unit test with state stubs. Port the test surface too.
4. **Risks:**
   - Don't re-invent MAX_ROOMS pagination; use 50.
   - Don't forget reverse-push on stack.
   - Don't skip the re-validation of filter params on continuation.
5. **Do NOT port:** the federation machinery. EMA uses CRDTs, not event signing / auth chains.

## Related extractions

- `[[research/_extractions/matrix-org-matrix-spec-proposals]]` — the spec synapse implements
- `[[research/_extractions/matrix-org-dendrite]]` — the Go version (use this as the reference port)
- `[[research/_extractions/element-hq-element-web]]` — client-side walker (easier TS port)

## Connections

- `[[research/p2p-crdt/element-hq-synapse]]` — original research node
- `[[research/_clones/INDEX]]`

#extraction #p2p-crdt #matrix #synapse #walker #python
