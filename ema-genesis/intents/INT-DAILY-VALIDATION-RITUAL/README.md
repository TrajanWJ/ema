---
id: INT-DAILY-VALIDATION-RITUAL
type: intent
layer: intents
title: "Daily 5-minute ritual — validate the system by using it consistently for 30 days"
status: preliminary
kind: process
phase: discover
priority: high
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/calendar-april-2026-this-week-daily-5-minute-ritual-mo/"
recovered_at: 2026-04-12
original_author: human
exit_condition: "30 consecutive days of: morning ema briefing + ema now + 1-2 brain dumps during day + evening proposal triage. At day 30, system is either validated (works as intended) or the failing seams are concretely identified. Either way, the ritual itself is the validation."
connections:
  - { target: "[[intents/INT-FEEDBACK-LOOP-INTEGRATION]]", relation: validates }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
tags: [intent, process, ritual, validation, dogfooding, recovered, preliminary]
---

# INT-DAILY-VALIDATION-RITUAL

## Original intent text (verbatim)

> CALENDAR (April 2026 - this week): Daily 5-minute ritual: morning ema briefing + ema now + brain dump 1-2 thoughts during day + evening proposal triage. The system MUST be used to learn what's working. 30 days of consistent use validates the entire architecture or reveals what's actually missing.

## The ritual (4 touchpoints per day)

1. **Morning: `ema briefing`** — opens the day with a briefing view. Shows yesterday's outcomes, today's priorities, any pending approvals.
2. **Morning: `ema now`** — quick "what should I be doing right now" command. Pulls the top-priority item from the system (matches the One Thing card pattern in [[research/frontend-patterns/launchpad-one-thing-card]]).
3. **During day: `ema dump "thought"`** — 1–2 brain dumps. Low-friction capture. Turns into proposal seeds downstream.
4. **Evening: proposal triage** — review the day's queued proposals, approve / reject / defer.

Total time budget: **5 minutes/day**.

## Why this is an intent (not just a habit)

This is a **validation protocol**, not a feature. The old build's author recognized that after shipping all the supervised processes and pipelines, the system still needed **proof it worked**. Usage is the only proof. 30 days of consistent use either validates the architecture or surfaces the broken seams.

The ritual is structured enough that it's reproducible (4 touchpoints, fixed times, bounded duration) and light enough that it's sustainable. This is deliberate design, not just "use the system more."

## Why this is preliminary status but high priority

- **Preliminary** because the old build had this as a calendar intent for April 2026, but the original system has been shut down. Recovering the ritual doesn't automatically resurrect it.
- **High priority** because the new Electron build will face the same "does this thing actually work" question, and the ritual is the answer. Ship this protocol alongside v1 and start the 30-day clock.

## Gaps / open questions

- **Which surface runs the ritual?** CLI only (per the original text)? Or does the Electron shell also need briefing/now screens?
- **Persistence of the 30-day clock.** Where does the system track "day 12 of 30"? Memory? A dedicated validation log?
- **What counts as a "failing seam"?** Missed days? Low proposal quality? User skipping triage? Needs an explicit signal list.
- **Relation to the feedback loop.** The ritual **exercises** the feedback loop (dump → proposal → triage → approve → execute → outcome → next-day-briefing). So it's both validation and operational use.

## Related

- [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — the ritual is the end-to-end user path that closes the loop
- [[canon/specs/EMA-V1-SPEC]] — v1 scope
- [[research/frontend-patterns/launchpad-one-thing-card]] — `ema now` is the CLI twin of the One Thing card

#intent #process #ritual #validation #dogfooding #recovered #preliminary
