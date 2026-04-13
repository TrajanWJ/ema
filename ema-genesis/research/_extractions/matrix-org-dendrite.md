---
id: EXTRACT-matrix-org-dendrite
type: extraction
layer: research
category: p2p-crdt
title: "Source Extractions — matrix-org/dendrite"
status: active
created: 2026-04-12
updated: 2026-04-12
author: A6
clone_path: "../_clones/matrix-org-dendrite/"
source:
  url: https://github.com/matrix-org/dendrite
  sha: 0841813
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 9.9
tags: [extraction, p2p-crdt, matrix, dendrite, go, walker, archived]
connections:
  - { target: "[[research/p2p-crdt/matrix-org-dendrite]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
  - { target: "[[research/_extractions/element-hq-synapse]]", relation: alternate_impl }
  - { target: "[[research/_extractions/matrix-org-matrix-spec-proposals]]", relation: spec_for }
---

# Source Extractions — matrix-org/dendrite

> Go implementation of the Matrix hierarchy walker. Archived upstream but still the **cleanest reference port** for the walker algorithm. Single 567-line file with explicit error handling and an elegant split between `authorisedUser()` and `authorisedServer()`. **This is your primary porting target.**

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/matrix-org/dendrite |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~9.9 MB |
| Language | Go |
| License | Apache-2.0 |
| Key commit SHA | 0841813 |
| Upstream status | **Archived** as of 2024 — no longer maintained |

## Install attempt

- **Attempted:** no
- **Command:** n/a
- **Result:** skipped
- **Why:** Full Matrix homeserver. Requires PostgreSQL, federation signing keys, Go 1.21+. Archived project, no reason to run; we only want the algorithm.

## Run attempt

- **Attempted:** no
- **Why:** same as above.

## Key files identified

Ordered by porting priority:

1. `roomserver/internal/query/query_room_hierarchy.go:42-208` — `QueryNextRoomHierarchyPage` — the walker
2. `roomserver/internal/query/query_room_hierarchy.go:211-220` — `authorised` dispatcher
3. `roomserver/internal/query/query_room_hierarchy.go:222-295` — `authorisedServer` (federation access check)
4. `roomserver/internal/query/query_room_hierarchy.go:297-380` — `authorisedUser` (client-side access check, includes MSC3083 parent check)
5. `roomserver/internal/query/query_room_hierarchy.go:546-567` — `restrictedJoinRuleAllowedRooms` (extracts allow list)
6. `roomserver/internal/query/query_room_hierarchy.go:458-517` — `childReferences` (sort + filter children)

## Extracted patterns

### Pattern 1: The walker (QueryNextRoomHierarchyPage) — port this verbatim

**Files:**
- `roomserver/internal/query/query_room_hierarchy.go:42-208`

**Snippet (verbatim from source):**
```go
// roomserver/internal/query/query_room_hierarchy.go:42-86
// Traverse the room hierarchy using the provided walker up to the provided limit,
// returning a new walker which can be used to fetch the next page.
//
// If limit is -1, this is treated as no limit, and the entire hierarchy will be traversed.
//
// If returned walker is nil, then there are no more rooms left to traverse. This method does not modify the provided walker, so it
// can be cached.
func (querier *Queryer) QueryNextRoomHierarchyPage(ctx context.Context, walker roomserver.RoomHierarchyWalker, limit int) (
	[]fclient.RoomHierarchyRoom,
	[]string,
	*roomserver.RoomHierarchyWalker,
	error,
) {
	if authorised, _, _ := authorised(ctx, querier, walker.Caller, walker.RootRoomID, nil); !authorised {
		return nil, []string{walker.RootRoomID.String()}, nil, roomserver.ErrRoomUnknownOrNotAllowed{Err: fmt.Errorf("room is unknown/forbidden")}
	}

	discoveredRooms := []fclient.RoomHierarchyRoom{}

	// Copy unvisited and processed to avoid modifying original walker (which is typically in cache)
	unvisited := make([]roomserver.RoomHierarchyWalkerQueuedRoom, len(walker.Unvisited))
	copy(unvisited, walker.Unvisited)
	processed := walker.Processed.Copy()
	inaccessible := []string{}

	// Depth first -> stack data structure
	for len(unvisited) > 0 {
		if len(discoveredRooms) >= limit && limit != -1 {
			break
		}

		// If the context is canceled, we might still have discovered rooms
		// return them to the client and let the client know there _may_ be more rooms.
		if errors.Is(ctx.Err(), context.Canceled) {
			break
		}

		// pop the stack
		queuedRoom := unvisited[len(unvisited)-1]
		unvisited = unvisited[:len(unvisited)-1]
```

**Key properties:**
- **Immutable walker input**: `copy(unvisited, walker.Unvisited)` and `processed := walker.Processed.Copy()` — the caller's walker is never mutated. Cache-safe.
- **Context cancellation mid-walk** (lines 66-70): on `ctx.Err() == context.Canceled`, return partial results. **Critical for UI responsiveness.** A user navigating away shouldn't block on a deep walk.
- **limit == -1 means unlimited** (line 62). Simple sentinel.

**Inner loop (line 73-189):**
```go
// roomserver/internal/query/query_room_hierarchy.go:73-189 (abridged)
// pop the stack
queuedRoom := unvisited[len(unvisited)-1]
unvisited = unvisited[:len(unvisited)-1]
// If this room has already been processed, skip.
// If this room exceeds the specified depth, skip.
if processed.Contains(queuedRoom.RoomID) || (walker.MaxDepth > 0 && queuedRoom.Depth > walker.MaxDepth) {
    continue
}
processed.Add(queuedRoom.RoomID)

// if this room is not a space room, skip.
var roomType string
create := stateEvent(ctx, querier, queuedRoom.RoomID, spec.MRoomCreate, "")
// ... extract roomType from create content ...

// Collect rooms/events to send back (either locally or fetched via federation)
var discoveredChildEvents []fclient.RoomHierarchyStrippedEvent

roomExists := roomExists(ctx, querier, queuedRoom.RoomID)
if !roomExists {
    // attempt to query this room over federation
    fedRes := federatedRoomInfo(ctx, querier, walker.Caller, walker.SuggestedOnly, queuedRoom.RoomID, queuedRoom.Vias)
    if fedRes != nil {
        discoveredChildEvents = fedRes.Room.ChildrenState
        discoveredRooms = append(discoveredRooms, fedRes.Room)
        if len(fedRes.Children) > 0 {
            discoveredRooms = append(discoveredRooms, fedRes.Children...)
        }
        roomType = spec.MSpace
    }
} else if authorised, isJoinedOrInvited, allowedRoomIDs := authorised(ctx, querier, walker.Caller, queuedRoom.RoomID, queuedRoom.ParentRoomID); authorised {
    events, err := childReferences(ctx, querier, walker.SuggestedOnly, queuedRoom.RoomID)
    // ... append to discoveredRooms ...
    // don't walk children if the user is not joined/invited to the space
    if !isJoinedOrInvited {
        continue
    }
} else if !authorised {
    inaccessible = append(inaccessible, queuedRoom.RoomID.String())
    continue
}

// don't walk the children if the parent is not a space room
if roomType != spec.MSpace {
    continue
}

// For each referenced room ID in the child events being returned to the caller
// add the room ID to the queue of unvisited rooms. Loop from the beginning.
// We need to invert the order here because the child events are lo->hi on the timestamp,
// so we need to ensure we pop in the same lo->hi order, which won't be the case if we
// insert the highest timestamp last in a stack.
extendQueueLoop:
for i := len(discoveredChildEvents) - 1; i >= 0; i-- {
    // ... skip inaccessible ...
    unvisited = append(unvisited, roomserver.RoomHierarchyWalkerQueuedRoom{
        RoomID:       *childRoomID,
        ParentRoomID: &queuedRoom.RoomID,
        Depth:        queuedRoom.Depth + 1,
        Vias:         spaceContent.Via,
    })
}
```

**The `isJoinedOrInvited` branch is load-bearing** (line 140-142): you can be *authorised* to SEE a space's metadata (because a parent granted you view) without being *a member*. In that case, you get the room entry back but do NOT recurse into its children. **This is the read/discover/enter tri-state.**

**What to port to EMA:**
This is your reference. Port line-by-line into TypeScript:

```typescript
// ema-core/src/space/walker.ts
export interface WalkerState {
  rootId: string;
  caller: CallerIdentity;
  unvisited: QueuedSpace[];      // stack
  processed: Set<string>;
  suggestedOnly: boolean;
  maxDepth: number;              // 0 = unlimited
}

export async function walkNextPage(
  state: WalkerState,
  limit: number,               // -1 = unlimited
  ctx: AbortSignal,
): Promise<{
  rooms: SpaceHierarchyEntry[];
  inaccessible: string[];
  nextWalker: WalkerState | null;
}> {
  // 1. Auth-check the root
  // 2. Copy state (immutability)
  // 3. Loop:
  //    - Check ctx.aborted → break (return partial)
  //    - Check limit → break
  //    - pop stack, skip processed, skip over-depth
  //    - Fetch local or via peer
  //    - Check access (returns {authorised, isMember, allowedSpaces})
  //    - If authorised, push to result
  //    - If isMember, push children in reverse order
  // 4. Return walker if unvisited remaining, else null
}
```

**Memory cost is O(processed + unvisited)**. For large graphs, the `processed` set grows unbounded. Mitigation: TTL the walker state on the server side (synapse does 5 min). Port that TTL.

### Pattern 2: The authorised() dispatcher

**Files:**
- `roomserver/internal/query/query_room_hierarchy.go:211-220`

**Snippet (verbatim from source):**
```go
// roomserver/internal/query/query_room_hierarchy.go:210-220
// authorised returns true iff the user is joined this room or the room is world_readable
func authorised(ctx context.Context, querier *Queryer, caller types.DeviceOrServerName, roomID spec.RoomID, parentRoomID *spec.RoomID) (authed, isJoinedOrInvited bool, resultAllowedRoomIDs []string) {
	if clientCaller := caller.Device(); clientCaller != nil {
		return authorisedUser(ctx, querier, clientCaller, roomID, parentRoomID)
	}
	if serverCaller := caller.ServerName(); serverCaller != nil {
		authed, resultAllowedRoomIDs = authorisedServer(ctx, querier, roomID, *serverCaller)
		return authed, false, resultAllowedRoomIDs
	}
	return false, false, resultAllowedRoomIDs
}
```

**Key insight:** The caller is either a **Device** (user request) or a **ServerName** (federation request). These have different access semantics, dispatched by type. Note that server callers never set `isJoinedOrInvited` — servers don't "join" rooms.

**What to port to EMA:**
EMA's walker caller is either a local user or a peer node. Same dispatch:

```typescript
type Caller = { type: 'user'; userId: string } | { type: 'peer'; peerId: string };

async function authorised(caller: Caller, spaceId: string, parentSpaceId: string | null) {
  if (caller.type === 'user') return authorisedUser(caller.userId, spaceId, parentSpaceId);
  if (caller.type === 'peer') return authorisedPeer(caller.peerId, spaceId);
}
```

### Pattern 3: authorisedServer — trust-but-verify with parent membership

**Files:**
- `roomserver/internal/query/query_room_hierarchy.go:222-295`

**Snippet (verbatim from source):**
```go
// roomserver/internal/query/query_room_hierarchy.go:252-271
// check if this room is a restricted room and if so, we need to check if the server is joined to an allowed room ID
// in addition to the actual room ID (but always do the actual one first as it's quicker in the common case)
allowJoinedToRoomIDs := []spec.RoomID{roomID}
joinRuleEv := queryRoomRes.StateEvents[joinRuleTuple]

if joinRuleEv != nil {
    rule, ruleErr := joinRuleEv.JoinRule()
    if ruleErr != nil {
        util.GetLogger(ctx).WithError(ruleErr).WithField("parent_room_id", roomID).Warn("failed to get join rule")
        return false, []string{}
    }

    if rule == spec.Public || rule == spec.Knock {
        return true, []string{}
    }

    if rule == spec.Restricted || rule == spec.KnockRestricted {
        allowJoinedToRoomIDs = append(allowJoinedToRoomIDs, restrictedJoinRuleAllowedRooms(ctx, joinRuleEv)...)
    }
}

// check if server is joined to any allowed room
// ... iterate allowJoinedToRoomIDs, check QueryJoinedHostServerNamesInRoom ...
```

**What to port to EMA:**
When a peer node requests to see a space, EMA checks:
1. Is the peer directly joined to this space? OR
2. Is the peer joined to ANY of the spaces listed in this space's restricted allow list?

The **allow list is unioned with the space itself** (line 254). Simple and cheap to implement.

### Pattern 4: authorisedUser — user-side access (the MSC3083 parent check)

**Files:**
- `roomserver/internal/query/query_room_hierarchy.go:297-380`

**Snippet (verbatim from source):**
```go
// roomserver/internal/query/query_room_hierarchy.go:338-378
joinRuleEv := queryRes.StateEvents[joinRuleTuple]
if parentRoomID != nil && joinRuleEv != nil {
    var allowed bool
    rule, ruleErr := joinRuleEv.JoinRule()
    if ruleErr != nil {
        util.GetLogger(ctx).WithError(ruleErr).WithField("parent_room_id", parentRoomID).Warn("failed to get join rule")
    } else if rule == spec.Public || rule == spec.Knock {
        allowed = true
    } else if rule == spec.Restricted {
        allowedRoomIDs := restrictedJoinRuleAllowedRooms(ctx, joinRuleEv)
        // check parent is in the allowed set
        for _, a := range allowedRoomIDs {
            resultAllowedRoomIDs = append(resultAllowedRoomIDs, a.String())
            if *parentRoomID == a {
                allowed = true
                break
            }
        }
    }
    if allowed {
        // ensure caller is joined to the parent room
        var queryRes2 roomserver.QueryCurrentStateResponse
        err = querier.QueryCurrentState(ctx, &roomserver.QueryCurrentStateRequest{
            RoomID: parentRoomID.String(),
            StateTuples: []gomatrixserverlib.StateKeyTuple{
                roomMemberTuple,
            },
        }, &queryRes2)
        // ...
        memberEv = queryRes2.StateEvents[roomMemberTuple]
        if memberEv != nil {
            membership, _ := memberEv.Membership()
            if membership == spec.Join {
                return true, false, resultAllowedRoomIDs
            }
        }
    }
}
return false, false, resultAllowedRoomIDs
```

**This is the core of the cascade**, and it's subtle:

1. The walker only passes `parentRoomID != nil` when we're recursing **into** a child from a known parent. The root is walked with `parentRoomID == nil`.
2. If the child has a `restricted` rule, we check: **does the allow list contain the parent we came from?**
3. If yes, we ALSO check: **is the user actually a member of that parent?**
4. Only if both are true → access granted via cascade.

**Critical security insight:** The check is **scoped to the recursion path**, not the full set of parents. If a child says "allow members of space X", we only honor that IF we arrived at this child via space X. This prevents a user with direct access to one parent from getting access to the child via a different parent's cascade.

**Wait — is that right?** Re-reading: if the user is not a member of the parent they came from but IS a member of another space in the allow list, dendrite would deny. That's **stricter** than synapse's `is_user_in_rooms` (which checks ALL allowed rooms).

**What to port to EMA:**
Decide: **path-scoped cascade** (dendrite style, stricter) or **global cascade** (synapse style, more permissive). EMA canon says org > team > project with single parent chain; I recommend **path-scoped**. It matches the user's mental model: "I'm in team X, so I see project Y via team X." If team X loses access, they don't suddenly regain it via some other team they happen to be in.

### Pattern 5: restrictedJoinRuleAllowedRooms

**Files:**
- `roomserver/internal/query/query_room_hierarchy.go:545-567`

**Snippet (verbatim from source):**
```go
// roomserver/internal/query/query_room_hierarchy.go:545-567
// given join_rule event, return list of rooms where membership of that room allows joining.
func restrictedJoinRuleAllowedRooms(ctx context.Context, joinRuleEv *types.HeaderedEvent) (allows []spec.RoomID) {
	rule, _ := joinRuleEv.JoinRule()
	if rule != spec.Restricted {
		return nil
	}
	var jrContent gomatrixserverlib.JoinRuleContent
	if err := json.Unmarshal(joinRuleEv.Content(), &jrContent); err != nil {
		util.GetLogger(ctx).Warnf("failed to check join_rule on room %s: %s", joinRuleEv.RoomID().String(), err)
		return nil
	}
	for _, allow := range jrContent.Allow {
		if allow.Type == spec.MRoomMembership {
			allowedRoomID, err := spec.NewRoomID(allow.RoomID)
			if err != nil {
				util.GetLogger(ctx).Warnf("invalid room ID '%s' found in join_rule on room %s: %s", allow.RoomID, joinRuleEv.RoomID().String(), err)
			} else {
				allows = append(allows, *allowedRoomID)
			}
		}
	}
	return
}
```

**What to port to EMA:**
Trivial parser. Note: it **silently skips** unknown `allow.Type` values. This is forward-compatible — future types (e.g., `m.user_membership`) are ignored but not errored. Port this tolerance.

### Pattern 6: childReferences — sort and filter children

**Files:**
- `roomserver/internal/query/query_room_hierarchy.go:457-517`

**Key snippet (verbatim from source):**
```go
// roomserver/internal/query/query_room_hierarchy.go:492-516
el := make([]fclient.RoomHierarchyStrippedEvent, 0, len(res.StateEvents))
for _, ev := range res.StateEvents {
    content := gjson.ParseBytes(ev.Content())
    // only return events that have a `via` key as per MSC1772
    // else we'll incorrectly walk redacted events (as the link
    // is in the state_key)
    if content.Get("via").Exists() {
        strip := stripped(ev.PDU)
        if strip == nil {
            continue
        }
        // if suggested only and this child isn't suggested, skip it.
        // if suggested only = false we include everything so don't need to check the content.
        if suggestedOnly && !content.Get("suggested").Bool() {
            continue
        }
        el = append(el, *strip)
    }
}
// sort by origin_server_ts as per MSC2946
sort.Slice(el, func(i, j int) bool {
    return el[i].OriginServerTS < el[j].OriginServerTS
})
```

**What to port to EMA:**
- Filter: `via` must exist (this is MSC1772's delete-by-empty semantics)
- Sort: by `origin_server_ts` ascending
- `suggestedOnly` applies here

**Note:** dendrite only sorts by `origin_server_ts`, NOT by `order`. That's a simplification vs. the spec. Synapse uses the full `(order, ts, id)` tiebreak. Port the **full** spec version in EMA.

## Gotchas found while reading

- **`limit == -1` for unlimited.** Sentinel, not a boolean param.
- **Context-canceled mid-walk returns partial results** rather than erroring. Port this — users cancelling navigation must not get an error page.
- **`isJoinedOrInvited` is returned separately from `authed`**. You can be authorised (can see) without being a member (can enter). Three-state, not two.
- **Parent-scoped cascade check is stricter than synapse's** — user must be joined to the specific parent they came from via the cascade, not just ANY allowed parent. This is a real semantic difference between the two reference impls. You need to pick a side.
- **Dendrite sorts children by `origin_server_ts` only.** Synapse uses full MSC2946 tiebreak. Synapse is more correct; port synapse's ordering even though you port dendrite's walker skeleton.
- **`unvisited` is a slice used as a stack** — pop from the end. Remember the reverse-push trick.
- **The walker state is immutable across calls** (lines 55-57 `copy()`). Mutation would break the cache. Port this immutability.
- **Federation caching key is the room ID** (`querier.Cache.GetRoomHierarchy(roomID.String())`, line 422). EMA's peer hydration cache should key on `(space_id, peer_id, suggested_only)`.

## Port recommendation

1. **This is your reference port.** Copy the skeleton from `query_room_hierarchy.go:42-208` into `ema-core/src/space/walker.ts`. Preserve the algorithm exactly.
2. **Translate the type names:**
   - `RoomHierarchyWalker` → `SpaceHierarchyWalker`
   - `RoomID` → `SpaceId` (branded string type)
   - `DeviceOrServerName` → `Caller` (union type)
   - `queryRoomRes.StateEvents[joinRuleTuple]` → `store.getEdgeMetadata(spaceId, 'join_rule')`
3. **Do not port federation.** Replace `federatedRoomInfo()` with `fetchFromPeers(peerList)` that uses EMA's P2P CRDT layer.
4. **Decide cascade scope.** I recommend path-scoped (dendrite) for clarity. Document the choice in `canon/specs/PERMISSION-CASCADE.md`.
5. **Port the `is_in_room` short-circuit.** Local data before peer fetch is a significant perf optimization.
6. **Testing:** dendrite has `query_test.go` in the same dir. Read it for test patterns — don't port as-is (depends on Go test helpers) but use as a functional test spec.
7. **Risks:**
   - Getting the reverse-push wrong (sorting order inversion).
   - Forgetting to copy walker state on cache retrieval.
   - Path-scoped vs. global cascade mixup.

## Related extractions

- `[[research/_extractions/matrix-org-matrix-spec-proposals]]` — the MSC2946 + MSC3083 specs this implements
- `[[research/_extractions/element-hq-synapse]]` — the Python cousin (use for MAX_ROOMS constants and access check ladder)
- `[[research/_extractions/element-hq-element-web]]` — client-side TypeScript walker (has getParents, parent map)

## Connections

- `[[research/p2p-crdt/matrix-org-dendrite]]` — original research node
- `[[research/_clones/INDEX]]`

#extraction #p2p-crdt #matrix #dendrite #go #walker
