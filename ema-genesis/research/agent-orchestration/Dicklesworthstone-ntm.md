---
id: RES-ntm
type: research
layer: research
category: agent-orchestration
title: "Dicklesworthstone/ntm — Named Tmux Manager with mixed-provider swarms + Agent Mail"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/Dicklesworthstone/ntm
  stars: 236
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: A
tags: [research, agent-orchestration, signal-A, ntm, tmux, agent-mail, multi-provider]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]", relation: references }
---

# Dicklesworthstone/ntm (Named Tmux Manager)

> Spawns mixed swarms (Claude/Codex/Gemini) across panes with broadcast prompts, interrupts, **Agent Mail**, and file reservations. Sibling to `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]` and `[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]`.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/Dicklesworthstone/ntm> |
| Stars | 236 (verified 2026-04-12) |
| Last activity | 2026-04-12 (extremely active) |
| Signal tier | **A** |

## What to steal

### 1. Agent Mail — first-class agent-to-agent messaging

Structured messaging distinct from direct pane output. Messages have types, senders, recipients. Agent A can send a message to Agent B without coupling to B's terminal.

EMA's actor system has no messaging primitive — just shared state. NTM proves there's value in explicit typed messages alongside shared state.

### 2. File reservations (cooperative locking)

Softer than hard JSON locks (`[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]`'s pattern). Agents declare intent to edit a file; conflicts surface immediately but don't block. Closer to optimistic concurrency than pessimistic locks.

### 3. Mixed-provider spawn command

```bash
ntm spawn payments --cc=3 --cod=2 --gmi=1
```

Spawns 3 Claude Code + 2 Codex + 1 Gemini in one project session. Provider-diverse team per project. EMA's project launcher should support this — multiple providers co-launched into one space.

### 4. Broadcast primitives

```bash
ntm broadcast --all "stop and review your work"
ntm broadcast --cc "focus on tests"
```

EMA has no broadcast-to-all-agents primitive. NTM's `--all` and `--cc` filters show this is a core operator need, not a nice-to-have.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md` | Document the "mixed-provider swarm" pattern. Multiple providers per project, not one. |
| `AGENT-RUNTIME.md` | Add Agent Mail as a primitive distinct from pane output. Add broadcast operators. |

## Gaps surfaced

- EMA's current model launches one agent at a time. NTM proves users want to spawn a provider-diverse team per project.
- EMA has no broadcast-to-all-agents primitive.

## Notes

- Same author cluster as CASS and claude_code_agent_farm. The whole Dicklesworthstone stack is a de-facto suite that does most of what EMA wants minus the wiki layer.

## Connections

- `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]`
- `[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]`
- `[[canon/specs/AGENT-RUNTIME]]`

#research #agent-orchestration #signal-A #ntm #tmux #agent-mail
