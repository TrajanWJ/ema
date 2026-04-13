---
id: RES-jazz
type: research
layer: research
category: p2p-crdt
title: "garden-co/jazz — schema-first local-first with CoValues, Groups, role permissions"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/garden-co/jazz
  stars: 2525
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: S
tags: [research, p2p-crdt, signal-S, jazz, permissions, group-model]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/dxos-dxos]]", relation: references }
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
---

# garden-co/jazz

> Schema-first local-first framework with **CoValues + Groups + Role permissions**. The schema and permissions model is the steal target — NOT the sync transport (Jazz uses central sync servers, not true P2P).

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/garden-co/jazz> |
| Stars | 2,525 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **S** (for schema/permissions model only) |

## What to steal

### 1. CoValues + Groups + Roles

Jazz primitive:
- Every CoValue (CoMap, CoList, CoText, CoFeed) **owns a Group**
- Every Group has **Admin / Writer / Reader / WriteOnly** roles
- Permissions cascade through ownership

```typescript
const space = co.group();
space.addMember(alice, "admin");
space.addMember(bob, "writer");
space.addMember(charlie, "reader");
space.addMember(audit_logger, "writeOnly");

const intent = co.map<Intent>().withGroup(space);
// intent inherits the group's permissions
```

EMA's space nesting (org > team > project) maps directly. Each EMA Space IS a Group. Members get one of the four roles.

### 2. The four-role model (the killer detail)

| Role | Read | Write | Manage |
|---|---|---|---|
| Admin | ✓ | ✓ | ✓ |
| Writer | ✓ | ✓ | ✗ |
| Reader | ✓ | ✗ | ✗ |
| **WriteOnly** | ✗ | ✓ | ✗ |

**WriteOnly is the answer to EMA's "invisible peer" canon.** An audit-log writer that can append without reading other members' content. Round 1 surfaced no other prior art for this role — Jazz has it built in.

### 3. Schema-first declarations

```typescript
const Intent = co.map({
  title: co.string,
  status: co.literal("draft", "active", "completed", "deprecated"),
  parent_id: co.optional(co.string),
});
```

Type inference from schema. Validation at write time. EMA's Drizzle/Kysely schemas should follow this shape.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §9` | Adopt the four-role model (Owner/Admin/Writer/Reader/WriteOnly) for space membership |
| `vapps/CATALOG.md` Permissions | Replace "auto-approve levels" with the role-based model |
| `SCHEMATIC-v0.md` Entity Model | Each Space has an embedded Group with role memberships |

## Gaps surfaced

- **EMA canon handwaves "host/regular/invisible peer roles"** but doesn't define the permission matrix. "Invisible peer" was unclear — is it read-only? Jazz's WriteOnly role (can append but not read back) is the actual primitive you want for "invisible" (an audit-log writer that can't see other members).

## Notes

- **Jazz is NOT true P2P** — data flows through sync servers. Use it as the model for schema and permissions only, layer over Loro for the actual sync.
- The schema-first ergonomics are the killer feature alongside the permissions model.

## Connections

- `[[research/p2p-crdt/dxos-dxos]]` — HALO/ECHO/MESH layer cousin
- `[[research/p2p-crdt/loro-dev-loro]]` — actual sync engine (not Jazz's sync servers)
- `[[research/p2p-crdt/anyproto-any-sync]]` — flat-spaces alternative with different ACL model
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9

#research #p2p-crdt #signal-S #jazz #permissions #group-model
