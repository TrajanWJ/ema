# Runtime Fabric

`runtime-fabric` is the active EMA backend subsystem for local coding-agent control.

## Name

- Backend subsystem: `runtime-fabric`
- User-facing app: `Terminal`
- CLI surface: `ema runtime ...`

This deliberately replaces the ambiguous older cluster of `Sessions`, `Claude Bridge`,
`Agent Bridge`, and `Cli Manager` as the current runtime/session truth.

## What It Actually Owns

- local tool detection for auth-backed coding CLIs already installed on the machine
- tmux-backed managed session launch
- discovery of external tmux sessions already running outside EMA
- terminal screen capture from tmux panes
- derived runtime-state classification over observed pane output
- durable session activity/events for managed sessions
- input relay into sessions
- simulated typing versus paste-buffer injection
- one-shot prompt dispatch into new or existing sessions

## Source Of Truth

- Live runtime truth
  - tmux sessions and panes
  - local CLI binaries and their existing OAuth/config state
- Durable operational mirror
  - `sqlite:runtime_fabric_tools`
  - `sqlite:runtime_fabric_sessions`
- Interface surfaces
  - `/api/runtime-fabric/*`
  - `ema runtime ...`
  - renderer `Terminal` app

## What Works Now

- scan installed tools such as `claude`, `codex`, `gemini`, `aider`, and shell
- detect whether a local config dir exists and looks configured
- launch a managed tmux session for a selected tool
- dispatch an initial prompt at launch time
- list and inspect managed sessions
- discover attachable external tmux sessions running recognized tools
- capture the full tmux pane tail into a real xterm.js renderer in the Terminal app
- classify sessions into working / idle / blocked / context-full / error-like runtime states
- record managed session activity events such as launch, dispatch, input, key sends, state changes, and stop
- send text by paste-buffer or simulated typing
- send control keys such as `Enter` and `Ctrl-C`
- stop managed sessions

## Current UI Shape

The Terminal app is now intentionally separate from the rest of EMA’s UI language.
It is the one surface that should feel closer to a cmux-style terminal workspace:

- launch/control rail on the left
- live terminal workspace in the center
- runtime inspector and activity feed on the right
- xterm.js renderer for the visible terminal surface
- session filtering, keyboard navigation, and explicit stale-session forget controls

That product model is active now even though the transport is still tmux-first rather than node-pty-first.

## What Is Still Deferred

- node-pty transport
- xterm.js rendering and ANSI-accurate live streaming
- asciinema/replay artifacts
- Windows ConPTY transport
- direct execution-ledger coupling and dispatcher ownership
- actor runtime-state registration on top of real session output

## Guidance For Future Agents

- Build runtime features on `runtime-fabric`, not on the stale bridge/session shells.
- Treat tmux as the current live runtime substrate until a deliberate migration lands.
- Keep session control explicit. Do not hide dispatch, input relay, or attachment behind opaque orchestration.
- If xterm.js or node-pty is added later, preserve the current route and entity contract where possible.
