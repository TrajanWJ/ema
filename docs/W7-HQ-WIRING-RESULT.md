# W7 HQ Wiring Result

**Status:** COMPLETE  
**Date:** 2026-04-04 UTC

## Files changed

- `app/src/stores/project-store.ts`
- `app/src/components/superman/HQTab.tsx`

## What changed

- Switched Superman HQ project selection and channel subscription from `projects:<slug>` to `projects:<id>`, which matches `EmaWeb.ProjectChannel`.
- Made the project socket optional: HQ now keeps working from `GET /api/projects/:id/context` even if the project channel join fails or closes.
- Replaced the old frontend context assumptions (`active_tasks`, `recent_proposals`, `last_execution`) with the live backend shape:
  - `tasks.recent`
  - `proposals.recent`
  - `executions.recent`
  - `active_campaign`
  - `gaps.top_blockers`
  - `health`
  - `stats`
  - `vault.recent_notes`
  - `reflexion.recent`
- Kept live updates simple and robust: project-channel events trigger a context refetch instead of trying to patch the richer bundle client-side.
- Kept the HQ UI small and coherent: it now shows health, active campaign, recent tasks, recent proposals, recent executions, blockers, vault notes, and reflexion lessons.

## Verification

### Frontend

Command:

```bash
cd /home/trajan/Projects/ema/app && npm run build
```

Result:

- Exit code: `0`
- TypeScript build passed
- Vite production build passed

Command:

```bash
cd /home/trajan/Projects/ema/app && npx eslint src/components/superman/HQTab.tsx src/stores/project-store.ts
```

Result:

- Exit code: `0`

Command:

```bash
cd /home/trajan/Projects/ema/app && npm run lint
```

Result:

- Exit code: `1`
- Failed due to many pre-existing repo-wide lint issues outside this change
- The touched HQ files were re-checked separately and passed

### Backend

Command attempted:

```bash
export PATH="$HOME/.local/share/mise/installs/elixir/1.18.4-otp-27/bin:$HOME/.local/share/mise/installs/erlang/27.3.4.9/bin:$PATH"
cd /home/trajan/Projects/ema/daemon && mix compile
```

Result:

- Exit code: `1`
- Blocked by sandbox/runtime permissions, not by an EMA compile error
- Mix failed starting `Mix.PubSub` because it could not open a TCP socket: `reason: :eperm`

## Remaining

- No backend source change was required for this wiring pass.
- Full repo lint is still red from unrelated existing issues.
- Backend compile should be re-run in a normal local shell outside the current sandbox if a compile confirmation is required.
