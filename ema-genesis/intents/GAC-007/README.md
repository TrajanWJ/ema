---
id: GAC-007
type: gac_card
layer: intents
title: "Nested spaces — commit to Matrix-style cascade or flatten like every team-chat product?"
status: answered
created: 2026-04-12
updated: 2026-04-12
answered_at: 2026-04-12
answered_by: recovery-wave-3
resolution: flat-mvp-parent-id-reserved-for-v2
author: research-round-2-b
category: clarification
priority: high
connections:
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[research/p2p-crdt/matrix-org-MSC1772]]", relation: derived_from }
  - { target: "[[research/p2p-crdt/mattermost-rocketchat]]", relation: derived_from }
  - { target: "[[research/p2p-crdt/anyproto-any-sync]]", relation: derived_from }
---

# GAC-007 — Nested spaces commit-or-flatten

## Question

Genesis canon says spaces nest as `org > team > project` with permission cascade. **Round 2-B surfaced strong negative prior art**: Mattermost, Rocket.Chat, and Anytype all chose flat. Matrix is the only positive example, and it's a protocol spec, not a shipped product. **Commit to nesting or flatten?**

## Context

Three data points:

1. **Matrix MSC1772** (`[[research/p2p-crdt/matrix-org-MSC1772]]`) — actually solves it via three MSCs (1772 + 2946 + 3083). Bidirectional both-sides-required edges + opt-in cascade. Production-tested for 5+ years.
2. **Mattermost + Rocket.Chat** (`[[research/p2p-crdt/mattermost-rocketchat]]`) — both flat. Two of the most mature open team-chat products in production. **Negative prior art.**
3. **Anytype** (`[[research/p2p-crdt/anyproto-any-sync]]`) — also flat. They explicitly tried, decided nesting wasn't worth the complexity.

> Nobody in the team-chat space has successfully shipped nested-space-as-first-class after 10+ years. EMA is copying a concept that only exists in a protocol spec.

## Options

- **[A] Commit to Matrix-style nesting**: Adopt MSC1772 + MSC2946 + MSC3083 as design inspiration. Bidirectional parent/child both required. Explicit opt-in cascade via allow lists. Cycle handling via deterministic ID sort.
  - **Implications:** Most complex. Matches Genesis canon. Real solution to a real problem when EMA scales to teams. Three sub-mechanics to implement.
- **[B] Flatten to one level**: Spaces are flat. Org/team/project become tags or properties. Permissions are per-space, not inherited.
  - **Implications:** Matches every successful team-chat product. Simpler. Loses the "subspaces inside a space" UI that Genesis envisions.
- **[C] Two-level fixed hierarchy**: org → space (flat below). No nested spaces inside spaces. Org is metadata-only.
  - **Implications:** Compromise. Two levels match real-world team structures. Doesn't support `org > team > project > sub-project`.
- **[D] Defer with a flat MVP**: V1 ships flat. V2 considers nesting based on actual user pain. Genesis canon adjusts to "spaces" without nesting commitment.
  - **Implications:** Lowest risk. Doesn't lock in either way.
- **[1] Defer**: Pick after first multi-user data.
- **[2] Skip**: Single-user EMA doesn't need this debate.

## Recommendation

**[D] Defer with a flat MVP**, then [A] Matrix-style nesting if and only if real team usage demands it. Most successful products that ship nesting were forced into it by users; few succeed by predicting it. Update Genesis canon to soften the "spaces nest as org > team > project" claim into "spaces support optional parent/child relationships, defaults flat."

## What this changes

`EMA-GENESIS-PROMPT.md` §9 and `SCHEMATIC-v0.md` Entity Model both currently assume nesting. Soften to "optional parent/child" with the specific Matrix-style mechanics deferred.

## Connections

- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9
- `[[research/p2p-crdt/matrix-org-MSC1772]]` — positive prior art
- `[[research/p2p-crdt/mattermost-rocketchat]]` — negative prior art
- `[[research/p2p-crdt/anyproto-any-sync]]` — negative prior art

## Resolution (2026-04-12)

**Answer: [D] Flat MVP, `parent_id` column reserved for v2.**

Shipped in `services/core/spaces/` during Recovery Wave 3. The `shared/schemas/spaces.ts` schema explicitly commits to the flat model — one-level slug uniqueness, no `parent_id` column, no CTEs, no recursive joins. A doc comment in the schema forbids adding `parent_id` without a new GAC card, matching this card's recommended path.

v2 nesting will be a forward-compatible migration: add `parent_id: string | null` + a new canon card, no schema-breaking change.

**Service proof of life:** `GET /api/spaces/` cold-boots with an idempotent `personal` default space. 11/11 tests passing. Covered by `services/core/spaces/spaces.test.ts`. Events: `space:created`, `space:archived`, `space:member_added`, `space:member_removed`. State machine: `draft → active → archived`, terminal.

**Genesis canon follow-up:** `EMA-GENESIS-PROMPT.md` §9 and `SCHEMATIC-v0.md` Entity Model need their "spaces nest as org > team > project" language softened to "spaces are flat by default, nesting reserved for v2+". Pending canon edit.

#gac #clarification #priority-high #nested-spaces #scope #answered #recovery-wave-3
