# ADR 002: Defer Ratatouille Until the Termbox Dependency Is Replaced or Patched

Date: 2026-04-06

## Status

Accepted

## Context

The build prompt calls for:

- `{:owl, "~> 0.12"}`
- `{:ratatouille, "~> 0.6"}`
- `{:ex_termbox, "~> 1.0"}`

Repo reality:

- `owl` already compiles and is already in use by the native CLI
- the published Ratatouille version is `~> 0.5.1`, not `~> 0.6`
- after correcting that constraint, `ex_termbox` still fails to build on this machine

Observed build failure:

- `ex_termbox` invokes a waf toolchain that imports Python's removed `imp` module
- this host has Python 3.12
- result: TUI dependencies break `mix compile`

## Decision

Do not keep Ratatouille/ExTermbox in `mix.exs` until there is a working dependency strategy.

Defer TUI dependency introduction until one of these happens:

- patch or vendor `ex_termbox` for Python 3.12 compatibility
- replace Ratatouille/ExTermbox with a maintained terminal stack
- build the first TUI slice against a different runtime approach

## Tradeoff

- Pros:
  - keeps the daemon build green
  - avoids blocking CLI and schema work on a broken terminal dependency
- Cons:
  - delays the TUI track
  - forces a dependency decision before Phase 4 can begin

## Consequences

- CLI and actor/container work can proceed immediately
- TUI work is blocked on dependency strategy, not on application architecture
