---
id: EXTRACT-<owner-repo>
type: extraction
layer: research
category: <agent-orchestration | p2p-crdt | knowledge-graphs | cli-terminal | vapp-plugin | context-memory | life-os-adhd | self-building>
title: "Source Extractions — owner/repo"
status: active
created: 2026-04-12
updated: 2026-04-12
author: <agent-name>
clone_path: "../_clones/<owner-slug>-<repo>/"
source:
  url: https://github.com/owner/repo
  sha: <short-hash>
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: <estimate>
tags: [extraction, <category>, <repo>]
connections:
  - { target: "[[research/<category>/<owner>-<repo>]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
---

# Source Extractions — owner/repo

> Companion extraction doc for `[[research/<category>/<owner>-<repo>]]`. This is the **file + line level** deep-read output for future EMA development. Code snippets are copied verbatim from the cloned source and cited with path + line range.

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/owner/repo |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~XX MB |
| Language | TypeScript / Rust / Go / etc |
| License | MIT / Apache / AGPL / NONE |
| Key commit SHA | short hash |

## Install attempt

- **Attempted:** yes / no
- **Command:** `npm install` / `cargo build` / etc
- **Result:** success / failed / skipped
- **If skipped, why:** (e.g., "requires Docker", "requires API keys", "requires Postgres", "too heavy")

## Run attempt

- **Attempted:** yes / no
- **Command:** `npm start` / `./bin/foo` / etc
- **Result:** success / failed / skipped
- **If skipped, why:** see install

## Key files identified

Ordered by porting priority:

1. `path/to/primary-file.ext` — primary pattern to port
2. `path/to/secondary.ext` — supporting concept
3. `path/to/schema.ext` — data model
4. ...

## Extracted patterns

### Pattern 1: <pattern name>

**Files:**
- `path/to/file.ts:47-89` — the core logic
- `path/to/types.ts:12-34` — type definitions

**Snippet (verbatim from source):**
```typescript
// path/to/file.ts:47-89
async function exampleFunction(args) {
  // ... actual code from the repo
}
```

**What to port to EMA:**
Concrete description of how to adapt this to EMA's stack. Name the EMA module this lands in.

**Adaptation notes:**
- Language/runtime differences
- Dependency substitutions
- Schema adjustments

### Pattern 2: <name>

(same shape)

### Pattern 3: ...

## Gotchas found while reading

Things that would bite a port — subtle issues in the source code you'd miss from README alone. Bullet list:

- ...
- ...

## Port recommendation

Concrete next steps for EMA's port:

1. Start with file X → map to EMA module Y
2. Dependency decisions
3. Testing approach
4. Risks

## Related extractions

- `[[research/_extractions/<sibling-extract>]]`

## Connections

- `[[research/<category>/<owner>-<repo>]]` — original research node
- `[[research/_clones/INDEX]]`

#extraction #<category> #<repo>
