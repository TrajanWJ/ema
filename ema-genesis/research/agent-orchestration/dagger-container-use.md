---
id: RES-container-use
type: research
layer: research
category: agent-orchestration
title: "dagger/container-use — per-agent Dagger containers + git worktrees over MCP"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/dagger/container-use
  stars: 3712
  verified: 2026-04-12
  last_activity: 2026-02-23
signal_tier: A
tags: [research, agent-orchestration, signal-A, container-use, dagger, isolation]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/generalaction-emdash]]", relation: references }
  - { target: "[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]", relation: references }
---

# dagger/container-use

> Per-agent Dagger containers + git worktrees exposed over MCP. Stronger isolation than worktree-only — prevents "agent breaks my node_modules." EMA could **depend on container-use** instead of building its own container layer.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/dagger/container-use> |
| Stars | 3,712 (verified 2026-04-12) |
| Last activity | 2026-02-23 (active but slowing) |
| Signal tier | **A** |

## What to steal

### 1. The container-per-agent isolation tier

Beyond worktree isolation: each agent runs in its own Dagger container with its own filesystem, dependencies, and process tree. Conflicting installs (Node 18 vs Node 22) are no problem.

### 2. MCP interface

Container-use exposes its functionality over MCP. Any MCP-capable agent can use it. **EMA could orchestrate container-use from the dispatcher rather than building its own container layer.** Dependency, not rewrite.

### 3. Isolation tier ladder

Container-use defines isolation tiers EMA canon doesn't:
1. Same process (current EMA agent runtime)
2. Worktree (`[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]`)
3. Container (this repo)
4. SSH-remote (`[[research/agent-orchestration/generalaction-emdash]]`)

Pick the right tier per task.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Add "Isolation Tiers" section with the four-tier ladder |

## Gaps surfaced

- EMA assumes worktree = isolation. Container-use proves there are stronger isolation levels and that agents regularly need them (e.g., conflicting dependencies). EMA has no story for "agent A needs Node 18, agent B needs Node 22."

## Notes

- Commit slowdown since February is notable but not dead. Dagger is a funded company.
- Good candidate for "depend on this, don't clone it."

## Connections

- `[[research/agent-orchestration/generalaction-emdash]]`
- `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]`
- `[[canon/specs/AGENT-RUNTIME]]`

#research #agent-orchestration #signal-A #container-use #dagger #isolation
