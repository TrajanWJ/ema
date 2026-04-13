---
id: RES-asciinema-player
type: research
layer: research
category: cli-terminal
title: "asciinema/asciinema-player — drop-in player for terminal session replay"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/asciinema/asciinema-player
  stars: 2876
  verified: 2026-04-12
  last_activity: 2026-04-05
signal_tier: A
tags: [research, cli-terminal, signal-A, asciinema, session-replay]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[research/cli-terminal/microsoft-node-pty]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# asciinema/asciinema-player

> Web player for asciinema `.cast` recordings. **Drop-in for vApp 23 (Agent Live View) replay mode.** AGENT-RUNTIME canon already names the format; this is the playback half.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/asciinema/asciinema-player> |
| Stars | 2,876 (verified 2026-04-12) |
| Last activity | 2026-04-05 |
| Signal tier | **A** |

## What to steal

### 1. Embed the player directly

The player is a JS/CSS component that plays back v2 cast files with seek, speed control, and marker support. **Embed it in vApp 23 (Agent Live View) replay mode.** No need to build your own.

### 2. The v2 cast format

Simple JSONL with timestamped stdin/stdout events. EMA can produce cast files **directly from the node-pty `onData` callback** in <50 lines of TypeScript:

```typescript
const recording = fs.createWriteStream('session.cast');
recording.write(JSON.stringify({
  version: 2,
  width: 80,
  height: 30,
  timestamp: Date.now() / 1000,
  env: { TERM: 'xterm-256color', SHELL: '/bin/bash' }
}) + '\n');

const start = Date.now();
proc.onData((data) => {
  const elapsed = (Date.now() - start) / 1000;
  recording.write(JSON.stringify([elapsed, "o", data]) + '\n');
});
```

### 3. Marker support

The player supports markers — annotate recordings with "approval granted here", "error at T+3.2s", etc. EMA can embed these for jump-to-event navigation.

### 4. Skip asciinema (the recorder)

`asciinema/asciinema` (17k stars, Rust) is the recorder binary. EMA can skip it and produce cast files directly from node-pty since it already controls the session.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` Session Recording Format | Add concrete ingestion path: node-pty onData → cast writer → recording.cast |
| `vapps/CATALOG.md` Agent Live View | Embed asciinema-player for replay mode |

## Gaps surfaced

- Canon names the format but doesn't say how recordings are produced OR played back. Both halves are unspecified.

## Notes

- Drop-in for replay. Producing cast files is trivial.
- No reason to invent a format.

## Connections

- `[[research/cli-terminal/microsoft-node-pty]]` — produces the data
- `[[research/cli-terminal/Ark0N-Codeman]]` — production reference
- `[[canon/specs/AGENT-RUNTIME]]`

#research #cli-terminal #signal-A #asciinema #session-replay
