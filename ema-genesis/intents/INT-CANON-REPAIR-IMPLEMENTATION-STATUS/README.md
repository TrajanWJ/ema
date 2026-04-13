---
id: INT-CANON-REPAIR-IMPLEMENTATION-STATUS
type: intent
layer: intents
title: "Canon repair — add implementation_status field to DEC-004-gac-card-backend and DEC-005-actor-phases to reflect zero-implementation reality"
status: active
kind: canon-repair
phase: awaiting-approval
priority: critical
created: 2026-04-12
updated: 2026-04-12
author: canon-repair-pass
connections:
  - { target: "[[canon/decisions/DEC-004-gac-card-backend]]", relation: modifies }
  - { target: "[[canon/decisions/DEC-005-actor-phases]]", relation: modifies }
  - { target: "[[intents/INT-RECOVERY-WAVE-1]]", relation: references }
  - { target: "[[_meta/BLUEPRINT-REALITY-DISCREPANCIES]]", relation: references }
exit_condition: "Both DEC-004-gac-card-backend.md and DEC-005-actor-phases.md have a new frontmatter field `implementation_status: pending` with a pointer to INT-RECOVERY-WAVE-1 Stream 3 as the tracking intent. The decisions remain status: active (not demoted). Any downstream consumer can now tell from the frontmatter that the decision is architecturally locked but implementation has not landed yet."
---

# INT-CANON-REPAIR-IMPLEMENTATION-STATUS

## The problem

Audit findings **C.08** and **C.09** flag a **critical dishonesty** in two locked canon decisions:

- `canon/decisions/DEC-004-gac-card-backend.md` — `status: active` (locked). Demands: Zod schema + Drizzle table + state machine + HTTP routes + MCP tools + two-layer filesystem (`.superman/gac/`). **Reality: zero implementation.** `services/core/blueprint/` does not exist. No `gac-card.ts` schema. Tracked in `_meta/BLUEPRINT-REALITY-DISCREPANCIES.md` §"DEC-004 Literal zero implementation."
- `canon/decisions/DEC-005-actor-phases.md` — `status: active` (locked). Demands: 7-state phase machine + EntityData composite key + PhaseTransition append-only log. **Reality: zero implementation.** No `shared/schemas/actor-phase.ts`. No `phase_transitions` table. `services/core/actors/` is an empty dir.

The `status: active` field on both decisions is a **promise the codebase hasn't kept**. An agent reading these decisions thinks "this is done" when it's "this is locked as canon but not yet built." That gap is a bug in the canonical state of record.

Both decisions are blockers for `INT-RECOVERY-WAVE-1` Stream 3 per `BLUEPRINT-REALITY-DISCREPANCIES.md`.

## Proposed fix

Add a new frontmatter field `implementation_status` to both files. Value: `pending`. Point at the tracking intent.

### DEC-004-gac-card-backend.md — frontmatter addition

```yaml
implementation_status: pending
implementation_tracked_by: "[[intents/INT-RECOVERY-WAVE-1]] Stream 3"
implementation_target_paths:
  - "services/core/blueprint/"
  - "shared/schemas/gac-card.ts"
```

### DEC-005-actor-phases.md — frontmatter addition

```yaml
implementation_status: pending
implementation_tracked_by: "[[intents/INT-RECOVERY-WAVE-1]] Stream 3"
implementation_target_paths:
  - "shared/schemas/actor-phase.ts"
  - "services/core/actors/"
  - "phase_transitions table in shared/schemas/"
```

**No other edits to either file.** The decision content, rationale, and `status: active` stay exactly as-is. Only the frontmatter gains three new fields that make the gap between "locked decision" and "landed implementation" machine-readable.

## Why `implementation_status` instead of demoting status to preliminary

The audit agent suggested two alternatives: (a) add `implementation_status: pending` or (b) demote `status` from `active` to `preliminary`. This intent takes option (a) for these reasons:

1. **The decisions are architecturally correct.** `status: active` means "this architecture is locked, don't debate it, go build it." Demoting to `preliminary` would wrongly suggest the architecture is still in flux. It isn't.
2. **`implementation_status` is a separate axis.** Decision quality (locked vs preliminary) and build status (built vs pending vs partial) are orthogonal. The frontmatter should reflect both independently.
3. **Precedent for extension.** Other decisions may benefit from the same field. Adding it now establishes the pattern.
4. **Non-breaking.** Consumers that ignore the field see no change. Consumers that read it get the honest state.

If the user prefers option (b) — demote to preliminary — this intent's approval signal should say so and the executor will do that instead.

## Verification

```bash
# After fix:
grep -c "implementation_status" ema-genesis/canon/decisions/DEC-004-gac-card-backend.md
grep -c "implementation_status" ema-genesis/canon/decisions/DEC-005-actor-phases.md
# Expected: each returns ≥1
```

## Non-goals

- Don't fix the **underlying reality gap.** That's `INT-RECOVERY-WAVE-1` Stream 3's job. This intent only makes the gap visible in the canon record.
- Don't touch any other locked decision. DEC-001, DEC-002, DEC-003, DEC-006 all have different states and should be evaluated separately if needed.
- Don't touch `DEC-007-unified-intents-schema` or `DEC-008-daily-validation-ritual` — those are `status: preliminary`, the gap is already visible, no fix needed.

## Related

- [[canon/decisions/DEC-004-gac-card-backend]]
- [[canon/decisions/DEC-005-actor-phases]]
- [[intents/INT-RECOVERY-WAVE-1]] — Stream 3 is the tracking intent
- [[_meta/BLUEPRINT-REALITY-DISCREPANCIES]] — the reality audit that surfaced the gap
- Audit findings C.08, C.09

#intent #canon-repair #implementation-status #honesty
