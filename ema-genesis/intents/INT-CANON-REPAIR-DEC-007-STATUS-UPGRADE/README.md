---
id: INT-CANON-REPAIR-DEC-007-STATUS-UPGRADE
type: intent
layer: intents
title: "Canon repair — upgrade DEC-007-unified-intents-schema status from preliminary to active (referenced as foundational throughout canon)"
status: active
kind: canon-repair
phase: awaiting-approval
priority: medium
created: 2026-04-12
updated: 2026-04-12
author: canon-repair-pass
connections:
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: modifies }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
exit_condition: "DEC-007-unified-intents-schema.md frontmatter status changes from `preliminary` to `active`. The decision is already referenced as foundational by at least 4 other canon nodes without contradictions being raised — per the doc trust hierarchy rules, that's sufficient to upgrade from preliminary to active."
---

# INT-CANON-REPAIR-DEC-007-STATUS-UPGRADE

## The problem

Audit finding **S.06**: `DEC-007-unified-intents-schema.md` (originally `DEC-004-unified-intents-schema.md` before the EXE-002 rename) has `status: preliminary` in its frontmatter, but it's referenced as foundational throughout the canon graph:

- `_meta/SELF-POLLINATION-FINDINGS.md` §A TIER PORT priority #1 treats the unified intents schema as canon
- `canon/specs/EMA-V1-SPEC.md` §3 / §5 implicitly relies on the Three Truths model (Semantic / Operational / Knowledge) that this decision formalizes
- The recovered intents [[intents/INT-FEEDBACK-LOOP-INTEGRATION]], [[intents/INT-NERVOUS-SYSTEM-WIRING]], [[intents/INT-INTENTIONS-SCHEMATIC-ENGINE]] all reference it as their data-model foundation
- [[canon/specs/EXECUTION-SYSTEM]] depends on the Three Truths Operational domain

The decision is **operationally locked** — multiple downstream nodes treat it as canonical and build on top of it. The `preliminary` marker is a historical artifact of being recovered from the old wiki rather than authored fresh in genesis. Per the [[_meta/DOC-TRUST-HIERARCHY]] upgrade rule, a preliminary doc can be upgraded to active when it has been referenced by at least 3 other canon nodes without contradictions being raised. This one has been referenced by at least 4, with no contradictions. It qualifies.

## Proposed fix

In `canon/decisions/DEC-007-unified-intents-schema.md` frontmatter:

```diff
- status: preliminary
+ status: active
+ upgraded_at: 2026-04-12
+ upgraded_reason: "Referenced as foundational by EMA-V1-SPEC, SELF-POLLINATION, EXECUTION-SYSTEM, and 3+ recovered intents without contradictions. Meets DOC-TRUST-HIERARCHY upgrade threshold."
```

No other changes. Content, connections, tags, and `renumbered_from` metadata all stay as-is.

## Why not bundle with INT-CANON-REPAIR-IMPLEMENTATION-STATUS

The implementation-status intent adds a field to decisions that are `status: active` but unimplemented. This intent upgrades a decision from `preliminary` to `active`. They're different axes. Bundling would muddle the commit record.

## Verification

```bash
# After fix:
grep "status: active" ema-genesis/canon/decisions/DEC-007-unified-intents-schema.md
# Expected: at least one match

grep "upgraded_at" ema-genesis/canon/decisions/DEC-007-unified-intents-schema.md
# Expected: one match with 2026-04-12
```

## Rollback

If new information later contradicts the decision, demote back to `preliminary` with a `demoted_at` timestamp and a reason. Do not delete.

## Related

- [[canon/decisions/DEC-007-unified-intents-schema]] — target
- [[_meta/DOC-TRUST-HIERARCHY]] — upgrade rule
- [[_meta/SELF-POLLINATION-FINDINGS]] — references as foundational
- Audit finding S.06

#intent #canon-repair #status-upgrade #dec-007
