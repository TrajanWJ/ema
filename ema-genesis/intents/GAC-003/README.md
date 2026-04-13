---
id: GAC-003
type: gac_card
layer: intents
title: "Agent state machine — what states does a running agent occupy beyond DETECT/LAUNCH/WORK/REPORT/IDLE?"
status: answered
created: 2026-04-12
updated: 2026-04-12
answered_at: 2026-04-12
answered_by: human
resolution: option-D-7-state-plus-heartbeat
author: research-round-1
category: gap
priority: high
connections:
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]", relation: derived_from }
  - { target: "[[research/cli-terminal/Ark0N-Codeman]]", relation: derived_from }
---

# GAC-003 — Agent state machine vocabulary

## Question

`AGENT-RUNTIME.md` says the agent lifecycle is `DETECT → CONFIGURE → LAUNCH → WORK → REPORT → IDLE`. This doesn't distinguish "working" from "blocked-on-approval" from "context-full" from "crashed." What states does the canon need?

## Context

Round 1's `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]` and `[[research/cli-terminal/Ark0N-Codeman]]` both have richer state machines:

- `working` — actively producing output
- `idle` — no output for N seconds, but heartbeat alive
- `blocked` — waiting for human input or external dependency
- `error` — unrecoverable failure
- `context-full` — token limit reached, needs compaction
- `paused` — explicitly halted by user
- `crashed` — process gone

Without these states, EMA can't distinguish "Claude is thinking deeply" from "Claude crashed." Heartbeat-based polling needs adaptive timeouts.

## Options

- **[A] 7-state model from agent_farm**: working / idle / blocked / error / context-full / paused / crashed. Heartbeat polls pane content, classifies state, persists.
  - **Implications:** Comprehensive. Maps to UI affordances directly. Adaptive idle timeouts based on observed work patterns.
- **[B] 4-state minimum**: working / idle / blocked / error. Skip context-full (auto-handle), paused (rare), crashed (= error after timeout).
  - **Implications:** Simpler. Loses the auto-compact trigger and explicit user-pause distinction.
- **[C] 3-state coarse**: running / waiting / done. Aggregates all the nuance into three buckets.
  - **Implications:** Easy to reason about, easy to render. Loses the diagnostic value.
- **[D] 7-state model + heartbeat detection**: [A] + a polling loop that classifies state from terminal output every N seconds. Adaptive idle timeouts.
  - **Implications:** **Recommended.** This is the production-grade pattern. agent_farm's polling code is small enough to port directly.
- **[1] Defer**: Build the simplest thing that works, expand when state confusion bites.
- **[2] Skip**: Single agent v1 doesn't need state machine complexity.

## Recommendation

**[D]** — adopt the 7-state model with heartbeat-based classification. This is small enough to do correctly v1 and large enough to matter the moment the user runs >1 agent.

## What this changes

`AGENT-RUNTIME.md` lifecycle gets the 7-state diagram. Add `Agent State Machine` section with the heartbeat loop. Add a `Status` field on the agent runtime model with the enum.

## Connections

- `[[canon/specs/AGENT-RUNTIME]]`
- `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]`
- `[[research/cli-terminal/Ark0N-Codeman]]`

## Resolution (2026-04-12)

**Answer: [D] 7-state runtime model + heartbeat classification.**

The agent *runtime process* state machine is:

```
working  → actively producing output
idle     → no output for N seconds, heartbeat alive
blocked  → waiting for human input or external dependency
error    → unrecoverable failure
context-full → token limit reached, needs compaction
paused   → explicitly halted by user
crashed  → process gone
```

Transitions are observed, not declared. A polling loop classifies terminal output every heartbeat interval (adaptive per observed work patterns). `AGENT-RUNTIME.md` gains an `Agent State Machine` section with this enum and the heartbeat loop description when Phase 2 begins.

**Orthogonal axis:** this is *process runtime state*, not *work lifecycle*. The work lifecycle (`idle / plan / execute / review / retro`) is handled separately by `[[canon/decisions/DEC-005-actor-phases]]` — ported verbatim from the old Elixir `Ema.Actors` module. An agent can be `runtime:working` while in `phase:execute`, or `runtime:idle` while in `phase:review`.

#gac #gap #priority-high #agent-state-machine #answered
