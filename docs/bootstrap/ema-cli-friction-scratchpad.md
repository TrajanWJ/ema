# EMA CLI Friction Scratch Pad

Updated: 2026-04-07
Status: active scratch pad

## Friction points observed in first live audit

### 1. Noninteractive shell environment is not CLI-ready
- mix is not on PATH in a plain SSH session.
- Elixir exists but cannot find erl unless PATH is manually seeded.
- This means the developer/operator experience is fragile outside the fully prepared interactive shell.

### 2. EMA wrapper is the real entrypoint, but docs should say so more clearly
- ~/.local/bin/ema works once PATH is set correctly.
- Raw mix execution is not a realistic default operator path.

### 3. Telemetry warnings pollute basic CLI flows
- ema --help
- ema status
- ema brief
all emitted telemetry warnings before or alongside output.

### 4. Help UX is inconsistent
- top-level ema --help works
- ema brief --help fails with Unknown option: --help
- likely subcommand help behavior is inconsistent or missing

### 5. ema brief is not functionally usable in normal invocation
- current output: Missing actor command
- this is a high-priority friction point because brief is a flagship UX surface

### 6. Status works, but trust still needs validation
- ema status returns a dashboard
- counts were all zero in this invocation, which may reflect reality or disconnected data
- this should later be cross-checked against API and runtime truth

## Immediate doc implications
- mark brief as broken
- mark brief help as broken
- mark top-level help as partial
- mark status as working-first-pass
- explicitly document shell and PATH requirements for host CLI use
