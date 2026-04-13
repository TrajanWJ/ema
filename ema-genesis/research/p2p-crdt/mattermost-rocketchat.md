---
id: RES-mattermost-rocketchat
type: research
layer: research
category: p2p-crdt
title: "mattermost + Rocket.Chat — both flat, both negative prior art for nested spaces"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-b
source:
  url: https://github.com/mattermost/mattermost
  stars: 36165
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: A
tags: [research, p2p-crdt, signal-A, mattermost, rocketchat, negative-prior-art, flat-spaces]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/matrix-org-MSC1772]]", relation: references }
  - { target: "[[research/p2p-crdt/anyproto-any-sync]]", relation: references }
---

# mattermost/mattermost + RocketChat/Rocket.Chat

> Two of the most mature open-source team-chat products. **Both implement only a flat two-level teams→channels hierarchy.** Negative prior art for EMA's nested-space canon.

## Source

| Field | Value |
|---|---|
| Mattermost URL | <https://github.com/mattermost/mattermost> |
| Mattermost stars | 36,165 (verified 2026-04-12) |
| RocketChat URL | <https://github.com/RocketChat/Rocket.Chat> |
| RocketChat stars | 45,136 (verified 2026-04-12) |
| Last activity | 2026-04-12 (both) |
| Signal tier | **A** (negative prior art) |

## What this tells you

### 1. Flat hierarchy at the top level

Both have teams → channels. Two levels. **No team-in-team.** No cascading permissions — permissions layer rather than inherit.

### 2. Mattermost: scheme-based role inheritance

`SchemeUser`, `SchemeAdmin` at team level, with channel-level overrides. Not real cascade — explicit override per scope.

### 3. Rocket.Chat: two independent permission checks

Team-level + room-level checks, both required. Not cascade — conjunction.

### 4. The negative signal

**Two of the most mature team-chat products in production decided NOT to nest.** That's evidence canon's "org > team > project" nesting may not be validated by anyone at scale.

The only place "real nested spaces with cascade" is fully solved in OSS is `[[research/p2p-crdt/matrix-org-MSC1772]]` — a protocol spec, not a product.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §9` | Either commit to nesting with explicit Matrix-style both-sides-verified cascade, OR flatten to one level like every successful team-chat product. **The middle ground is where complexity lives.** |

## Gaps surfaced

- **Nobody in the team-chat space has successfully shipped nested-space-as-first-class after 10+ years.** Matrix is the only place the concept is real, and Matrix is a protocol, not a product.
- EMA is copying a concept that only exists in a protocol spec.

## Notes

- Negative prior art is itself useful.
- Don't treat "nothing matches" as "nobody tried" — they tried and chose flat.

## Connections

- `[[research/p2p-crdt/matrix-org-MSC1772]]` — the only positive prior art
- `[[research/p2p-crdt/anyproto-any-sync]]` — also flat
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9

#research #p2p-crdt #signal-A #mattermost #rocketchat #negative-prior-art
