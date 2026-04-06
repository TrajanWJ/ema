# ADR 001: Reuse the Existing Native CLI

Date: 2026-04-06

## Status

Accepted

## Context

The build prompt assumes:

- `EmaCli.CLI` does not exist
- native CLI work should begin under `daemon/lib/ema_cli/`
- `mix.exs` points at that missing module

The actual repo state differs:

- `daemon/mix.exs` already points escript at `Ema.CLI`
- native CLI code already exists under `daemon/lib/ema/cli/`
- that CLI already uses Optimus and Owl and already has command modules plus HTTP/direct transports

## Decision

Extend the existing native CLI under `daemon/lib/ema/cli/` and keep `Ema.CLI` as the escript entrypoint.

Do not introduce a parallel `EmaCli.CLI` tree.

## Tradeoff

- Pros:
  - avoids duplicate command trees
  - preserves the existing escript wiring
  - lets the build continue incrementally on top of working code
- Cons:
  - diverges from the stale prompt path/module names
  - requires prompt-era docs to be updated to the real namespace

## Consequences

- Future CLI work should target `daemon/lib/ema/cli/`
- command taxonomy docs should describe `Ema.CLI`
- any later rename to `EmaCli.*` would be a deliberate follow-up refactor, not part of the initial build
