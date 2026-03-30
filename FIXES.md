# Frontend Fixes — 2026-03-30

## 1. Error Handling in App Init Functions (all 8 apps)

**Problem:** Every app (`ProposalsApp`, `ProjectsApp`, `TasksApp`, `ResponsibilitiesApp`, `AgentsApp`, `VaultApp`, `CanvasApp`, `PipesApp`) called `loadViaRest()` without try/catch. If the daemon was unreachable or returned an error, `setReady(true)` never executed, leaving the app stuck on "Loading..." forever with no recovery path.

**Fix:** Wrapped each `init()` REST call in try/catch. On failure, `setError(message)` is called and `setReady(true)` still fires so the app renders its primary view with an error banner instead of infinite loading. WebSocket connections remain fire-and-forget (they already had `.catch()` guards).

**Files changed:**
- `app/src/components/proposals/ProposalsApp.tsx`
- `app/src/components/projects/ProjectsApp.tsx`
- `app/src/components/tasks/TasksApp.tsx`
- `app/src/components/responsibilities/ResponsibilitiesApp.tsx`
- `app/src/components/agents/AgentsApp.tsx`
- `app/src/components/vault/VaultApp.tsx`
- `app/src/components/canvas/CanvasApp.tsx`
- `app/src/components/pipes/PipesApp.tsx`

## 2. Null-Safety for Array Properties from API

**Problem:** Several components called `.map()` or `.length` on array properties (`tags`, `risks`, `benefits`, `actions`, `tools`) that could be `null` or `undefined` if the API returns partial data. This would cause a runtime crash (TypeError: Cannot read properties of null).

**Fix:** Added `?? []` fallback before `.map()` and `.length` access on potentially-null arrays.

**Files changed:**
- `app/src/components/proposals/ProposalCard.tsx` — `proposal.tags`, `proposal.risks`, `proposal.benefits`
- `app/src/components/pipes/PipeCard.tsx` — `pipe.actions`
- `app/src/components/agents/AgentGrid.tsx` — `agent.tools`
- `app/src/components/agents/AgentDetail.tsx` — `agent.tools`
- `app/src/components/vault/NoteEditor.tsx` — `selectedNote.tags`
- `app/src/components/vault/VaultSearch.tsx` — `note.tags`

## 3. Glass Aesthetic Consistency

**Problem:** Multiple components applied both the `glass-surface` CSS class (which sets `border: 1px solid rgba(255,255,255,0.06)`) and an inline `style={{ border: "1px solid var(--pn-border-subtle)" }}`. Since `--pn-border-subtle` resolves to `rgba(255,255,255,0.04)`, the inline style overrode the class border, creating inconsistent border opacity (0.04 vs the spec's 0.06) across glass panels.

**Fix:** Removed redundant inline border declarations from elements that already have the `glass-surface` class. The class border (`0.06`) is now the single source of truth for glass panel borders.

**Files changed:**
- `app/src/components/tasks/TasksApp.tsx`
- `app/src/components/tasks/TaskCard.tsx`
- `app/src/components/proposals/SeedList.tsx` (2 instances)
- `app/src/components/proposals/EngineStatus.tsx`
- `app/src/components/proposals/ProposalCard.tsx`
- `app/src/components/projects/ProjectGrid.tsx`
- `app/src/components/projects/ProjectDetail.tsx` (4 instances)
- `app/src/components/projects/ProjectsApp.tsx`

## 4. Canvas Store & Components (pre-existing uncommitted fixes)

These fixes were already in the working tree before this session:

- `app/src/stores/canvas-store.ts` — Added missing `connect()` method to the store interface and implementation (no-op since canvas uses per-canvas channels via `selectCanvas()`)
- `app/src/components/canvas/ElementForm.tsx` — Removed unused `canvasId` prop; `addElement()` now uses the channel from the store directly
- `app/src/components/canvas/CanvasEditor.tsx` — Updated `ElementForm` usage (removed `canvasId` prop) and `removeElement()` call (removed first arg)

## Verification

- TypeScript: `npx tsc --noEmit` passes with zero errors
- Vite build: `npx vite build` succeeds (133 modules, 404KB JS bundle)
- All APP_CONFIGS entries present for all 8 new apps
- All routing cases present in `App.tsx` switch statement
- All stores connect to correct WebSocket topics (verified against Phoenix channel definitions)
- All REST endpoint paths match daemon router definitions
- Empty states handled gracefully in all list/grid views
