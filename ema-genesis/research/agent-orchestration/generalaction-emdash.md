---
id: RES-emdash
type: research
layer: research
category: agent-orchestration
title: "generalaction/emdash — YC W26 desktop app wrapping 23 coding agent CLIs with SSH remote"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/generalaction/emdash
  stars: 3828
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: S
tags: [research, agent-orchestration, signal-S, emdash, ssh, multi-provider]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]", relation: references }
  - { target: "[[research/agent-orchestration/dagger-container-use]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# generalaction/emdash

> **Highest direct competitor to EMA's terminal-runtime layer.** YC W26 startup, 3.8k stars, 23-provider catalog, SSH remote execution. EMA differentiates on the wiki/research layer; the terminal layer is a crowded space.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/generalaction/emdash> |
| Stars | 3,828 (verified 2026-04-12) |
| Last activity | 2026-04-11 (extremely active) |
| Signal tier | **S** |
| Backed by | Y Combinator W26 |

## What to steal

### 1. The 23-provider adapter catalog

emdash supports Claude Code, Codex, Cursor CLI, Gemini, Aider, Cline, Amp, OpenInterpreter, etc. — 23 providers as of April 2026. This is dramatically broader than EMA canon's "Claude Code, Codex, Cursor CLI" trio. Steal the adapter catalog directly as EMA's target list.

### 2. SSH-based remote execution path

Three modes: SSH-agent-auth, key-auth, password-auth. Worktree mirroring between local and remote so the agent's filesystem matches. **EMA's cross-machine dispatch story (canon: "SSH tunnel") gains a real implementation reference.**

### 3. Provider-agnostic adapter pattern

Single adapter interface; each provider implements `detect`, `launch`, `read_output`, `inject_command`, `kill`. EMA should mirror this exactly so adding a new agent type is a 200-LOC PR, not an architectural change.

### 4. Keychain credential storage

OS keychain for API keys. EMA's Bridge currently has `cost_tracker.ex` but no first-class secrets storage; emdash's pattern is the right one.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Add "Remote Execution" section documenting SSH-agent-auth vs key vs password (port emdash's three-mode approach) |
| `BLUEPRINT-PLANNER.md` | The 23-provider adapter list should become EMA's target catalog; the canon "Claude Code, Codex, Cursor CLI" trio is too narrow |

## Gaps surfaced

- EMA canon doesn't yet specify HOW cross-machine dispatch works at the protocol level. emdash proves SSH + worktree mirroring is viable. Canon currently says "Tailscale + something" — that's not a spec.
- No keychain storage layer in EMA canon.

## Notes

- **Biggest competitive risk in this space.** emdash could eat EMA's lunch in terminal wrapping. Differentiate on the wiki/research layer or lose.
- 3.8k stars, daily commits, YC-funded. Production-grade.

## Connections

- `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]` — alternative with plugin slots
- `[[research/agent-orchestration/dagger-container-use]]` — container-isolation alternative
- `[[research/cli-terminal/Ark0N-Codeman]]` — minimal in-house equivalent
- `[[canon/specs/AGENT-RUNTIME]]`

#research #agent-orchestration #signal-S #emdash #ssh #multi-provider
