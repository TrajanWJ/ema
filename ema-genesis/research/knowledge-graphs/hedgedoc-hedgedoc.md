---
id: RES-hedgedoc
type: research
layer: research
category: knowledge-graphs
title: "hedgedoc/hedgedoc — self-hosted realtime collaborative markdown editor"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-f
source:
  url: https://github.com/hedgedoc/hedgedoc
  stars: 7082
  verified: 2026-04-12
  last_activity: 2026-04-10
  license: AGPL-3.0
signal_tier: A
tags: [research, knowledge-graphs, realtime-wiki, hedgedoc, codimd]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: references }
---

# hedgedoc/hedgedoc

> Self-hostable collaborative markdown editor (formerly CodiMD). Currently rewriting v2 to split backend/frontend with realtime sync. The closest existing OSS to "two humans + N agents editing the same vault note simultaneously."

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/hedgedoc/hedgedoc> |
| Stars | 7,082 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **A** |
| Language | TypeScript (v2) + Node.js |
| License | AGPL-3.0 |

## What it is

Self-hostable realtime collaborative markdown editor. v1 (production-stable) uses operational transform (OT) for sync; v2 (alpha) uses CRDTs. Per-document Socket.IO room, optimistic concurrency, version history, public/private/team modes.

## What to steal for EMA

### 1. Room-per-document Socket.IO sync

For EMA's case (you + agents, not a team of 50), full CRDT sync per `[[DEC-002]]` may be overkill for some vault notes. HedgeDoc v1's "room-per-document with OT" is a simpler alternative for low-collaborator scenarios. Worth considering as a fallback for vault notes where Loro is heavy.

### 2. Versioning + diff UI

HedgeDoc's version history UI lets you see who changed what when, with diffs. Lift this for EMA's vault note diff view — particularly useful when an agent edits a note you wrote.

### 3. Backend/frontend split (v2)

v2 separates the backend (TypeScript Node.js) from the frontend (React) cleanly. Same shape EMA's vault notes editor needs. The split is documented in their architecture docs.

### 4. Public/private modes per document

Each document has a visibility setting: public, link-only, password-protected, team. Per-document permissions. EMA's per-space permission model could go finer-grained at the document level following this.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `vapps/CATALOG.md` Vault | Add "real-time collab model" — HedgeDoc's room-per-doc OT as fallback for cases where full CRDT is too heavy |
| `EMA-GENESIS-PROMPT.md §9` | Per-document visibility/permission as a finer grain than per-space |
| New canon spec stub | "vault-collab-minimal.md" referencing HedgeDoc v1 architecture |

## Gaps surfaced

- **EMA has no concrete plan for human+agent concurrent editing of a single vault note.** Do agents write to a staging branch or directly to the file? HedgeDoc v1's pessimistic locking + v2's CRDT trajectory shows the evolution path.
- **No per-document permissions** — currently it's per-space.

## Notes

- HedgeDoc v1 ships and is maintained; v2 is still alpha. Use v1 code for reference, not v2.
- The OT (not CRDT) sync in v1 is honest about its limits — good teacher for where CRDT is actually necessary vs where OT suffices.
- AGPL-3.0 — copy patterns, not code.
- Formerly known as CodiMD; before that, HackMD.

## Connections

- `[[research/knowledge-graphs/_MOC]]`
- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — different pattern (single-user-then-sync vs multi-user-then-merge)
- `[[research/p2p-crdt/loro-dev-loro]]` — CRDT alternative
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9
- `[[DEC-002]]` — sync split decision

#research #knowledge-graphs #signal-A #hedgedoc #realtime-wiki
