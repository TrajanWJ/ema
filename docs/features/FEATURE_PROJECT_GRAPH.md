# Feature: Project Graph Visualization

## What It Does

Interactive force-directed graph showing the entire EMA knowledge space — projects, proposals, executions, intents, and their relationships. A visual "map" of everything happening in EMA.

## Why It Matters

EMA has projects, proposals, tasks, executions, intent nodes — dozens of interconnected entities. Without visualization, you can't see the big picture. The project graph shows relationships, health, and activity at a glance.

## How It Works (Technical)

### Backend: `Ema.Intelligence.ProjectGraph`

Collects nodes from multiple sources:
- **Projects** → `Ema.Projects.list_projects/0`
- **Proposals** → `Ema.Proposals.list_proposals/1` (recent 30)
- **Executions** → `Ema.Executions.list_executions/1`
- **IntentNodes** → `Ema.Intelligence.IntentMap.list_nodes/1`

Builds edges from relationships:
- Project → Proposal (has_proposal)
- Proposal → Execution (has_execution, via proposal_id)
- IntentNode → child IntentNode (implements, via parent_id)
- Project → IntentNode (references, via project_id)

Each node gets a health score (0.0-1.0):
- Projects: based on status + open todos + recent activity
- Proposals: based on status (approved=0.9, killed=0.1)
- Executions: based on status (completed=1.0, failed=0.1)
- Intents: default 0.7

### API: `EmaWeb.ProjectGraphController`

| Endpoint | Response |
|---|---|
| `GET /api/project-graph` | Full graph: `{nodes: [...], edges: [...]}` |
| `GET /api/project-graph?project_id=X` | Focused graph for one project |
| `GET /api/project-graph/nodes/:id` | Detailed node info |

### Frontend: `ProjectGraphApp.tsx`

Built with `react-force-graph-2d`:
- Nodes colored by type (project=blue, proposal=gold, execution=green, intent=purple)
- Node size proportional to health_score
- Directional arrows on edges
- Hover shows labels (at zoom > 1.2x)
- Click node → side panel with detail + metrics
- Search bar filters/highlights nodes
- Legend showing node types
- Auto-refresh every 30 seconds

## Current Status

- ✅ `ProjectGraph` backend module — implemented
- ✅ `ProjectGraphController` — implemented
- ✅ `graph-store.ts` — implemented
- ✅ `ProjectGraphApp.tsx` — implemented
- ✅ Launchpad tile + App.tsx route — implemented
- ⏳ Compilation verification — pending

## Implementation Steps

1. ✅ Create `daemon/lib/ema/intelligence/project_graph.ex`
2. ✅ Create `daemon/lib/ema_web/controllers/project_graph_controller.ex`
3. ✅ Add routes to router.ex
4. ✅ Create `app/src/stores/graph-store.ts`
5. ✅ Create `app/src/components/project-graph/ProjectGraphApp.tsx`
6. ✅ Register in Launchpad + App.tsx
7. ⏳ Verify compilation
8. Future: WebSocket channel for real-time updates
9. Future: Vault note nodes (from SecondBrain)
10. Future: Superman repo nodes

## Data Structures

### GraphNode
| Field | Type | Description |
|---|---|---|
| id | string | Prefixed ID (proj-, prop-, exec-, int-) |
| name | string | Display name |
| type | string | project, proposal, execution, intent |
| status | string | Entity-specific status |
| health_score | float | 0.0-1.0, higher = healthier |
| metrics | map | Type-specific metrics |
| color | string | Hex color for rendering |
| inserted_at | datetime | Creation time |

### GraphEdge
| Field | Type | Description |
|---|---|---|
| from | string | Source node ID |
| to | string | Target node ID |
| type | string | has_proposal, has_execution, implements, references |
| label | string | Human-readable edge label |

## API Surface

| Endpoint | Method | Description |
|---|---|---|
| `/api/project-graph` | GET | Full graph |
| `/api/project-graph?project_id=X` | GET | Project-focused graph |
| `/api/project-graph/nodes/:id` | GET | Node detail |

## Next Steps

1. Verify compilation (mix compile + tsc)
2. Add vault note nodes (connect SecondBrain to graph)
3. Add Superman repo nodes (codebase structure)
4. Add WebSocket channel for real-time graph updates
5. Add clustering/grouping by project
