---
id: INT-NERVOUS-SYSTEM-WIRING
type: intent
layer: intents
title: "Wire EMA nervous system — 4 concrete wire-ups unlocking 6 of 10 mega-opportunities"
status: preliminary
kind: wiring
phase: discover
priority: critical
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/calendar-april-2026-this-week-wire-ema-nervous-system/"
recovered_at: 2026-04-12
original_author: human
original_date: "2026-04 (this week marker)"
exit_condition: "All 4 wires land: (1) Memory.store_entry is called from Dispatcher on execution completion. (2) Sycophancy alert subscriber writes to Memory as a guideline. (3) AutoDecomposer emits Loop.open_loop calls. (4) execution.origin is set on approve. Each wire has a smoke test proving the call path fires end-to-end."
connections:
  - { target: "[[intents/INT-FEEDBACK-LOOP-INTEGRATION]]", relation: sibling }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: references }
tags: [intent, wiring, nervous-system, memory, dispatcher, critical, recovered, preliminary]
---

# INT-NERVOUS-SYSTEM-WIRING — Wire the EMA Nervous System

> **Recovery status:** Preliminary. Recovered verbatim from the old build's calendar intent `calendar-april-2026-this-week-wire-ema-nervous-system/`. Sibling of [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — both are "wiring, not features" intents. This one is the concrete four-wire checklist; the sibling is the integration test that proves the loop is closed end-to-end.

## Original intent text (verbatim)

> CALENDAR (April 2026 - this week): Wire EMA nervous system. 4 critical wire-ups: (1) Memory.store_entry from Dispatcher outcomes, (2) Sycophancy alert subscriber → Memory guideline, (3) AutoDecomposer → Loop.open_loop, (4) execution.origin set on approve. Each ~30 min. Total: 2-3 hours. UNLOCKS: 6 of 10 mega-opportunities documented in Self-Audit-2026-04-07. THIS IS THE HIGHEST LEVERAGE WORK.

## The four wires

### Wire 1: Memory.store_entry from Dispatcher outcomes

**What:** When the Dispatcher completes an execution (success, failure, partial, blocked), it must call `Memory.store_entry(outcome)` before releasing the execution. Currently the Dispatcher finishes and emits PubSub events but does not persist anything to Memory.

**Why:** This is the upstream half of the feedback loop in [[intents/INT-FEEDBACK-LOOP-INTEGRATION]]. Without it, Memory never learns that executions happened at all. The downstream half (Memory → Reflexion injection → better proposals) can't work if this wire is missing.

**Effort:** ~30 min per the original estimate. Realistically depends on whether the TS port of `Memory.store_entry` exists yet.

### Wire 2: Sycophancy alert subscriber → Memory guideline

**What:** There is (was?) a Sycophancy detector in the old build that publishes alerts when the system detects sycophantic output. Currently the alert is broadcast but no one subscribes and writes it to Memory as a guideline. Wire up a subscriber that stores "don't do that" as a Memory guideline record.

**Why:** The anti-sycophancy stance in [[canon/specs/EMA-CORE-PROMPT]] is a values commitment. This wire makes it **operationally self-reinforcing** — when the system catches itself being sycophantic, the lesson persists.

**Effort:** ~30 min. Depends on the Sycophancy detector existing in the TS port.

### Wire 3: AutoDecomposer → Loop.open_loop

**What:** The AutoDecomposer takes a high-level goal and decomposes it into sub-goals (per [[canon/specs/agents/AGENT-STRATEGIST]]). Currently it emits decomposed items but does not open a feedback loop for tracking whether the decomposition actually produced good sub-goals. Wire it to call `Loop.open_loop(decomposition_id)` so that the system can later evaluate the decomposition quality and feed lessons back.

**Why:** Without this wire, goal decomposition is a black-box — you can't tell which decomposition strategies work and which don't. The Loop is the learning mechanism.

**Effort:** ~30 min. Depends on Loop module existing.

### Wire 4: execution.origin set on approve

**What:** When a proposal is approved and becomes an execution, the `execution.origin` field must be set to the proposal ID (or brain-dump-seed ID, or whatever upstream source kicked it off). Currently the field exists in the schema but is not always populated.

**Why:** The feedback loop needs to trace outcomes **back to their source seed** to close the loop. If `execution.origin` is null, the system can't answer "did this proposal's approach actually work?" — which is the whole point of the Three Truths Semantic → Operational bridge in [[canon/decisions/DEC-007-unified-intents-schema]].

**Effort:** ~30 min. Simple schema-write fix.

## Time budget

Original estimate: **2–3 hours total** (4 × 30 min + some buffer).

Realistic estimate in the TypeScript rebuild: **probably 1–2 days**, because at least half of the upstream modules (Memory, Sycophancy detector, AutoDecomposer, Loop) haven't been ported yet and have to be stubbed or ported first. The 30-min estimates in the original assumed the Elixir modules already existed.

## Leverage claim

Original claim: **"UNLOCKS: 6 of 10 mega-opportunities documented in Self-Audit-2026-04-07."**

The Self-Audit-2026-04-07 document is **not yet in genesis** — it was referenced by multiple old-build intents but not recovered in the initial scan. Follow-up: find and port Self-Audit-2026-04-07. Until then, the "6 of 10" claim is provisional.

Even without the self-audit reference, the leverage is obvious: closing the feedback loop is the difference between EMA being a collection of supervised processes and EMA being an autonomous system that learns from its outputs. That's the claim, and it's defensible.

## Gaps / open questions

- **Memory module state.** Does the TS port of `Memory.store_entry` exist yet? If not, this intent depends on that port landing first.
- **Sycophancy detector state.** Does the detector exist in the TS port? If not, port it first.
- **AutoDecomposer state.** Does it exist as a named component in the TS port, or is it a Strategist-agent-level concern that hasn't been modeled separately?
- **Loop module state.** What's the TS equivalent of `Loop.open_loop`? Is it a new module or does it live inside the Memory system?
- **Self-Audit-2026-04-07 recovery.** The referenced audit document hasn't been found. It may live in the vault or be lost. Worth a focused search.

## Related

- [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — sibling intent: the end-to-end integration test
- [[canon/specs/EMA-CORE-PROMPT]] — the anti-sycophancy stance wire #2 reinforces
- [[canon/decisions/DEC-007-unified-intents-schema]] — the Three Truths model wire #4 operates on
- [[_meta/SELF-POLLINATION-FINDINGS]] — background inventory

#intent #wiring #nervous-system #memory #dispatcher #critical #recovered #preliminary
