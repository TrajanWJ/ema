---
id: RES-tuwunel
type: research
layer: research
category: p2p-crdt
title: "matrix-construct/tuwunel — only actively maintained Matrix homeserver in Rust"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-b
source:
  url: https://github.com/matrix-construct/tuwunel
  stars: 1902
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: B
tags: [research, p2p-crdt, signal-B, tuwunel, matrix, rust]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/matrix-org-MSC1772]]", relation: references }
---

# matrix-construct/tuwunel

> Rust Matrix homeserver. **The only actively-maintained production-grade Matrix server at research time.** Synapse archived → element-hq fork; Dendrite archived; conduit/conduwuit fork chain → tuwunel and continuwuity.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/matrix-construct/tuwunel> |
| Stars | 1,902 (verified 2026-04-12) |
| Last activity | 2026-04-12 (active) |
| Signal tier | **B** |

## What to learn

### 1. Live Rust source for MSC space walking

If EMA wants to read live Rust code for nested-space implementation, this is the file tree to study. The only production impl of MSC3083 restricted rooms in Rust.

### 2. Implementation churn = protocol risk

**The fork chain** (conduit → conduwuit → tuwunel + continuwuity) surfaces an EMA risk: if canon mandates a specific wire format (MSC event types), EMA is coupling to a protocol with unstable implementations.

**Canon should say "inspired by MSC1772," not "implements MSC1772."**

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §9` | Be explicit that EMA's nested-space pattern is *inspired by* MSC1772, not protocol-compatible with Matrix |

## Notes

- Two competing forks (tuwunel + continuwuity) means don't depend on either.
- The protocol is stable; the implementations aren't.
- Worth a quick read for the Rust walker code, but not a dependency target.

## Connections

- `[[research/p2p-crdt/matrix-org-MSC1772]]` — the spec
- `[[research/p2p-crdt/matrix-org-dendrite]]` — Go alternative
- `[[research/p2p-crdt/element-hq-synapse]]` — Python alternative

#research #p2p-crdt #signal-B #tuwunel #matrix #rust
