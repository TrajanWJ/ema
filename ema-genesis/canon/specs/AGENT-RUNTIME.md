---
id: CANON-AGENT-RUNTIME-SPEC
type: spec
layer: canon
title: "Agent Runtime — Full Specification"
status: active
created: 2026-04-11
updated: 2026-04-11
connections:
  - { target: INT-003, relation: references }
tags: [agent, runtime, puppeteer, xterm, spec, deep-dive]
---

# Agent Runtime — Full Specification

> Deep-dive spec for EMA's agent runtime — the spine of the system.

## Architecture

The agent runtime is a **puppeteer-style terminal emulator** that virtualizes
CLI agent sessions inside Electron. It is NOT a network proxy or protocol
interceptor. It controls agents the way puppeteer controls browsers — by
automating a real terminal session.

```
Electron (main process)
├─ node-pty ──── spawns real shell processes (pseudoterminals)
├─ tmux ──────── session multiplexing, one session per agent
└─ Agent Runtime Controller
   ├─ Detects installed CLI agents
   ├─ Launches agents in tmux sessions
   ├─ Reads terminal output (stdout stream)
   ├─ Injects commands / context (stdin writes)
   ├─ Records all I/O (session log + replay data)
   ├─ Enforces approval gates
   └─ Syncs state to P2P network

Electron (renderer process — per Agent Live View window)
└─ xterm.js ──── renders the live terminal in a BrowserWindow
   ├─ Attach mode: watch agent work in real-time
   ├─ Replay mode: play back recorded sessions
   └─ Search mode: search through session logs
```

## Agent Lifecycle

```
DETECT ──▶ CONFIGURE ──▶ LAUNCH ──▶ WORK ──▶ REPORT ──▶ IDLE
  │           │             │         │          │         │
  │           │             │         │          │         └─ Wait for
  │           │             │         │          │            next dispatch
  │           │             │         │          │
  │           │             │         │          └─ Write results
  │           │             │         │             to canon/exec
  │           │             │         │
  │           │             │         └─ Execute inside tmux
  │           │             │            session with sudo
  │           │             │
  │           │             └─ Start tmux session
  │           │                Launch CLI agent inside
  │           │
  │           └─ Ingest config dirs
  │              Set permissions per space
  │              Configure auto-approve level
  │
  └─ Scan for installed CLI agents
     Check: claude, codex, cursor CLI
     Read: .claude/, .cursor/, .superpowers/
```

## Wrapping Specific Agents

### Claude Code

```
Detection:  which claude || ~/.claude/bin/claude
Config dir: ~/.claude/
History:    ~/.claude/projects/*/
Launch:     tmux new-session -d -s ema-claude "claude --project <path>"
Control:    Read stdout, inject via stdin, parse structured output
```

### Codex (OpenAI)

```
Detection:  which codex
Config dir: ~/.codex/ (or equivalent)
Launch:     tmux new-session -d -s ema-codex "codex <args>"
Control:    Same pattern — stdout/stdin over pty
```

### Future Agents

Any CLI agent that runs in a terminal can be wrapped. The pattern is:
1. Detect binary on PATH or in known locations
2. Find and ingest config/history directory
3. Launch in tmux session
4. Control via pty stdin/stdout

## Cross-Machine Dispatch

```
Local Machine                    Remote Machine (in P2P network)
├─ EMA Agent Runtime             ├─ EMA instance running
│  └─ Agent wants to run         │  └─ Receives dispatch request
│     command on Remote          │     └─ Spawns tmux session
│     └─ ema machine exec       │        └─ Runs command
│        remote-id "cmd"         │        └─ Streams output back
│        └─ SSH tunnel ──────────┤
│           to Remote            │
```

## Session Recording Format

Each agent session produces:

```
sessions/
└─ <session-id>/
   ├─ meta.yaml          # Session metadata (agent, space, intent, timestamps)
   ├─ recording.cast     # asciinema-compatible terminal recording
   ├─ log.txt            # Plain text I/O log (searchable)
   ├─ commands.json      # Extracted commands executed (structured)
   └─ context.yaml       # What context was injected during session
```

## Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Terminal emulation | xterm.js | Render terminal in Electron BrowserWindow |
| Process spawning | node-pty | Create pseudoterminals in Node.js |
| Session management | tmux | Multiplex, persist, and manage sessions |
| Session recording | asciinema format | Replayable terminal recordings |
| SSH | ssh2 (npm) | Cross-machine dispatch and remote execution |

---

*This spec is a canon node. Updated via the proposal/execution pipeline.*
