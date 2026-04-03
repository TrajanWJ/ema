# Schema: IntentNode

**Module:** `Ema.Intelligence.IntentMap.IntentNode`
**Table:** `intent_nodes`

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | string | yes | generated | Unique ID |
| title | string | yes | — | Node name/title |
| description | text | no | nil | Extended description |
| level | string | yes | — | Hierarchy level (see below) |
| parent_id | string | no | nil | Parent node ID (FK to intent_nodes) |
| project_id | string | no | nil | Associated project |
| status | string | no | "active" | Node status |
| metadata | json | no | %{} | Arbitrary metadata |
| inserted_at | utc_datetime | auto | now | Creation timestamp |
| updated_at | utc_datetime | auto | now | Last update timestamp |

## Hierarchy Levels

IntentMap uses a 5-level hierarchy representing increasing specificity:

```
Product       (highest level — what product/service)
  └── Flow        (user-facing flow or feature)
        └── Action    (specific user action)
              └── System    (system component)
                    └── Implementation  (code-level detail)
```

| Level | Example | Links To |
|---|---|---|
| Product | "EMA OS" | Flows |
| Flow | "Brain Dump Processing" | Actions |
| Action | "Triage inbox item" | Systems |
| System | "BrainDump context module" | Implementations |
| Implementation | "BrainDump.process_item/2" | Code files (via Superman) |

## Relationships

- **Has many** children (self-referential via parent_id)
- **Belongs to** parent IntentNode (via parent_id)
- **Belongs to** Project (via project_id)

## Example

```json
{
  "id": "int-k7x9m2",
  "title": "Brain Dump Processing",
  "description": "Converts raw inbox items into actionable tasks or proposals",
  "level": "flow",
  "parent_id": "int-root-ema",
  "project_id": "ema",
  "status": "active",
  "metadata": {
    "owner": "Ema.BrainDump",
    "entry_points": ["POST /api/brain-dump/items/:id/process"]
  },
  "inserted_at": "2026-03-20T10:00:00Z"
}
```

## Tree Query

`IntentMap.list_nodes(project_id: "ema")` returns all nodes for a project.
`IntentMap.tree(project_id)` returns a nested tree structure.

```json
{
  "id": "int-root",
  "title": "EMA OS",
  "level": "product",
  "children": [
    {
      "id": "int-bdp",
      "title": "Brain Dump Processing",
      "level": "flow",
      "children": [
        {
          "id": "int-triage",
          "title": "Triage inbox item",
          "level": "action",
          "children": []
        }
      ]
    }
  ]
}
```
