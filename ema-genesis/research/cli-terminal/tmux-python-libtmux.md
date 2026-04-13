---
id: RES-libtmux
type: research
layer: research
category: cli-terminal
title: "tmux-python/libtmux — clean Server/Session/Window/Pane object model"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-f
source:
  url: https://github.com/tmux-python/libtmux
  stars: 1158
  verified: 2026-04-12
  last_activity: 2026-04-12
  license: MIT
signal_tier: A
tags: [research, cli-terminal, tmux, libtmux, automation]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[research/cli-terminal/Ark0N-Codeman]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# tmux-python/libtmux

> Python wrapper around tmux commands with the cleanest object model in this space. Server → Session → Window → Pane abstraction is directly portable to Node/TypeScript for EMA's multi-agent terminal supervision.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/tmux-python/libtmux> |
| Stars | 1,158 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **A** |
| Language | Python (architecture is portable) |
| License | MIT |

## What it is

Python wrapper around tmux commands with object-oriented Server / Session / Window / Pane model and event hooks. Reads `tmux list-*` commands, parses into POJOs, offers object methods like `pane.send_keys(...)`, `window.split_window()`, `session.kill_session()`. Much more approachable than going to tmux's raw control-mode protocol.

## What to steal for EMA

### 1. The four-level object hierarchy

```
Server          # the tmux daemon process
├─ Session      # one collaboration context (e.g., one project)
│  ├─ Window    # one logical "tab" within the session
│  │  ├─ Pane   # one pseudo-terminal split
```

For EMA: one tmux session per agent (or per project), one window per concurrent task, one pane per Claude Code instance. Persistent terminal state with scrollback. Reattachable after daemon restart.

### 2. Object methods

```python
server = libtmux.Server()
session = server.new_session("ema-agent-coder")
window = session.new_window("intent-001-implement")
pane = window.split_window()
pane.send_keys("claude --print --output-format stream-json")
output = pane.capture_pane(start=-100)
```

Direct port to TypeScript: same shape, same methods, different runtime.

### 3. Read-then-act pattern

libtmux doesn't try to maintain a live connection to tmux. It calls `tmux list-sessions`, parses, returns objects. Each object method shells out to `tmux <command>`. Stateless from the daemon's perspective. Survives daemon restarts because tmux itself is the persistent state.

This is the pattern Round 1 flagged Codeman as the only example of — libtmux is a cleaner reference.

### 4. Hook events

Hooks like `session-created`, `window-pane-changed` give you a notification API for when tmux state changes. EMA can subscribe to these to update the Agent Live View vApp without polling.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `AGENT-RUNTIME.md` | Specify a libtmux-inspired Node wrapper for agent session management. Round 1 only had Codeman as a concrete example; libtmux's object model is cleaner. |
| `vapps/CATALOG.md` Agent Live View | Persistent panes per agent with scrollback, reattachable across daemon restarts |
| `[[_meta/SELF-POLLINATION-FINDINGS]]` | The old `Ema.Agents.AgentWorker` GenServer spawns Claude CLI directly with no persistent terminal state. Replace with a libtmux-shaped wrapper. |

## Gaps surfaced

- **EMA's old AgentWorker has no persistent terminal state.** If Claude asks "what did you run last?", there's no shell history. A libtmux-shaped layer gives every agent a persistent pane with scrollback.
- **No reattach-after-crash story** for agent sessions. tmux already solves this; EMA just needs the wrapper.

## Notes

- Python not TypeScript, but **the Server/Session/Window/Pane POJO pattern is a blueprint**, not a library you depend on.
- ~500 LOC of core model. Port to TypeScript directly.
- Round 1's "only Codeman matched this" gap is filled by libtmux as the architectural reference + Codeman as the production reference.

## Connections

- `[[research/cli-terminal/_MOC]]`
- `[[research/cli-terminal/Ark0N-Codeman]]` — production reference using the same pattern
- `[[research/cli-terminal/microsoft-node-pty]]` — the lower-level alternative (no tmux multiplexing)
- `[[canon/specs/AGENT-RUNTIME]]`
- `[[_meta/SELF-POLLINATION-FINDINGS]]`

#research #cli-terminal #signal-A #libtmux #tmux #agent-sessions
