---
id: GAC-010
type: gac_card
layer: intents
title: "User state awareness — should EMA track distress / focus / energy state?"
status: answered
created: 2026-04-12
updated: 2026-04-12
answered_at: 2026-04-12
answered_by: recovery-wave-3
resolution: mode-enum-plus-7-signal-heuristic
author: research-round-1
category: gap
priority: medium
connections:
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
  - { target: "[[research/life-os-adhd/adrianwedd-ADHDo]]", relation: derived_from }
  - { target: "[[research/life-os-adhd/JackReis-neurodivergent-visual-org]]", relation: derived_from }
  - { target: "[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]", relation: derived_from }
---

# GAC-010 — User state awareness

## Question

Three independent ADHD-focused repos all surface user-state awareness as critical: ADHDo (DistressDetector), neurodivergent-visual-org (auto mode switch), Task-Anchor (drift score). **EMA has no user-state model.** Should we add one, and what does it track?

## Context

Round 1's life-os-adhd category surfaced a consistent gap:

- ADHDo's three-phase loop pauses at "Cognitive Processing → confidence gating before action" — needs user-state input
- neurodivergent-visual-org switches between ND mode (3-5 chunks, buffered times) and NT mode based on detected distress
- Task-Anchor scores drift in conversation (26 weighted signal phrases) and auto-parks off-topic ideas

EMA's proposal pipeline doesn't know if the user is in flow / distress / overwhelm / focus. It just dispatches.

## Options

- **[A] UserState schema with passive observation**: Schema tracks `mood, energy, focus_level, distress_score, last_assessed`. Observers update from text input (like Task-Anchor's drift detector). Proposals are gated against state.
  - **Implications:** Privacy concern — observing user text. Surfacing risk — false positives that nag the user. Real value when correct.
- **[B] Self-reported state**: Lightweight `ema state mood happy energy 3` CLI. User declares state, system respects it. No observation.
  - **Implications:** Less invasive. Requires user discipline. Doesn't capture fast state changes.
- **[C] Time-based heuristics only**: Pomodoro timer + calendar context = rough state model. "User is in focus block" → don't surface notifications.
  - **Implications:** No personal data observation. Coarse but reliable. Doesn't catch overwhelm or distress.
- **[D] Hybrid: passive observation in private, self-report optional**: Local LLM analyzes user text for state signals. State stays in local SQLite. User can override or disable. Drift detection is opt-in.
  - **Implications:** Best balance. **Recommended for ADHD-aware product.** Requires local LLM (which EMA already plans for).
- **[1] Defer**: Don't ship in v1. Add when ADHD use cases bite.
- **[2] Skip**: Productivity software without state awareness is fine.

## Recommendation

**[D]** with the schema field added now (so v2 doesn't require migration), but the actual observers ship in the Phase 5+ ADHD-feature wave. Privacy default: observation off, user opts in.

## What this changes

New schema: `UserState { actor_id, mood, energy, focus_level, distress_score, time_blocks, last_assessed }`. Actor schema gains a `current_state_id` reference. New canon doc `vapps/USER-STATE.md` describing the privacy posture.

## Connections

- `[[canon/specs/BLUEPRINT-PLANNER]]`
- `[[research/life-os-adhd/adrianwedd-ADHDo]]`
- `[[research/life-os-adhd/JackReis-neurodivergent-visual-org]]`
- `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]`

## Resolution (2026-04-12)

**Answer: [D] User-state schema shipped now, passive observation deferred to a v2 opt-in.**

Shipped in `services/core/user-state/` during Recovery Wave 3. The `shared/schemas/user-state.ts` runtime schema tracks:

```
mode:                 'focused' | 'scattered' | 'resting' | 'crisis' | 'unknown'
focus_score:          0..1 (optional)
energy_score:         0..1 (optional)
drift_score:          0..1 (Task-Anchor pattern)
distress_flag:        boolean (binary escalation signal)
current_intent_slug:  string | null
updated_at, updated_by
```

Cold boot default: `{ mode: 'unknown', distress_flag: false, updated_by: 'self' }` — not zeros, explicit "unknown".

**Heuristic shipped** (`services/core/user-state/heuristics.ts`, 7 rules):

1. `≥3 agent_blocked in 5 min → crisis + distress_flag: true`
2. `self_report_overwhelm → crisis + distress`
3. `self_report_flow → focused + distress cleared`
4. `agent_recovered → scattered + distress cleared`
5. `drift_detected → scattered, drift_score = min(1, count/3)` (drift alone does NOT raise distress — user stays sovereign)
6. `idle_timeout → resting`
7. `task_completed → focused + drift_score=0` (unless in distress)

All thresholds exported as constants for future tuning. Signal history stored as a 500-entry ring buffer, queryable at `/api/user-state/history`.

**Privacy posture:** state is self-reported or agent-emitted explicitly. No passive text scanning yet. The privacy concern raised in the Options section is addressed by making observation an opt-in feature of future heuristic expansion (v2).

**Service proof of life:** `GET /api/user-state/current` returns the singleton state. 9/9 tests passing. Events: `user_state:changed`, `user_state:distress_raised`, `user_state:distress_cleared`.

**Canon follow-up:** `vapps/CATALOG.md` needs an entry for the UserState observer vApp (deferred to Phase 5+). `canon/specs/BLUEPRINT-PLANNER.md` may want to reference the drift_score field.

#gac #gap #priority-medium #user-state #adhd-aware #answered #recovery-wave-3
