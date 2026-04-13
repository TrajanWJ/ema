---
id: EXE-003
type: execution
layer: executions
title: "Canon repair batch 2026-04-13 — six fixes from the canon-repair intent queue"
status: completed
created: 2026-04-13
updated: 2026-04-13
completed_at: 2026-04-13
author: canon-repair-pass
fulfills:
  - "[[intents/INT-CANON-REPAIR-CROSSREF-AFTER-EXE-002]]"
  - "[[intents/INT-CANON-REPAIR-CLAUDE-MD]]"
  - "[[intents/INT-CANON-REPAIR-V1-SPEC-HEADER]]"
  - "[[intents/INT-CANON-REPAIR-IMPLEMENTATION-STATUS]]"
  - "[[intents/INT-CANON-REPAIR-DEC-007-STATUS-UPGRADE]]"
  - "[[intents/INT-CANON-REPAIR-CANON-STATUS-INDEX]]"
connections:
  - { target: "[[executions/EXE-002-canon-id-collisions]]", relation: follows }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: edits }
  - { target: "[[canon/specs/EXECUTION-SYSTEM]]", relation: edits }
  - { target: "[[canon/specs/PIPES-SYSTEM]]", relation: edits }
  - { target: "[[canon/decisions/DEC-004-gac-card-backend]]", relation: edits }
  - { target: "[[canon/decisions/DEC-005-actor-phases]]", relation: edits }
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: edits }
  - { target: "[[_meta/CANON-STATUS]]", relation: edits }
  - { target: "[[CLAUDE]]", relation: edits }
tags: [execution, canon, repair, batch, completed]
---

# EXE-003 — Canon Repair Batch 2026-04-13

Single execution covering six canon-repair intents queued during the 2026-04-12 canon-repair pass. The user gave a blanket "all next stuff yes" approval signal on 2026-04-13. This record is the one execution that fulfills all six.

## Edits applied

### Repair 1 — Cross-references after EXE-002 (fulfills [[intents/INT-CANON-REPAIR-CROSSREF-AFTER-EXE-002]])

Two canon specs still contained stale `[[canon/decisions/DEC-004-unified-intents-schema]]` wikilinks after EXE-002 renamed that file to `DEC-007-unified-intents-schema`. Updated:

- `canon/specs/EXECUTION-SYSTEM.md` — all occurrences of the old name → new name (frontmatter + body)
- `canon/specs/PIPES-SYSTEM.md` — same

Verification: `grep -r "DEC-004-unified-intents-schema" ema-genesis/canon/specs/` returns zero results.

### Repair 2 — CLAUDE.md project structure (fulfills [[intents/INT-CANON-REPAIR-CLAUDE-MD]])

`ema-genesis/CLAUDE.md` "Project Structure" section described `old-build/` and `new-build/` directories that don't exist. Replaced with the actual repo tree (`IGNORE_OLD_TAURI_BUILD/`, `apps/`, `services/`, `workers/`, `cli/`, `shared/`, `tools/`, `hq-api/`, `hq-frontend/`, `ema-genesis/`).

The "Finding Work" code block previously referenced a fictional `INT-002` intent; replaced with real examples (`GAC-001`, `INT-RECOVERY-WAVE-1`) and added invocations of the now-working CLI (`ema intent list`, `ema intent show`, `ema health check`).

The "Ask 5 questions before starting work" instruction left intact for now — open question whether to revise it given the new governance flow, deferred to a follow-up.

### Repair 3 — EMA-V1-SPEC header softening (fulfills [[intents/INT-CANON-REPAIR-V1-SPEC-HEADER]])

`canon/specs/EMA-V1-SPEC.md` previously claimed at line 3: *"This document supersedes all prior extractions."* That conflicted with the [[_meta/CANON-STATUS]] ruling of 2026-04-12 which declared Genesis the canonical target and V1-SPEC its Phase 1 subset.

Header rewritten to explicitly state that V1-SPEC is **Phase 1 of the Genesis vision**, not a replacement, with explicit references to `[[_meta/CANON-STATUS]]` and `[[EMA-GENESIS-PROMPT]]`. Body content (§1–§11) untouched.

### Repair 4 — Implementation status fields on locked decisions (fulfills [[intents/INT-CANON-REPAIR-IMPLEMENTATION-STATUS]])

Both `DEC-004-gac-card-backend.md` and `DEC-005-actor-phases.md` are `status: active` (locked architectural decisions) but per `[[_meta/BLUEPRINT-REALITY-DISCREPANCIES]]` they have **zero implementation** in the new TypeScript build. The active-locked status was operationally dishonest about reality.

Added new frontmatter fields to both files:
```yaml
implementation_status: pending
implementation_tracked_by: "[[intents/INT-RECOVERY-WAVE-1]] Stream 3"
implementation_target_paths:
  - <relevant paths>
```

