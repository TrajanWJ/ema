---
id: INT-AUTONOMOUS-REASONING-PHASE3
type: intent
layer: intents
title: "Phase 3 Autonomous Reasoning Loop — the forgotten meta-loop that makes EMA autonomous"
status: preliminary
kind: new-work
phase: discover
priority: high
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/calendar-may-2026-next-month-ship-phase-3-autonomous-re/"
recovered_at: 2026-04-12
original_author: human
original_schedule: "2026-05 (planned May 2026 in old build)"
exit_condition: "ReflexionInjector is wired into the proposal pipeline. AutonomousImprovementEngine generates proposals from detected system gaps. Evolution rules auto-apply with a confidence threshold. Weekly epistemic honesty audit runs and reports."
connections:
  - { target: "[[intents/INT-FEEDBACK-LOOP-INTEGRATION]]", relation: depends_on }
  - { target: "[[intents/INT-NERVOUS-SYSTEM-WIRING]]", relation: depends_on }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [intent, new-work, phase-3, autonomous, reflexion, recovered, preliminary]
---

# INT-AUTONOMOUS-REASONING-PHASE3

> **Recovery status:** Preliminary. Originally scheduled for May 2026 in the old build's calendar intents. Blocked on the feedback loop closing first.

## Original intent text (verbatim)

> CALENDAR (May 2026 - next month): Ship Phase 3 Autonomous Reasoning Loop. The forgotten meta-loop that makes EMA autonomous instead of operationally efficient. Depends on outcome feedback loop being closed first. Components: ReflexionInjector wired, AutonomousImprovementEngine generating proposals from gaps, Evolution rules auto-applying with confidence threshold, weekly epistemic honesty audit.

## Components

1. **ReflexionInjector wired** — prepends lessons from past executions into new prompts. Per [[_meta/SELF-POLLINATION-FINDINGS]] §A, this pattern already exists in the old build's `Ema.Executions.Dispatcher` and is a TIER PORT item.
2. **AutonomousImprovementEngine** — generates proposals from detected gaps. "Gaps" means places where the system noticed it could have done better but didn't. Requires the feedback loop (sibling intents) to identify gaps in the first place.
3. **Evolution rules auto-applying with confidence threshold** — when the system is confident enough (threshold TBD), it applies its own improvements without human approval. When it's not, it queues them as proposals. The threshold is the safety knob.
4. **Weekly epistemic honesty audit** — runs weekly, checks whether the system's self-assessments match reality. "Did I claim I was confident about X and X turned out wrong?" Output is a report to the user, not an automated correction.

## Why this matters

This is the difference between EMA being **operationally efficient** (does what you tell it, with good observability) and **autonomous** (notices problems, proposes fixes, learns from mistakes without being told). The old build's author called it "the forgotten meta-loop" — the piece that was designed but never shipped because it depended on the feedback loop that also never shipped.

## Dependencies

**Blocked on:**
- [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] (the feedback loop must close first)
- [[intents/INT-NERVOUS-SYSTEM-WIRING]] (wire #1: Memory.store_entry must work)

**Referenced by:**
- Phase 2 intent queue (agent collaboration, knowledge compilation) — those feed the autonomy loop

## Gaps / open questions

- **Confidence threshold default.** No value proposed in the original. Needs a decision before shipping.
- **What counts as a "gap"?** The AutonomousImprovementEngine needs a gap-detection heuristic. Candidates: low scorer output on proposals, repeated failures in executions, contradictions in the intent graph, flagged sycophancy alerts.
- **Evolution rules engine.** Not specified in detail. May need its own spec.
- **Epistemic honesty audit scoring.** What does the audit measure exactly? Prediction accuracy? Calibration? Self-assessment alignment with outcomes?

## Related

- [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — the hard blocker
- [[intents/INT-NERVOUS-SYSTEM-WIRING]] — the four wires enabling the feedback loop
- [[_meta/SELF-POLLINATION-FINDINGS]] — ReflexionInjector already in TIER PORT

#intent #new-work #phase-3 #autonomous #reflexion #recovered #preliminary
