---
id: INT-CANON-REPAIR-CROSSREF-AFTER-EXE-002
type: intent
layer: intents
title: "Canon repair — update stale [[DEC-004-unified-intents-schema]] crossrefs in EXECUTION-SYSTEM.md and PIPES-SYSTEM.md after EXE-002 rename"
status: active
kind: canon-repair
phase: awaiting-approval
priority: high
created: 2026-04-12
updated: 2026-04-12
author: canon-repair-pass
connections:
  - { target: "[[executions/EXE-002-canon-id-collisions]]", relation: follows }
  - { target: "[[canon/specs/EXECUTION-SYSTEM]]", relation: modifies }
  - { target: "[[canon/specs/PIPES-SYSTEM]]", relation: modifies }
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: references }
exit_condition: "Both canon specs have zero remaining references to [[canon/decisions/DEC-004-unified-intents-schema]]. All such references point at [[canon/decisions/DEC-007-unified-intents-schema]] instead. Frontmatter `connections:` and body wikilinks both updated."
---

# INT-CANON-REPAIR-CROSSREF-AFTER-EXE-002

## The problem

[[executions/EXE-002-canon-id-collisions]] renamed `DEC-004-unified-intents-schema.md` → `DEC-007-unified-intents-schema.md` (and similarly for DEC-005 → DEC-008) to resolve the ID collision with the pre-existing `DEC-004-gac-card-backend.md`. The rename updated the renamed files' own frontmatter but did not cascade to every file that references them.

Two **canon specs** still contain stale wikilinks to the old name:

1. `canon/specs/EXECUTION-SYSTEM.md`
2. `canon/specs/PIPES-SYSTEM.md`

Both are `status: preliminary` canon I wrote during the recovery pass today. Under the governance rule (canon changes require intent + proposal/execution flow), these edits need this intent to exist before they can land.

Non-canon files with the same stale references (`intents/INT-*`, `_meta/*`) have already been fixed directly during the canon-repair pass because they fall outside canon scope.

## Proposed fix

In both canon specs, replace every occurrence of `DEC-004-unified-intents-schema` with `DEC-007-unified-intents-schema`. This includes:

- `connections:` block in frontmatter
- Body wikilinks (including section headers if referenced)
- `## Related` section references

No other edits. Content, semantics, and status of the specs stay untouched.

## Verification

```bash
grep -r "DEC-004-unified-intents-schema" ema-genesis/canon/specs/
# Expected: zero results after fix
```

## Why this is a canon-repair intent and not just an edit

The governance rule set by the user forbids direct edits to anything under `ema-genesis/canon/`. Even a mechanical name replacement counts as a canon change and must be logged as an intent first. Once this intent is approved (or an execution signal is given), the edits can land via a paired `executions/EXE-CANON-REPAIR-CROSSREF-AFTER-EXE-002/` record.

## Blockers

None. EXE-002 is already complete. This intent is a trailing cleanup.

## Related

- [[executions/EXE-002-canon-id-collisions]] — the rename that created the need
- [[canon/decisions/DEC-007-unified-intents-schema]] — the renamed target
- [[canon/specs/EXECUTION-SYSTEM]] — affected file
- [[canon/specs/PIPES-SYSTEM]] — affected file

#intent #canon-repair #crossref #cleanup