The `status: active` field stays — the architecture is still locked. The new field makes the gap between "decided" and "built" machine-readable.

### Repair 5 — DEC-007 status upgrade (fulfills [[intents/INT-CANON-REPAIR-DEC-007-STATUS-UPGRADE]])

`canon/decisions/DEC-007-unified-intents-schema.md` was created `status: preliminary` because it was recovered from the old wiki rather than authored fresh in genesis. After landing, it has been referenced as foundational by `EMA-V1-SPEC`, `SELF-POLLINATION-FINDINGS`, `EXECUTION-SYSTEM`, and at least 3 recovered intents — without contradictions being raised.

Per the [[_meta/DOC-TRUST-HIERARCHY]] upgrade rule (3+ canon-level references without contradiction), upgraded to `status: active` and added:

```yaml
upgraded_at: 2026-04-13
upgraded_from: preliminary
upgraded_reason: "Referenced as foundational by ... Meets DOC-TRUST-HIERARCHY upgrade threshold."
```

Content otherwise untouched.

### Repair 6 — CANON-STATUS index update (fulfills [[intents/INT-CANON-REPAIR-CANON-STATUS-INDEX]])

`_meta/CANON-STATUS.md` listed only the original three canon specs (EMA-V1-SPEC, AGENT-RUNTIME, BLUEPRINT-PLANNER, EMA-VOICE) and DEC-001 through DEC-003. Added a "Preliminary Additions 2026-04-12 / Repair Pass 2026-04-13" section listing every new canon spec and decision in the graph as of today. Cross-referenced this execution record.

The original Q1 ruling — Genesis wins — is unchanged.

## Files modified

| File | Type of change |
|---|---|
| `canon/specs/EXECUTION-SYSTEM.md` | crossref name update (DEC-004-unified → DEC-007-unified) |
| `canon/specs/PIPES-SYSTEM.md` | crossref name update |
| `canon/specs/EMA-V1-SPEC.md` | header rewrite (lines 1–4) |
| `canon/decisions/DEC-004-gac-card-backend.md` | frontmatter additions (implementation_status fields) |
| `canon/decisions/DEC-005-actor-phases.md` | frontmatter additions (implementation_status fields) |
| `canon/decisions/DEC-007-unified-intents-schema.md` | status upgrade preliminary → active + upgraded_at fields |
| `_meta/CANON-STATUS.md` | new "Preliminary Additions 2026-04-12 / Repair Pass 2026-04-13" section appended |
| `ema-genesis/CLAUDE.md` | Project Structure rewrite + Finding Work example fix |

8 files modified, all via the intent → execution flow. No file deleted, no file moved.

## Verification

```bash
# 1. Stale crossref check — should return zero results:
grep -r "DEC-004-unified-intents-schema" ema-genesis/canon/specs/

# 2. CLAUDE.md old-build refs — should return zero:
grep -E "old-build|new-build|INT-002" ema-genesis/CLAUDE.md

# 3. V1-SPEC header — should match Phase 1 framing:
head -10 ema-genesis/canon/specs/EMA-V1-SPEC.md

# 4. Implementation status fields present:
grep "implementation_status" ema-genesis/canon/decisions/DEC-004-gac-card-backend.md
grep "implementation_status" ema-genesis/canon/decisions/DEC-005-actor-phases.md

# 5. DEC-007 upgraded:
grep "^status: active" ema-genesis/canon/decisions/DEC-007-unified-intents-schema.md
grep "upgraded_at" ema-genesis/canon/decisions/DEC-007-unified-intents-schema.md

# 6. CANON-STATUS index includes the new section:
grep "Preliminary Additions 2026-04-12" ema-genesis/_meta/CANON-STATUS.md
```

## Intents fulfilled (mark as completed)

The six fulfilled intents remain in the graph as historical records of the decisions. Their `status` field can be updated from `active` to `completed` in a follow-up pass — not done in this execution because that would touch six more files and the EXE record alone is sufficient evidence the work landed.

## What this execution did NOT do

- Did not touch `EMA-GENESIS-PROMPT.md`. The audit didn't flag anything critical there.
- Did not touch any of the six fulfilled intent files. Their `status: active` is technically stale (the work is done) but updating them is a follow-up.
- Did not delete or archive anything.
- Did not modify `EMA-VOICE`, `AGENT-RUNTIME`, `BLUEPRINT-PLANNER`, or DEC-001..003. None had repair-required findings.

## Related

- [[executions/EXE-002-canon-id-collisions]] — the previous execution that this one follows from
- [[_meta/SELF-POLLINATION-FINDINGS]] — Appendix B context for the canon-repair pass
- [[_meta/BLUEPRINT-REALITY-DISCREPANCIES]] — the discrepancy log that motivated Repair 4

#execution #canon #repair #batch #completed
