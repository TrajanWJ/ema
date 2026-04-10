# EMA CLI Compatibility Matrix

Updated: 2026-04-07
Status: first live host audit
Audit mode: A2 (must work end-to-end against live EMA/runtime data)

## Status legend
- WORKING: command produced useful output against live host EMA
- PARTIAL: command runs but has UX/help/env/runtime issues
- BROKEN: command failed in normal use
- UNVERIFIED: not tested yet in this pass

## First-pass audited commands

- ema --help :: PARTIAL
  - Produces useful top-level help
  - Emits telemetry warnings first

- ema status :: WORKING
  - Returns live dashboard output
  - Counts may still need validation against API truth

- ema brief :: BROKEN
  - Fails with Missing actor command

- ema brief --help :: BROKEN
  - Fails with Unknown option: --help

- ema wrapper via noninteractive SSH :: PARTIAL
  - Requires explicit PATH setup for mise Erlang/Elixir bins

- raw mix invocation in noninteractive SSH :: BROKEN
  - Not on PATH by default
  - Also fails until Erlang and Elixir PATH is injected

## High-confidence environment findings
- Noninteractive SSH sessions do not inherit the PATH EMA expects.
- ~/.bashrc contains required Erlang/Elixir PATH exports.
- ~/.local/bin/ema is the realistic operator entrypoint to audit.
- Telemetry startup warnings appear even on basic help/status flows.

## Next audit targets
- ema task list
- ema proposal list
- ema wiki search
- ema loop list
- ema memory list
- ema intent ...
- ema doctor ...
- ema schema ...
- ema skills ...
