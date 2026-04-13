---
id: INT-FEEDBACK-LOOP-INTEGRATION
type: intent
layer: intents
title: "Close the feedback loop — end-to-end integration test: seed → proposal → execution → outcome → feedback → better seeds"
status: preliminary
kind: wiring
phase: discover
priority: critical
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/critical-insight-from-missing-pieces-analysis-the-gap-is-no/"
recovered_at: 2026-04-12
original_author: human
original_date: "2026-04 (exact date TBD)"
exit_condition: "An end-to-end integration test exists that seeds a brain dump, watches it become a proposal, watches the proposal get approved into an execution, watches the execution emit an outcome, and verifies the outcome feeds back into the next batch of proposal seeds with measurably different scoring. Test runs in CI. Test fails if any wire is disconnected."
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: references }
  - { target: "[[intents/INT-NERVOUS-SYSTEM-WIRING]]", relation: sibling }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
tags: [intent, wiring, feedback-loop, integration-test, critical, recovered, preliminary]
---

# INT-FEEDBACK-LOOP-INTEGRATION — Close the Feedback Loop

> **Recovery status:** Preliminary. Recovered verbatim from the old build's `.superman/intents/critical-insight-from-missing-pieces-analysis-the-gap-is-no/intent.md`. The insight is the highest-leverage finding in the recovery set and deserves first-class intent status in the new canon.

## Original intent text (verbatim)

> CRITICAL INSIGHT from missing pieces analysis: The gap is NOT features — it's WIRING. EMA has 40+ supervised processes but many aren't connected. The single most impactful missing piece is an end-to-end integration test proving the full loop closes: seed → proposal → execution → outcome → feedback → better seeds. Second: daily OTP health digest showing restarts, pauses, failures. Third: Durable-style step persistence for crash-recoverable executions.

## Why this is first-priority

Every other intent in the recovery set (autonomous reasoning, knowledge compilation, skills ecosystem, P2P sync) **depends on the feedback loop actually closing**. Without it, the system is 40 supervised processes that don't learn from their outputs. That's operational efficiency, not autonomy.

The old build's author (human, Trajan) explicitly framed this as **"the gap is NOT features — it's WIRING"**. Reading this alongside the massive feature list in the old Tauri build, the insight lands: the features were over-built relative to the glue. Recovery into the new canon must front-load the glue.

## The three sub-items (as stated by the original)

### 1. End-to-end integration test proving the full loop closes

The loop is: `seed → proposal → execution → outcome → feedback → better seeds`.

Each arrow is a wire:
- **seed → proposal:** BrainDump items (or vault-seeded items per [[_meta/SELF-POLLINATION-FINDINGS]] §A VaultSeeder) get picked up by the Proposal Pipeline Scheduler and turn into proposal drafts.
- **proposal → execution:** Approved proposals become execution records via the Dispatcher.
- **execution → outcome:** Executions complete and emit an outcome (success/failure/partial/blocked, with metadata).
- **outcome → feedback:** Outcomes flow into Memory (per [[intents/INT-NERVOUS-SYSTEM-WIRING]] wire #1: "Memory.store_entry from Dispatcher outcomes").
- **feedback → better seeds:** Memory influences the next proposal generation cycle — via Reflexion injection (per the AutonomousImprovementEngine) — so that recent failure modes are avoided in new proposals.

The integration test must exercise all five wires and fail if any one is disconnected.

### 2. Daily OTP health digest

A digest showing GenServer restarts, pauses, failures, over the last 24 hours. This is not a feature; it's observability. Without it, the 40+ supervised processes are a black box — you can't tell which wires are actively failing.

### 3. Durable-style step persistence for crash-recoverable executions

Executions should be able to resume after a daemon restart. Each step in an execution pipeline should persist enough state to pick up where it left off. The old build flagged [[research/agent-orchestration/dbos-inc-dbos-transact-ts]] (DBOS Transact) as the replacement path — TypeScript-native, SQLite-friendly, durable workflow engine. That's a TIER REPLACE item in the existing inventory.

## What's already in genesis

- [[canon/decisions/DEC-007-unified-intents-schema]] — the Three Truths model that this loop operates within
- [[_meta/SELF-POLLINATION-FINDINGS]] §A — TIER REPLACE: DBOS Transact is queued to replace execution durability
- [[intents/INT-RECOVERY-WAVE-1]] — parent recovery intent covering the broader port
- Proposal pipeline and execution dispatcher schemas — ported from the old build (see SELF-POLLINATION TIER PORT entries)

## What's still missing

- **The integration test itself.** No code exists for it. It's a new piece of work.
- **Outcome schema.** Executions emit some kind of result today, but "outcome" as a first-class concept with `{status, metadata, lessons, confidence}` isn't yet specified.
- **Reflexion injection wire.** [[research/frontend-patterns/launchpad-one-thing-card|One Thing card]] and the Reflexion injector both need Memory integration. The wire is not drawn.
- **Memory schema for store_entry.** The old build had it; the new TS port doesn't yet.

## Proposed execution path (not a plan, just a sketch)

1. Spec the outcome schema as a canon spec.
2. Port Memory store with `store_entry(execution_outcome)` as its first method.
3. Wire Dispatcher to call Memory.store_entry on execution completion.
4. Wire the Proposal Pipeline Scheduler to consult Memory for recent outcomes and inject Reflexion into the Generator stage.
5. Write the integration test that exercises all five wires. Make it fail by default so a red CI forces the wiring to land.
6. Once green, the feedback loop is officially closed.

The full plan belongs in a proposal, not in this intent. This intent just says: **this is the most important thing to wire.**

## Blockers

- None. Everything it depends on exists either in the old build (code to port) or in genesis (schemas to reference).

## Related

- [[intents/INT-NERVOUS-SYSTEM-WIRING]] — sibling intent covering the 4 concrete wire-ups (this intent is the integration test; the sibling is the wires)
- [[_meta/SELF-POLLINATION-FINDINGS]] §A — existing PORT/REPLACE/DROP inventory
- [[canon/decisions/DEC-007-unified-intents-schema]] — the schema the loop operates within

#intent #wiring #feedback-loop #integration-test #critical #recovered #preliminary
