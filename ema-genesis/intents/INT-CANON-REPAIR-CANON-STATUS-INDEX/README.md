---
id: INT-CANON-REPAIR-CANON-STATUS-INDEX
type: intent
layer: intents
title: "Canon repair — update _meta/CANON-STATUS.md index to list all canon specs and decisions added during 2026-04-12 recovery pass"
status: active
kind: canon-repair
phase: awaiting-approval
priority: medium
created: 2026-04-12
updated: 2026-04-12
author: canon-repair-pass
connections:
  - { target: "[[_meta/CANON-STATUS]]", relation: modifies }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
exit_condition: "_meta/CANON-STATUS.md includes every file in canon/specs/ and canon/decisions/ that exists as of 2026-04-12. Each entry has a status field and a 1-line summary. A dedicated 'Preliminary additions 2026-04-12' section documents the recovery operation and links the new files."
---

# INT-CANON-REPAIR-CANON-STATUS-INDEX

## The problem

`_meta/CANON-STATUS.md` was written 2026-04-12 as the ruling on canon precedence. Its current table lists only the **original** canon specs and decisions: `EMA-V1-SPEC`, `AGENT-RUNTIME`, `BLUEPRINT-PLANNER`, plus the DEC-001..003 decisions that existed at the time.

Since that ruling was issued, two waves of additions have happened the same day:

1. **The canon-id-collision fix (EXE-002)** — introduced DEC-007 and DEC-008 via rename from DEC-004/DEC-005 recovery additions.
2. **The recovery pass** — added 9 new canon specs: `EMA-CORE-PROMPT`, `agents/_MOC`, `agents/AGENT-ARCHIVIST`, `agents/AGENT-STRATEGIST`, `agents/AGENT-COACH`, `BABYSITTER-SYSTEM`, `PROPOSAL-TEMPLATES`, `PROPOSAL-QUALITY-GATE`, `PIPES-SYSTEM`, `ACTOR-WORKSPACE-SYSTEM`, `EXECUTION-SYSTEM`. All `status: preliminary`.

None of these are in the CANON-STATUS index. A new agent reading the index thinks the canon graph is smaller than it actually is. Discoverability is broken.

## Proposed fix

Two edits to `_meta/CANON-STATUS.md`:

### Edit 1: Append rows to the existing "What This Changes" table

For every new canon spec and decision, add a row with:
- File reference
- Status (active / preliminary)
- One-line summary

### Edit 2: Add a new section

```markdown
## Preliminary Additions 2026-04-12

Two waves of additions landed on 2026-04-12:

### Wave A — Recovery pass (canon specs)
Recovered from the old Elixir build, status: preliminary throughout:

- `canon/specs/EMA-CORE-PROMPT` — the "soul" system prompt
- `canon/specs/agents/_MOC` — agent prompt index
- `canon/specs/agents/AGENT-ARCHIVIST` — knowledge consolidation role
- `canon/specs/agents/AGENT-STRATEGIST` — goal decomposition role
- `canon/specs/agents/AGENT-COACH` — reflective practice role
- `canon/specs/BABYSITTER-SYSTEM` — 7-lane observability
- `canon/specs/PROPOSAL-TEMPLATES` — 5-template seed library
- `canon/specs/PROPOSAL-QUALITY-GATE` — preflight 100-point rubric
- `canon/specs/PIPES-SYSTEM` — 22 triggers + 15 actions + 5 transforms
- `canon/specs/ACTOR-WORKSPACE-SYSTEM` — 5-phase cadence + EntityData + tags
- `canon/specs/EXECUTION-SYSTEM` — 15-field execution schema + Dispatcher + IntentFolder

### Wave B — ID collision fix (EXE-002)
- `canon/decisions/DEC-007-unified-intents-schema` (renamed from DEC-004)
- `canon/decisions/DEC-008-daily-validation-ritual` (renamed from DEC-005)

See [[executions/EXE-002-canon-id-collisions]] for the rename rationale and the original DEC-004-gac-card-backend / DEC-005-actor-phases decisions that kept the older IDs.

### Trust tier for these additions

All Wave A entries are `status: preliminary` per the recovery pass governance. They can be upgraded to `active` per the [[_meta/DOC-TRUST-HIERARCHY]] upgrade rule once they've been referenced by at least 3 other canon nodes without contradictions.

Wave B entries preserve their original content (which was status: preliminary) and only changed IDs.
```

## Non-goals

- Don't change the ruling itself (the "Q1 = B, Genesis wins" declaration stays verbatim).
- Don't re-evaluate whether any of the new entries should be `status: active` instead of `preliminary`. That's a separate per-file decision (see [[intents/INT-CANON-REPAIR-DEC-007-STATUS-UPGRADE]] for the one case where an upgrade is justified now).
- Don't touch the research/ or intents/ layers. CANON-STATUS is about canon/ plus top-level docs only.

## Scope interpretation

`_meta/CANON-STATUS.md` is in `_meta/` (not under `canon/`), so under the strict interpretation it's **editable directly without an intent**. I'm routing this through an intent anyway because:

1. CANON-STATUS is the authoritative ruling doc — editing it touches governance even if it's not canon-locked.
2. Consistency — the repair pass's other _meta edits (e.g., STACK-SUMMARY migration count fix) are trivial one-liners. This is a larger structural edit and deserves the same rigor as canon edits.
3. An intent card creates a reviewable audit trail.

User can override with an "approve without intent flow" signal.

## Verification

```bash
# After fix:
grep -c "Preliminary Additions 2026-04-12" ema-genesis/_meta/CANON-STATUS.md
# Expected: 1

# Every canon spec file should be referenced by the index:
for f in ema-genesis/canon/specs/*.md ema-genesis/canon/specs/agents/*.md; do
  name=$(basename "$f" .md)
  grep -q "$name" ema-genesis/_meta/CANON-STATUS.md || echo "MISSING: $name"
done
# Expected: zero "MISSING" lines
```

## Related

- [[_meta/CANON-STATUS]] — target
- [[_meta/SELF-POLLINATION-FINDINGS]] — source of Wave A additions
- [[executions/EXE-002-canon-id-collisions]] — source of Wave B additions
- [[_meta/DOC-TRUST-HIERARCHY]] — upgrade rule
- Audit findings: general discoverability

#intent #canon-repair #canon-status #discoverability
