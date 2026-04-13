---
id: RES-loomio
type: research
layer: research
category: self-building
title: "loomio/loomio — decisions as first-class queryable entities"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-f
source:
  url: https://github.com/loomio/loomio
  stars: 2537
  verified: 2026-04-12
  last_activity: 2026-04-10
  license: AGPL-3.0
signal_tier: S
tags: [research, self-building, decision-data, loomio, governance]
connections:
  - { target: "[[research/self-building/_MOC]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
---

# loomio/loomio

> 15 years of production use as a collaborative decision-making platform. The proposal lifecycle (draft → discussion → poll → outcome → decision record) is exactly the shape EMA's Proposals table is missing — currently EMA's proposals go through a generation pipeline but the *decision* itself isn't a first-class entity.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/loomio/loomio> |
| Stars | 2,537 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **S** |
| Language | Ruby on Rails + Vue (zero code lift; schema only) |
| License | AGPL-3.0 |

## What it is

Collaborative decision-making platform with structured proposal → discussion → poll → outcome → decision record flow. Used in production by cooperatives, NGOs, and democratic-governance orgs for 15+ years. The schema IS the value proposition.

## What to steal for EMA

### 1. Decision as a first-class queryable entity

EMA's current model:
```
Proposal {generated → refined → debated → tagged → queued → approved | killed}
```

That's a *pipeline*, not a *decision record*. After approval/kill, the decision-making context is lost.

Loomio's model:
```
Discussion (the topic)
  ↓
Poll (the proposal, with options)
  ↓
Stance (each participant's vote + reason)
  ↓
Outcome (the result + rationale)
  ↓
Decision (immutable record linked back to all of the above)
```

For EMA, port:

```typescript
Decision {
  id: string
  proposal_id: string         // FK to Ema.Proposals
  outcome: 'approved' | 'rejected' | 'modified' | 'deferred'
  rationale: string           // why the outcome (free text)
  dissent_notes: string?      // who objected, why (even with single user — record your own counter-arguments)
  decided_by_actor_id: string
  decided_at: timestamp
  alternatives_considered: JSON?  // what else was on the table
  reversal_conditions: string?    // what would change this decision
}
```

### 2. Decisions queryable

Loomio's `Decision` is a real DB entity. You can query "what did we decide last quarter about X?" or "show me all decisions with `reversal_conditions` mentioning Y." EMA's killed proposals just become orphan rows.

### 3. Stances with reasons

Even in single-user EMA, the **stance pattern** is useful: when you reject a proposal, the system prompts "why?" and the answer is stored alongside the decision. Six months later you can search "why did I kill that?" Currently EMA has no answer.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `EMA-V1-SPEC.md` ontology | Add `Decision` as a 7th canonical entity type (or as a subtype of Canon doc with `subtype: decision`) |
| `vapps/CATALOG.md` Proposal app | Reject/kill flow MUST capture rationale; not just a status flip |
| `BLUEPRINT-PLANNER.md` | Decision records become a first-class view alongside GAC + Blockers + Aspirations |
| New schema: `daemon/.../decisions/` (or TS equivalent) | New folder for decision records as graph nodes |

## Gaps surfaced

- **EMA kills proposals but never records why.** "Killed" + KillMemory pattern tracking is not the same as a decision log.
- **Six months from now you won't remember why you killed a class of proposals** unless you wrote it down at the time.
- **No "decisions as data" view** for retrospect: "what did we decide and why?"

## Notes

- Loomio is Rails + Vue, so **zero code lift** for EMA. The schema (Discussion, Poll, Stance, Outcome) is directly mappable to TypeScript types.
- AGPL-3.0 — viral. Don't copy code; copy the schema.
- The decision-as-data frame is the whole point. EMA already has the Canon doc model — Decision is just a Canon doc subtype with `outcome` and `rationale` fields.
- 15-year production use is the longest track record in this space. Not a fad.

## Connections

- `[[research/self-building/_MOC]]`
- `[[research/self-building/gsd-build-get-shit-done]]` — STATE.md cousin (ongoing project state vs decision records)
- `[[canon/specs/EMA-V1-SPEC]]` §4 ontology
- `[[canon/specs/BLUEPRINT-PLANNER]]` — Blueprint vApp gains decisions view

#research #self-building #signal-S #loomio #decision-data #governance
