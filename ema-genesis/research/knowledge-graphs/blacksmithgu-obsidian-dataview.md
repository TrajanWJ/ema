---
id: RES-dataview
type: research
layer: research
category: knowledge-graphs
title: "blacksmithgu/obsidian-dataview — DQL query DSL over markdown frontmatter + inline fields"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/blacksmithgu/obsidian-dataview
  stars: 8752
  verified: 2026-04-12
  last_activity: 2025-11-17
signal_tier: A
tags: [research, knowledge-graphs, signal-A, dataview, dql, query-dsl]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# blacksmithgu/obsidian-dataview

> Treats a folder of markdown as a queryable database via YAML frontmatter + inline `key:: value` fields. Ships **DQL** — a SQL-esque query language. The query DSL grammar is what EMA should adopt.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/blacksmithgu/obsidian-dataview> |
| Stars | 8,752 (verified 2026-04-12) |
| Last activity | 2025-11-17 (stable; successor `datacore` in active dev) |
| Signal tier | **A** |

## What to steal

### 1. DQL grammar

```sql
TABLE file.name AS Page, status, due_date
FROM #task
WHERE status = "open" AND due_date < date(today) + dur(7 days)
SORT due_date ASC
LIMIT 20
```

Six clauses, all optional except FROM:
- `TABLE / LIST / TASK / CALENDAR` — output type
- `FROM` — source (#tag, "folder", or boolean expression)
- `WHERE` — filter
- `SORT` — order
- `LIMIT` — bound
- `GROUP BY` — aggregation
- `FLATTEN` — array expansion

EMA's `[[DEC-001]]` adopts this shape. Start with `TABLE / FROM / WHERE / SORT / LIMIT` for v1.

### 2. Dual metadata syntax

```markdown
---
status: open
priority: high
---

# My note

Some content with inline metadata. status:: in_progress
```

Frontmatter for page-level. Inline `key:: value` for body-level. Both indexed the same way. EMA should support both — don't force users to one or the other.

### 3. JavaScript API for programmatic access

```javascript
dv.pages("#tag").where(p => p.status === "open").sort(p => p.due)
```

Query objects in code, not just DSL. EMA should expose both: DSL for users, fluent API for plugins.

### 4. The successor: `blacksmithgu/datacore`

Active v2 (2.1k stars) focused on UX + speed. Worth watching but not yet stable enough to commit to.

## Changes canon

| Doc | Change |
|---|---|
| `[[DEC-001]]` graph engine | DQL is the canonical query language shape (subset for v1) |
| `vapps/CATALOG.md` Vault | Add a DQL query bar to the Vault app |

## Gaps surfaced

- EMA has no query language. The 67+ Zustand stores from the old build each invented their own filter logic. A single DQL-shape layer over the Object Index would unify this.

## Notes

- Dataview is JavaScript-only in Obsidian. **Steal the DSL shape, not the implementation.**
- datacore signals where the community is headed; revisit when stable.

## Connections

- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — alternative query primitive (Lua)
- `[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]` — typed-edge cousin
- `[[DEC-001]]`

#research #knowledge-graphs #signal-A #dataview #dql #query-dsl
