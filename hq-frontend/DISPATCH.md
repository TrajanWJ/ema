# LaunchpadHQ — Dispatch Instructions

## Context

LaunchpadHQ is the web frontend for EMA at `~/Projects/ema/hq-frontend/`. Phases 1-4 of the 6-phase expansion plan are complete. The app is wired to the Phoenix daemon at `:4488` via REST + Phoenix WebSocket channels.

**Plan file:** `~/.claude/plans/sprightly-purring-rocket.md`

## Current State (2026-04-06)

- **9 pages** working: Dashboard, Projects, Executions, Agents, Brain Dump, Intents, Actors, Spaces, Orgs
- **9 Zustand stores** with REST load + Phoenix channel real-time sync
- **Build clean:** `npm run build` passes (tsc strict + vite)
- **Daemon required:** `cd daemon && mix phx.server` must be running on :4488
- **Dev server:** `cd hq-frontend && npm run dev` on :5173

## What's Next: Phase 5

### 5.1 Execution Detail Panel

Expand `ExecutionsPage.tsx` with a detail view when an execution is clicked:

```
GET /api/executions/:id/events   → Timeline of lifecycle events
GET /api/executions/:id/agent-sessions → Agent session list with role/status/timing
GET /api/executions/:id/diff     → Git diff with files_changed, lines_added/removed
```

- Add an `ExecutionDetail` component that loads on expand (already have expand toggle)
- Events as vertical timeline with type icons
- Agent sessions as cards with status badges
- Diff as syntax-highlighted `<pre>` block (no dep needed, just monospace)

### 5.2 Dispatch Board Widget

New widget for Dashboard replacing the Superman widget slot:

```
GET /api/dispatch-board       → Full board state
GET /api/dispatch-board/stats → Aggregate counts
```

- Show running executions with live timers
- Queue depth, completion rate, circuit breaker status

### 5.3 Project Detail Enhancement

When a project is active, show richer context:

```
GET /api/projects/:id/context          → Full project bundle
GET /api/projects/:project_id/tasks    → Project tasks
```

- Linked tasks list
- Recent executions for project
- Project-level brain dumps

## What's Next: Phase 6

### 6.1 Intent Tree View

The flat list in `IntentsPage.tsx` needs a hierarchical tree:

```
GET /api/intents/tree          → Nested tree structure
GET /api/intents/:id/lineage   → Ancestry chain
GET /api/intents/:id/runtime   → Live execution status
```

- Collapsible tree grouped by parent_id
- Color-coded by level (L0=yellow, L1=orange, ..., L5=dim)
- Click to expand shows lineage + linked executions + runtime status

### 6.2 Reusable Components

**TagPanel** (`components/shared/TagPanel.tsx`):
- Props: `entityType`, `entityId`
- Loads tags from `tagStore`, renders as badges with namespace prefix
- Add tag input with namespace selector
- Uses: `POST /api/tags`, `DELETE /api/tags`

**WorkContainerPanel** (`components/shared/WorkContainerPanel.tsx`):
- Props: `entityType`, `entityId`
- Shows: tags (via TagPanel), entity_data (per actor), container_config, brain dumps
- Uses: `/api/tags`, `/api/entity-data`, `/api/container-config`, `/api/brain-dump/items`
- Embed in ProjectsPage detail, ExecutionsPage detail, IntentsPage detail

### 6.3 Space-Scoped Filtering

- `spaceStore.activeSpaceId` should propagate to API calls
- Projects, actors, intents all support `?space_id=` query params on daemon
- Add space_id filter to `loadViaRest()` in projectStore, actorStore, intentStore

### 6.4 Actor Perspective Toggle

- Add actor selector dropdown to TopBar (next to project selector)
- When an actor is selected, filter executions/tags/entity-data by `actor_id`
- Store in localStorage as `hq_active_actor`

## Key Files to Modify

| File | For |
|------|-----|
| `src/components/pages/ExecutionsPage.tsx` | 5.1 execution detail |
| `src/components/dashboard/Dashboard.tsx` | 5.2 dispatch widget |
| `src/components/pages/ProjectsPage.tsx` | 5.3 project detail |
| `src/components/pages/IntentsPage.tsx` | 6.1 tree view |
| `src/components/shared/TagPanel.tsx` | 6.2 new |
| `src/components/shared/WorkContainerPanel.tsx` | 6.2 new |
| `src/store/projectStore.ts` | 6.3 space filter |
| `src/store/actorStore.ts` | 6.3 space filter |
| `src/store/intentStore.ts` | 6.3 space filter |
| `src/components/shell/TopBar.tsx` | 6.4 actor toggle |

## Key Patterns

### Store pattern (follow existing)
```typescript
// REST load + channel connect + fallback
async loadViaRest() { ... }
async connect() {
  try { joinChannel("topic:lobby"); ... }
  catch { await get().loadViaRest(); }  // graceful fallback
}
```

### API client (all endpoints in `src/api/hq.ts`)
```typescript
// Typed, returns daemon shape exactly
export const getExecutionEvents = (id: string) =>
  request<{ events: ExecutionEvent[] }>(`/api/executions/${id}/events`);
```

### Component convention
- Glass morphism: `.glass`, `.panel`, `.card`, `.badge` CSS classes
- Colors: `var(--accent)`, `var(--green)`, `var(--purple)`, `var(--orange)`, etc.
- Layout: `.page > .page-title + content`, `.row`, `.row-between`, `.card-list`
- No external UI library — all vanilla CSS in `index.css`

## Verification

After each phase:
1. `npm run build` — must pass clean
2. `npm run dev` — verify against running daemon
3. Cross-check with CLI: `ema execution list`, `ema intent tree`, `ema actor list`
