---
id: SPEC-BABYSITTER-SYSTEM
type: canon
subtype: spec
layer: canon
title: "Babysitter System — adaptive agent observability with 7 semantic lanes and cadence buckets"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "~/.local/share/ema/vault/wiki/Architecture/Babysitter-System.md"
recovered_at: 2026-04-12
connections:
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [canon, spec, babysitter, observability, agents, recovered, preliminary]
---

# Babysitter System

> **Recovery status:** Preliminary. Architecture recovered from the EMA wiki. The Babysitter is a polished, self-contained observability subsystem in the old Elixir build. It survives the rewrite as an operational concern — not user-facing canon, but essential for agent transparency.

## What it is

The Babysitter is EMA's **adaptive observability layer** for agent work. It watches what agents are doing, decides how often and how loudly to report, and emits structured signals to multiple downstream channels.

Three design choices distinguish it:

1. **Semantic lanes** instead of log levels. Agent activity is categorized by *what kind* of activity it is, not how severe.
2. **Cadence buckets** instead of fixed poll intervals. How often the lane emits depends on how much is happening.
3. **Takeover state machine** that handles handoff between human and agent attention without creating notification spam.

## The 7 semantic lanes

| Lane | What it reports |
|---|---|
| `operator_rollup` | Periodic summary for the human operator — "here's what your agents have been doing" |
| `operations` | Infrastructure events — GenServer restarts, pauses, failures, resource pressure |
| `attention` | Things that require human attention — pending approvals, blockers, errors that can't auto-resolve |
| `intelligence` | Reasoning outputs — decisions made, proposals generated, conclusions reached |
| `memory` | Memory writes — new learnings, consolidated knowledge, vault additions |
| `thought` | Intermediate thinking — stream-of-consciousness from agents during execution |
| `intent` | Intent graph changes — additions, contradictions detected, clarifications requested |

## Cadence buckets

Each lane maps to a cadence bucket based on how much activity it's producing and how urgent it is:

| Bucket | Interval | When to use |
|---|---|---|
| realtime | ~30s | Active agent session, high-signal events |
| rapid | ~2 min | Active work, medium-signal events |
| steady | ~10 min | Ongoing background work |
| default | ~20 min | Low activity, periodic rollup |

The `ChannelPolicy` module decides which bucket a lane goes into based on: current activity level, token pressure on the LLM budget, idle detection (nothing happening → drop to `default`), user presence.

## The Takeover state machine

Models whether the human is "driving" or the agent is "driving":

- `idle` — neither side is actively engaged. Emit only rollups.
- `active` — one side is driving. Emit at the bucket cadence for the lanes that matter to the driver.

Transitions happen on explicit signals (user opens a vApp, agent starts a session) or detected heuristics (no input for N minutes → idle).

The point of the state machine is to prevent notification spam when the human is actively using the system and doesn't need the Babysitter to tell them what they can already see, while still delivering digest information when they come back after a break.

## Integration surfaces

The old build emitted Babysitter signals to:
- 8 REST endpoints for vApp consumption
- 1 WebSocket channel for real-time push
- Discord integration posting to 7 channels (one per lane, minus `operator_rollup` which goes to a dedicated ops channel)

## Port implications

**Status in SELF-POLLINATION:** not explicitly categorized, but per the existing inventory it's a self-contained subsystem that can port directly or be replaced. Recommendation: **TIER PORT** with a simpler emitter layer (no Discord in v1 unless the user wants it). The 7 lanes, cadence buckets, and Takeover state machine are EMA-native and worth preserving.

In TypeScript:
- Lanes become a typed enum + per-lane config object
- Cadence buckets become `setInterval`-driven emitters (not a separate subsystem)
- Takeover state machine is a simple xstate machine or a hand-rolled two-state FSM
- REST + WS surfaces collapse into `@ema/core` SDK calls

## Gaps / open questions

- **Activity scoring function.** The original had a scoring algorithm that decided which bucket a lane was in. Not recovered in detail. Needs extraction from old code.
- **Token pressure awareness.** The original factored in LLM token budget as an input to cadence decisions. How? Probably a hook into the Claude Runner. Needs spec.
- **Discord as a downstream.** Optional for v1, but the contract (what event shape goes to a Discord webhook) should be documented.
- **Idle detection heuristics.** "Nothing happening" is vague. Specific signals (no vApp activity, no keystrokes, no agent dispatches) need enumeration.

## Related

- [[canon/specs/EMA-V1-SPEC]] — parent spec
- [[canon/specs/AGENT-RUNTIME]] — what the Babysitter observes
- [[_meta/SELF-POLLINATION-FINDINGS]] — context for porting tiers
- Original source: `~/.local/share/ema/vault/wiki/Architecture/Babysitter-System.md`

#canon #spec #babysitter #observability #agents #recovered #preliminary
