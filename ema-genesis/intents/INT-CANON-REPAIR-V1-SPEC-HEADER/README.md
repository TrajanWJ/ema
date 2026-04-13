---
id: INT-CANON-REPAIR-V1-SPEC-HEADER
type: intent
layer: intents
title: "Canon repair — soften EMA-V1-SPEC.md 'supersedes all prior extractions' header to match the 2026-04-12 CANON-STATUS ruling"
status: active
kind: canon-repair
phase: awaiting-approval
priority: high
created: 2026-04-12
updated: 2026-04-12
author: canon-repair-pass
connections:
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: modifies }
  - { target: "[[_meta/CANON-STATUS]]", relation: references }
  - { target: "[[EMA-GENESIS-PROMPT]]", relation: references }
exit_condition: "EMA-V1-SPEC.md header no longer claims to supersede all prior extractions. Instead, it clearly states that the document specifies Phase 1 within the Genesis vision per the 2026-04-12 CANON-STATUS ruling. Body of the spec remains untouched."
---

# INT-CANON-REPAIR-V1-SPEC-HEADER

## The problem

Audit findings **C.06** and **S.02** flag the same contradiction:

- `canon/specs/EMA-V1-SPEC.md` (written 2026-04-11) header claims: *"This document supersedes all prior extractions."*
- `_meta/CANON-STATUS.md` (ruling issued 2026-04-12, **one day later**) says: *"Q1 answer = B. Genesis wins. EMA-V1-SPEC.md is re-labeled as Phase 1 of the Genesis vision, not a competing reduction."*

The two claims are in direct conflict. Any agent reading both gets contradictory instructions about which document is canonical. Currently:

- A fresh reader of `EMA-V1-SPEC.md` concludes it's the single source of truth and treats Genesis as superseded.
- A fresh reader of `CANON-STATUS.md` concludes Genesis is canonical and V1-SPEC is Phase 1.

The CANON-STATUS ruling is newer and explicit, so it wins. But `EMA-V1-SPEC.md` hasn't been updated to reflect the demotion.

## Proposed fix

Rewrite the first 3–5 lines of `canon/specs/EMA-V1-SPEC.md` (the area currently containing the "supersedes" claim) to something equivalent to:

```markdown
# EMA v1 — Phase 1 Specification (minimum viable slice of Genesis)

> This document specifies **Phase 1 of the Genesis vision** per the 2026-04-12 ruling
> in [[_meta/CANON-STATUS]]. It is the minimum viable slice within Genesis — not a
> replacement for it. The full maximalist vision (35 vApps, P2P mesh, research
> ingestion, distributed homelab, puppeteer runtime) lives in [[EMA-GENESIS-PROMPT]].
> Use this document to hand Phase 1 implementation to a coding or planning agent.
```

Add (or update) a `connections:` block entry: `{ target: "[[_meta/CANON-STATUS]]", relation: refined_by }`

**Do not modify anything else in the file.** The body sections (§1 through §11) stay as-written. This is a header-only fix.

## Why this is high-severity

1. Two current canon nodes contradict on the fundamental question of "what is EMA v1?" — a new agent can't trust either without cross-checking.
2. Fixing it is a small edit (a paragraph) but the impact is large (resolves the single most load-bearing confusion in the canon graph).
3. It can't be fixed by editing CANON-STATUS alone — the V1-SPEC header has to explicitly acknowledge the demotion or readers of V1-SPEC who don't read CANON-STATUS will still get the old claim.

## Alternative considered and rejected

- **Alternative:** Add a note in CANON-STATUS referencing V1-SPEC's outdated header and explaining the demotion. Rejected because it leaves the contradiction in V1-SPEC itself; every reader has to navigate to CANON-STATUS to disambiguate. Not sustainable.

## Non-goals

- Don't add "Phase 1 / Phase 2 / Phase 3" labels anywhere in the V1-SPEC body. That's a separate, larger phasing intent.
- Don't rewrite V1-SPEC's §1 scope statement. The scope is correct as written (CLI + TS library + folder-of-markdown + 1 LLM provider + intent loop) — it just needs to be framed as "Phase 1 of Genesis" instead of "the replacement for Genesis."
- Don't archive the current V1-SPEC. The content stays; only the header framing moves.

## Verification

```bash
# After fix:
grep "supersedes all prior extractions" ema-genesis/canon/specs/EMA-V1-SPEC.md
# Expected: zero results

grep "Phase 1 of the Genesis vision" ema-genesis/canon/specs/EMA-V1-SPEC.md
# Expected: at least one match
```

## Related

- [[_meta/CANON-STATUS]] — the authoritative ruling
- [[canon/specs/EMA-V1-SPEC]] — the target of the edit
- [[EMA-GENESIS-PROMPT]] — the parent canonical vision
- Audit findings C.06, S.02

#intent #canon-repair #v1-spec #phase-clarification
