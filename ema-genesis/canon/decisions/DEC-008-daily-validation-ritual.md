---
id: DEC-008
type: canon
subtype: decision
layer: canon
title: "Daily 5-minute ritual as the canonical v1 validation protocol"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
decided_at: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/calendar-april-2026-this-week-daily-5-minute-ritual-mo/"
recovered_at: 2026-04-12
decided_by: human
renumbered_from: DEC-005
renumbered_at: 2026-04-12
renumbered_reason: "ID collision with DEC-005-actor-phases. This decision keeps its content verbatim; only the identifier moved."
connections:
  - { target: "[[intents/INT-DAILY-VALIDATION-RITUAL]]", relation: implements }
  - { target: "[[intents/INT-FEEDBACK-LOOP-INTEGRATION]]", relation: validates }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/decisions/DEC-005-actor-phases]]", relation: related }
tags: [decision, canon, validation, ritual, v1-scope, recovered, preliminary]
---

# DEC-008 — Daily Validation Ritual

> **Status:** Preliminary. The ritual is how v1 proves itself. 30 days of consistent use is the acceptance criterion. Intent is captured in [[intents/INT-DAILY-VALIDATION-RITUAL]]; this decision ratifies the ritual as **the canonical v1 validation protocol** rather than an optional practice. **Renumbered from DEC-005 on 2026-04-12** to resolve a same-session ID collision with `DEC-005-actor-phases.md`.

## The Decision

EMA v1 ships with an **explicit 5-minute daily ritual as its acceptance criterion**, not a feature checklist.

The ritual (4 touchpoints per day, ~5 minutes total):

1. **Morning: `ema briefing`** — day's priorities + yesterday's outcomes + pending approvals
2. **Morning: `ema now`** — top-priority item right now (CLI twin of the Launchpad One Thing card)
3. **During day: 1–2 `ema dump "..."`** — low-friction brain dumps
4. **Evening: proposal triage** — approve / reject / defer the day's queued proposals

**v1 is considered validated when the user has used the ritual for 30 consecutive days.** Anything short of that is a system that shipped but was never proven to work in practice.

## Why ratify this as a decision

The 2026-04-06 era of the old build shipped many features without daily validation, and the feedback loops never actually closed (see [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — "the gap is NOT features — it's WIRING"). The ritual is the forcing function that keeps the rebuild from repeating that pattern.

This is a decision rather than just an intent because it **redefines what "done" means**. Without it, the rebuild's v1 exit criteria are "all the features work." With it, the criteria are "the system has been used for 30 days and the feedback loop observably closed." Those are different finish lines.

## Scope commitments this decision implies

- **CLI surface must be usable day-1.** `ema briefing`, `ema now`, `ema dump`, `ema proposal triage` must all work. Electron shell is optional for the ritual; CLI is not.
- **The feedback loop must close.** You can't validate a broken loop. DEC-008 depends on [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] and [[intents/INT-NERVOUS-SYSTEM-WIRING]] landing before the clock starts.
- **Triage UX must be low-friction.** Evening triage is the most-likely-to-be-skipped touchpoint. UX must make it fast enough that friction never exceeds the 5-minute budget.
- **Briefing must be useful, not theater.** If the morning briefing is empty / generic / not actionable, the ritual dies on day 3. Briefing quality is a load-bearing feature.

## Measurement

- **Day counter** persisted somewhere (likely a `validation_log` table or dedicated Memory namespace)
- **Touchpoint completion** — did all 4 touchpoints happen today? Tracked, not enforced.
- **Streak metric** — consecutive days of all 4 touchpoints completed
- **Exit event** — when the 30-day mark is hit, emit a "v1 validated" event. The event can be audited later.

## Failure modes to watch for

- **Gaming the ritual.** Running the commands without engaging won't validate anything. The metric should be "did you make decisions" not "did you type the commands."
- **Ritual burnout.** 30 days is long. The user may need a "pause and resume" affordance rather than "start over from day 1."
- **Touchpoint bloat.** The ritual is 5 minutes by design. Every "just one more thing" request should be rejected at the ritual level; it can become a vApp instead.

## Gaps / open questions

- **What triggers the 30-day clock to start?** Manual command (`ema validation start`)? Auto-start on v1 ship? Auto-start on first feedback loop closure?
- **What counts as a valid day?** 4/4 touchpoints? 3/4? Does the user need to approve or can skipping count?
- **Pause semantics.** If the user pauses for a weekend, does that reset the streak or freeze it?
- **Multi-device.** If the ritual commands run on different machines via P2P, how is the day counter consolidated? (Deferred — v1 is single-machine per [[_meta/INFRASTRUCTURE-STATUS]].)

## Related

- [[intents/INT-DAILY-VALIDATION-RITUAL]] — the intent this decision ratifies
- [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — must land before the 30-day clock can start
- [[intents/INT-NERVOUS-SYSTEM-WIRING]] — same
- [[canon/specs/EMA-V1-SPEC]] — v1 scope
- [[canon/decisions/DEC-005-actor-phases]] — the decision that kept the DEC-005 ID
- [[research/frontend-patterns/launchpad-one-thing-card]] — the Electron surface twin of `ema now`

#decision #canon #validation #ritual #v1-scope #recovered #preliminary
