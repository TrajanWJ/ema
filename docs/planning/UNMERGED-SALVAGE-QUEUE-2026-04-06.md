# Unmerged Salvage Queue

**Date:** 2026-04-06  
**Scope:** extract useful follow-up work from historical branches/commits that should not be merged directly into current `main`

## Source commits reviewed

- `7463264` — `Add proposal outcome endpoint`
- `2966ab9` — `Fix HQ project context adapter`
- `4ab98e3` — `Fix HQ project context adapter`
- historical actor/container intent from `worktree-agent-a9c5925c`
- `remotes/origin/companion`

## Triage

### Already landed on `main`

- **Proposal outcome endpoint**
  - Landed in backend already:
    - `daemon/lib/ema/proposal_engine/outcome_linker.ex`
    - `daemon/lib/ema/proposals/proposals.ex`
    - `daemon/lib/ema_web/controllers/proposal_controller.ex`
    - `daemon/lib/ema_web/router.ex`
  - The value left to salvage is not the endpoint itself, but surfacing it in product UI and analytics.

- **Actor/container base model**
  - Actor routes, controller, schemas, and migrations already exist on `main`.
  - The value left to salvage is verification/completeness, not branch merging.

### Do not merge directly

- **HQ context adapter patches** (`2966ab9`, `4ab98e3`)
  - The exact patch targets old shapes of `HQTab` and `project-store`.
  - Current `main` has heavily evolved these files, so the branch patch is stale.
  - The intent is still useful: keep HQ resilient to backend shape drift and aggregated response changes.

- **`companion`**
  - Separate history and no merge base with EMA `main`.
  - Treat as an external project line, not a merge candidate.

## Salvaged work to queue

### 1. Surface proposal outcome data in UI

**Recovered intent:** proposals should expose execution effectiveness, not just existence/status.

**Why it still matters:**
- backend endpoint exists: `GET /api/proposals/:id/outcome`
- no current frontend consumer was found during review

**Queue:**
- add proposal outcome fetch/use in proposal detail or HQ
- show `effectiveness`, `outcome_signal`, and `result_summary_excerpt`
- decide whether outcome belongs in HQ timeline, proposal detail, or both
- add frontend tests around rendering completed/failed/not-executed states

### 2. Harden HQ context contract

**Recovered intent:** HQ should survive backend response shape evolution without silent regressions.

**Why it still matters:**
- old HQ adapter commits were about fallback handling for aggregated shapes
- current `main` already uses richer context bundles, but the UI/store changed substantially after those commits
- no dedicated contract test was recovered for variant context payloads

**Queue:**
- define a stable typed contract for `/api/projects/:id/context`
- add normalization tests in `app/src/stores/project-store.ts`
- add UI smoke tests for missing/partial aggregates in `HQTab`
- explicitly handle absent `recent`, absent `by_status`, and partial `executions` bundles

### 3. Audit actor/container completeness

**Recovered intent:** verify actor/container data model is complete and coherent across schemas, controller surface, and migrations.

**Why it still matters:**
- actor/container work exists on `main`, but the historical branch goal was “verify and complete”, not merely “add files”
- this area now spans multiple migrations and controller endpoints and is easy to drift

**Queue:**
- audit current actor/container schema against controller/API behavior
- verify migration ordering and backfill assumptions
- verify seed coverage and default actor bootstrap behavior
- add a focused integration test pass for actor phase transitions, commands, tags, and core-table links

### 4. Optional: evaluate `companion` as integration target

**Recovered intent:** external companion runtime/docs line may be useful later.

**Why it is lower priority:**
- it is not mergeable with EMA history
- only reviewed tip commit updated `README.md`

**Queue:**
- treat as separate integration/research track
- if revived, import concepts intentionally instead of merging git history

## Recommended execution order

1. HQ context contract hardening
2. Proposal outcome UI surfacing
3. Actor/container completeness audit
4. Companion evaluation only if it becomes strategically relevant

## Non-goals

- merging the old branch heads directly
- trying to preserve their git history inside current `main`
- reopening stale frontend patches unchanged
