---
id: RES-claude_code_agent_farm
type: research
layer: research
category: agent-orchestration
title: "Dicklesworthstone/claude_code_agent_farm — JSON file-lock coordination + LLM-enforced contracts"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/Dicklesworthstone/claude_code_agent_farm
  stars: 780
  verified: 2026-04-12
  last_activity: 2026-04-06
signal_tier: A
tags: [research, agent-orchestration, signal-A, file-lock, agent-state-machine]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-ntm]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# Dicklesworthstone/claude_code_agent_farm

> Python orchestrator running 20-50 Claude Code agents in parallel tmux panes. **JSON file-lock coordination** + heartbeat tracking + adaptive idle timeouts. The lock protocol is enforced **in the prompt**, not in code — clever and dirt-cheap to port.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/Dicklesworthstone/claude_code_agent_farm> |
| Stars | 780 (verified 2026-04-12) |
| Last activity | 2026-04-06 |
| Signal tier | **A** |

## What to steal

### 1. The `/coordination/` directory protocol

```
/coordination/
├── active_work_registry.json    # which agent is editing which file
├── agent_locks/                  # one file per locked file
│   ├── src_app_tsx.lock         # contains: {agent_id, expires_at}
│   └── ...
├── completed_work_log.json       # audit trail
└── planned_work_queue.json       # next-up work
```

EMA can copy this directly. SQLite is overkill for the 5-50 file scenario; JSON files in a `/coordination/` dir do the job.

### 2. 2-hour stale-lock detection

Locks have a TTL. After 2 hours of no heartbeat, the lock auto-expires and can be claimed by another agent. EMA needs the same — locks without TTL are worse than no locks.

### 3. Lock protocol enforced IN THE PROMPT

```markdown
SYSTEM RULES
============
Before editing any file:
1. Check /coordination/agent_locks/ for an existing lock on the file
2. If locked, work on something else
3. If unlocked, create a lock file: {agent_id, expires_at}
4. Edit the file
5. Update /coordination/completed_work_log.json
6. Delete the lock file

If you violate this protocol, you waste tokens and break other agents' work.
```

The LLM enforces the contract. **Zero coordination code.** This is genius and EMA should consider it for low-stakes coordination.

### 4. Heartbeat + state classifier

Per-tick polling of tmux pane content with state classification: `working / idle / blocked / error`. Adaptive idle timeouts based on work patterns. EMA's old `Ema.Agents.AgentWorker` has none of this.

### 5. Context-window tracking

Tracks Claude Code's context fill % per agent. Auto-triggers `/compact` at 110k and `/clear` at 140k tokens. EMA should do the same — passive context management for long-running agents.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Add Agent State Machine section (idle/working/blocked/error/context-full). Add Heartbeat Loop. Add Concurrent Agent Coordination via JSON file locks. |
| `EMA-GENESIS-PROMPT.md §4` | Currently DETECT→LAUNCH→WORK→REPORT→IDLE. Doesn't distinguish "waiting for approval" from "crashed" from "context full" from "idle." Expand. |

## Gaps surfaced

- No state machine beyond DETECT→LAUNCH→WORK→REPORT→IDLE
- No protocol for concurrent agents touching the same repo
- No context-window tracking per agent

## Notes

- Python not TS, but the patterns transfer cleanly.
- Same author as ntm and CASS — Dicklesworthstone is building a whole suite.
- The prompt-based lock protocol is the most interesting idea — zero code, LLM enforces.

## Connections

- `[[research/agent-orchestration/Dicklesworthstone-ntm]]` — sibling project
- `[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]` — sibling project
- `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]` — alternative coordination model
- `[[canon/specs/AGENT-RUNTIME]]`

#research #agent-orchestration #signal-A #file-lock #agent-state-machine
