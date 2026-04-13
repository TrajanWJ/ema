---
id: RES-gotohuman
type: research
layer: research
category: agent-orchestration
title: "gotohuman/gotohuman-mcp-server — field-level approval with custom forms"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-d
source:
  url: https://github.com/gotohuman/gotohuman-mcp-server
  stars: 54
  verified: 2026-04-12
  last_activity: 2025-06-05
signal_tier: A
tags: [research, agent-orchestration, signal-A, gotohuman, field-level-approval]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]", relation: references }
---

# gotohuman/gotohuman-mcp-server

> Managed SaaS approval-queue with **per-proposal custom review forms** and field-level retry. Exposes the gap in EMA's coarse approve/reject/revise model.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/gotohuman/gotohuman-mcp-server> |
| Stars | 54 (verified 2026-04-12) |
| Last activity | 2025-06-05 |
| Signal tier | **A** |

## What to steal

### 1. Custom review form schema

Each suggestion carries its own UI schema:
- text/markdown/JSON/image content fields
- Interactive checkboxes/dropdowns/buttons
- Per-field validation

EMA proposals are currently free-text prose being approved whole. **No field-level granularity, no partial-retry.** This is the biggest single gap Round 2 surfaced.

### 2. Field-level retry controls

Reviewers can loop back to regenerate **specific fields** without rerunning the whole agent turn. Steal:
- `regenerate(field_id)` — re-prompt for one chunk
- `accept(field_ids: [])` — partial approval
- `edit(field_id, value)` — manual override

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md GAC` | Approve/Reject/Revise is too coarse. Proposals should carry per-field schema with retry granularity. |
| `vapps/CATALOG.md` Brain Dumps | Brain dumps as AI outputs need structured editable regions. |

## Gaps surfaced

- EMA's proposals are free-text prose being approved whole. No field-level granularity, no partial-retry.

## Notes

- MCP server is MIT; the actual review UI is closed-source SaaS. **License fine for learning the data model; can't fork the UI.**
- Low stars but the pattern is novel.

## Connections

- `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]` — schema cousin
- `[[research/agent-orchestration/_MOC]]`

#research #agent-orchestration #signal-A #gotohuman #field-level-approval
