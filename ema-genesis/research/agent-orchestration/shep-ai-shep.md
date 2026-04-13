---
id: RES-shep
type: research
layer: research
category: agent-orchestration
title: "shep-ai/shep — readable reference implementation for parallel agent CLI"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/shep-ai/shep
  stars: 126
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: B
tags: [research, agent-orchestration, signal-B, shep, seed-repo, readable-reference]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]", relation: references }
  - { target: "[[research/agent-orchestration/roboticforce-sugar]]", relation: references }
---

# shep-ai/shep

> User-flagged seed repo. Worktree-per-agent + prompt→PR pipeline. **Use as the small-enough-to-read version** of `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]`.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/shep-ai/shep> |
| Stars | 126 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **B** |

## What to steal

shep is directionally right but `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]` (6.2k stars) is the same idea at 50× the maturity. Treat shep as the "read-the-code-it's-small-enough-to-understand" version and Composio as the production target.

Specifically: read shep's TypeScript prompt→PR pipeline end to end. It's the fastest way to internalize the pattern before reading Composio.

## Changes canon

No new canon changes beyond what Composio already drives. Use shep as a readable reference implementation.

## Gaps surfaced

Compared to Composio, shep is missing the plugin-slot abstraction. **Demonstration that "if you build one-off, you end up with Composio's architecture anyway after six months."**

## Notes

- One of the user's seed repos for cross-pollination research.
- Read it as a teaching example, not as a production target.

## Connections

- `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]` — production target
- `[[research/agent-orchestration/roboticforce-sugar]]` — cousin seed
- `[[research/agent-orchestration/_MOC]]`

#research #agent-orchestration #signal-B #shep #seed-repo
