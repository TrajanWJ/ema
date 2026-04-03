# Schema: Project Graph

**Module:** `Ema.Intelligence.ProjectGraph`
**Not persisted** — computed on-demand from existing data sources.

## GraphNode

| Field | Type | Description |
|---|---|---|
| id | string | Prefixed unique ID. Format: `{type_prefix}-{entity_id}` |
| name | string | Display name (project name, proposal title, etc.) |
| type | string | One of: "project", "proposal", "execution", "intent", "vault_note" |
| status | string | Entity-specific status string |
| health_score | float | 0.0-1.0, higher = healthier |
| metrics | map | Type-specific metrics (see below) |
| color | string | Hex color for rendering |
| inserted_at | datetime | Entity creation time |
| detail | map | (optional) Extended detail for node detail view |

### ID Prefixes

| Prefix | Source |
|---|---|
| `proj-` | `Ema.Projects.Project` |
| `prop-` | `Ema.Proposals.Proposal` |
| `exec-` | `Ema.Executions.Execution` |
| `int-` | `Ema.Intelligence.IntentMap.IntentNode` |

### Metrics by Type

**Project:**
```json
{ "open_todos": 5, "proposal_count": 12, "execution_count": 3 }
```

**Proposal:**
```json
{ "project_id": "ema", "generation": 2, "score": 0.85 }
```

**Execution:**
```json
{ "mode": "agent", "intent_slug": "auth-flow", "proposal_id": "prop-123" }
```

**Intent:**
```json
{ "level": "action", "project_id": "ema", "parent_id": "int-456" }
```

## GraphEdge

| Field | Type | Description |
|---|---|---|
| from | string | Source node ID |
| to | string | Target node ID |
| type | string | Edge type (see below) |
| label | string | Human-readable label for rendering |

### Edge Types

| Type | From → To | Meaning |
|---|---|---|
| `has_proposal` | project → proposal | Project contains this proposal |
| `has_execution` | proposal → execution | Proposal spawned this execution |
| `implements` | intent → child intent | Parent-child intent hierarchy |
| `references` | project → intent | Project has this intent node |
| `evolves_from` | proposal → parent proposal | Proposal genealogy (planned) |

## API Response Example

```json
{
  "nodes": [
    {
      "id": "proj-ema",
      "name": "EMA",
      "type": "project",
      "status": "active",
      "health_score": 0.78,
      "metrics": { "open_todos": 5, "proposal_count": 12, "execution_count": 3 },
      "color": "#4f8ef7",
      "inserted_at": "2026-03-15T10:00:00Z"
    },
    {
      "id": "prop-abc123",
      "name": "Add multi-tenancy support",
      "type": "proposal",
      "status": "approved",
      "health_score": 0.9,
      "metrics": { "project_id": "ema", "generation": 1, "score": 0.85 },
      "color": "#f7b94f",
      "inserted_at": "2026-04-01T14:30:00Z"
    }
  ],
  "edges": [
    {
      "from": "proj-ema",
      "to": "prop-abc123",
      "type": "has_proposal",
      "label": "proposes"
    }
  ]
}
```

## Health Score Calculation

### Project Health
```
base = status_score(active=0.8, incubating=0.6, paused=0.3, archived=0.1)
penalty = min(open_todos * 0.02, 0.3)
bonus = min(execution_count * 0.05, 0.2)
score = max(base - penalty + bonus, 0.0)
```

### Proposal Health
| Status | Score |
|---|---|
| approved | 0.9 |
| queued | 0.7 |
| pending | 0.6 |
| redirected | 0.5 |
| killed | 0.1 |

### Execution Health
| Status | Score |
|---|---|
| completed | 1.0 |
| running | 0.8 |
| delegated | 0.75 |
| approved | 0.7 |
| created | 0.6 |
| failed | 0.1 |
| cancelled | 0.1 |
