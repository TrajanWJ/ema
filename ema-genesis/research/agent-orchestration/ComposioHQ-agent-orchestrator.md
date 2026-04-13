---
id: RES-ComposioHQ-agent-orchestrator
type: research
layer: research
category: agent-orchestration
title: "ComposioHQ/agent-orchestrator — 7-slot plugin architecture for fleet management"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/ComposioHQ/agent-orchestrator
  stars: 6175
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, agent-orchestration, signal-S, plugin-arch, fleet]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/generalaction-emdash]]", relation: references }
  - { target: "[[research/agent-orchestration/jayminwest-overstory]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# ComposioHQ/agent-orchestrator

> **The cleanest plugin architecture in the agent-orchestration space.** 6.2k stars, daily commits, 7 swappable interface slots. Adopt the vocabulary before designing EMA's own.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/ComposioHQ/agent-orchestrator> |
| Stars | 6,175 (verified 2026-04-12) |
| Last activity | 2026-04-12 (extremely active) |
| Signal tier | **S** |
| Language | TypeScript |

## What to steal

### 1. The 7-slot plugin architecture

Composio splits the orchestrator into 7 swappable slots:

| Slot | Purpose |
|---|---|
| **Runtime** | How agents are launched (tmux, docker, ssh) |
| **Agent** | Which CLI agent runs (Claude Code, Codex, Aider) |
| **Workspace** | Where the agent works (worktree, container, shared dir) |
| **Tracker** | What state is tracked (issues, PRs, custom) |
| **SCM** | Source control integration (git, jujutsu, etc.) |
| **Notifier** | Where notifications go (Slack, Discord, email) |
| **Terminal** | How the terminal renders (xterm.js, Hyper, etc.) |

EMA should adopt this vocabulary and the slot concept. Each slot is a pluggable interface; new providers ship as PluginModules.

### 2. CI feedback loop event vocabulary

Composio defines reaction states: `ci-failed`, `changes-requested`, `approved-and-green`. Auto-retry with `escalateAfter` config. EMA's Execution schema should add these states + retry policy.

### 3. Worktree-per-agent isolation

Each agent gets its own git worktree. No two agents edit the same file at the same time. Cleaner than file-locking (`[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]`'s pattern) for parallel coding work.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Replace bespoke adapter design with the 7-slot plugin table. Add "Workspace Isolation" section (currently unspecified). |
| `BLUEPRINT-PLANNER.md` | CI-feedback-loop states (auto-retry with escalateAfter) become part of EMA's Execution schema. |

## Gaps surfaced

- **EMA's current Execution model is "dispatch → done."** Composio proves you need explicit states for CI failure retry, review escalation, and approval-and-merge. EMA models none.
- **Canon doesn't say whether agents get isolated filesystems.** AGENT-RUNTIME implies they share the project dir, which breaks under parallel execution.

## Notes

- 6k stars, daily commits, most mature fleet-management design in the space.
- No SSH/remote support — `[[research/agent-orchestration/generalaction-emdash]]` beats it there.
- TypeScript codebase — direct read for EMA's stack.

## Connections

- `[[research/agent-orchestration/generalaction-emdash]]` — alternative with SSH
- `[[research/agent-orchestration/jayminwest-overstory]]` — hierarchical alternative
- `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]` — file-lock alternative
- `[[canon/specs/AGENT-RUNTIME]]`

#research #agent-orchestration #signal-S #composio #plugin-arch #fleet
