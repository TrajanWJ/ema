---
id: INT-CANON-REPAIR-CLAUDE-MD
type: intent
layer: intents
title: "Canon repair — rewrite ema-genesis/CLAUDE.md Project Structure + example paths (dead old-build/new-build refs, fictional INT-002)"
status: active
kind: canon-repair
phase: awaiting-approval
priority: high
created: 2026-04-12
updated: 2026-04-12
author: canon-repair-pass
connections:
  - { target: "[[EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[intents/INT-RECOVERY-WAVE-1]]", relation: references }
  - { target: "[[intents/GAC-001]]", relation: references }
exit_condition: "ema-genesis/CLAUDE.md Project Structure section reflects the actual repo tree. Every example intent path in the doc points at an intent that actually exists. No references to `old-build/` or `new-build/` subdirectories remain."
---

# INT-CANON-REPAIR-CLAUDE-MD

## The problem

Audit findings **C.03** (directory misdescription) and **C.07** (fictional INT-002 example) both target `ema-genesis/CLAUDE.md`. Also audit **S.04** (same as C.03, restated as staleness).

### Finding C.03 / S.04 — Project Structure section is wrong

Current content (lines ~36–39):

```
├─ old-build/             ← Old Tauri/Elixir codebase (REFERENCE ONLY)
│  └─ (preserved as-is for porting reference)
└─ new-build/             ← The Electron/TypeScript rebuild (YOUR WORKSPACE)
   └─ (this is where you write code)
```

Actual tree at the repo root:

```
ema/
├─ ema-genesis/            ← canon graph (you are here)
├─ IGNORE_OLD_TAURI_BUILD/ ← old Elixir/Tauri build (REFERENCE ONLY)
├─ apps/                   ← Electron + renderer (apps/electron + apps/renderer)
├─ services/               ← local backend (HTTP + WS)
├─ workers/                ← background jobs
├─ cli/                    ← TypeScript CLI
├─ shared/                 ← schemas, tokens, glass
├─ tools/                  ← contract extraction + parity tooling
├─ hq-api/                 ← HQ subsystem (API half)
├─ hq-frontend/            ← HQ subsystem (frontend half)
└─ docs/                   ← project docs
```

Neither `old-build/` nor `new-build/` exists. Any agent reading CLAUDE.md and trying to `cd old-build/` will get a file-not-found error.

### Finding C.07 — INT-002 example doesn't exist

Current content (lines ~45–55) uses `INT-002` as an example intent. No intent with that ID exists. Actual intents are:

- `GAC-001` through `GAC-010` (Gap/Assumption/Clarification cards, all answered)
- `INT-RECOVERY-WAVE-1` (master recovery intent)
- Plus the 13 recovered intents and 5 canon-repair intents added during the 2026-04-12 pass

## Proposed fix

### Fix 1: Replace the Project Structure section

Replace the stale `old-build/` / `new-build/` tree with the actual tree shown above. Keep the prose framing the same ("← you are here", "REFERENCE ONLY", etc.).

### Fix 2: Fix the example intent commands

Replace `INT-002` examples with real ones:

```bash
# Check open intents and GAC cards
ls ema-genesis/intents/

# Read a GAC card (Gap/Assumption/Clarification)
cat ema-genesis/intents/GAC-001/README.md

# Read the master recovery intent
cat ema-genesis/intents/INT-RECOVERY-WAVE-1/README.md
```

### Fix 3: Review the "ask 5 questions" instruction

The doc currently says: *"Ask the human 5 questions before starting work."* This predates the current governance rules. The user may want to keep it, revise it, or remove it. Flag as an **open sub-question** for the approver of this intent.

## Non-goals

- Don't touch the philosophical sections ("How To Work", the intent→proposal→execution loop, the supervised-agent framing) — those remain correct.
- Don't modify `ema-genesis/EMA-GENESIS-PROMPT.md` or any other doc. This intent is scoped to CLAUDE.md only.
- Don't add new sections or reorganize. Minimum-diff repair.

## Verification

```bash
# After fix, neither of these should match any content in CLAUDE.md:
grep -E "old-build|new-build|INT-002" ema-genesis/CLAUDE.md
# Expected: zero results
```

## Scope interpretation

Under the strict interpretation I adopted for the canon-repair pass, `ema-genesis/CLAUDE.md` is **not** canon-locked (it's project instructions, not in `canon/`). I could in principle edit it directly. But I'm routing it through this intent anyway because:

1. The user just tightened the governance rule and I want to err on the side of more intent flow, not less.
2. Agent onboarding reads CLAUDE.md first and getting this wrong has cascade effects.
3. The doc touches canonical claims (about the repo structure, about the work process) even if the file itself isn't under `canon/`.

If the user wants to override and say "CLAUDE.md is fine to direct-edit," approving this intent with a "just do it" signal accomplishes the same thing with less ceremony.

## Related

- [[_meta/SELF-POLLINATION-FINDINGS]] — the recovery pass that this CLAUDE.md staleness predates
- [[intents/INT-RECOVERY-WAVE-1]] — the master recovery intent
- Audit findings C.03, C.07, S.04

#intent #canon-repair #claude-md #onboarding
