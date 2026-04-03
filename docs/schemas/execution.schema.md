# Schema: Execution

**Module:** `Ema.Executions.Execution`
**Table:** `executions`

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | string | yes | generated | Unique ID (e.g., "exec-abc123") |
| title | string | no | nil | Human-readable title |
| objective | text | no | nil | What this execution aims to achieve |
| status | string | yes | "created" | Lifecycle status |
| mode | string | no | nil | Execution mode ("agent", "manual", "pipe") |
| intent_slug | string | no | nil | Link to Superman intent folder |
| proposal_id | string | no | nil | Origin proposal (FK to proposals) |
| project_slug | string | no | nil | Parent project slug (FK to projects) |
| brain_dump_item_id | string | no | nil | Origin brain dump item |
| session_id | string | no | nil | Claude session ID |
| inserted_at | utc_datetime | auto | now | Creation timestamp |
| updated_at | utc_datetime | auto | now | Last update timestamp |

## Status Lifecycle

```
created → approved → delegated → running → completed
                                       ↘ failed
created → cancelled
```

Valid statuses: `created`, `approved`, `delegated`, `running`, `completed`, `failed`, `cancelled`

## Relationships

- **Has many** `Ema.Executions.Event` (event sourcing)
- **Has many** `Ema.Executions.AgentSession`
- **Belongs to** `Ema.Proposals.Proposal` (via proposal_id)
- **Belongs to** `Ema.Projects.Project` (via project_slug)

## Example

```json
{
  "id": "exec-k7x9m2",
  "title": "Implement multi-tenancy org model",
  "objective": "Create org schema, controller, and frontend store",
  "status": "completed",
  "mode": "agent",
  "intent_slug": "multi-tenancy",
  "proposal_id": "prop-abc123",
  "project_slug": "ema",
  "inserted_at": "2026-04-01T10:00:00Z"
}
```
