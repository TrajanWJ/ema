---
id: RES-oclif
type: research
layer: research
category: cli-terminal
title: "oclif/oclif — TypeScript CLI framework with topic-based noun-verb command trees"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/oclif/oclif
  stars: 9478
  verified: 2026-04-12
  last_activity: 2026-04-07
  license: MIT
signal_tier: S
tags: [research, cli-terminal, signal-S, oclif, cli-framework, noun-verb]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
---

# oclif/oclif

> Open-source TypeScript CLI framework from Heroku/Salesforce. **Topic-based noun-verb command trees**, plugin system, auto-generated help. The right choice for EMA's `ema <noun> <verb>` CLI.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/oclif/oclif> |
| Stars | 9,478 (verified 2026-04-12) |
| Last activity | 2026-04-07 |
| Signal tier | **S** |
| License | MIT |
| Production users | Heroku CLI (~100 topics) |

## What to steal

### 1. Topic-based directory convention

```
src/commands/
├── intent/
│   ├── create.ts    → ema intent create
│   ├── list.ts      → ema intent list
│   └── view.ts      → ema intent view
├── proposal/
│   ├── create.ts    → ema proposal create
│   └── approve.ts   → ema proposal approve
└── ...
```

`ema task create` becomes `src/commands/task/create.ts`. Scales cleanly to 30+ commands without a god-file.

### 2. Plugin system

Plugins are npm packages. When EMA grows to "each vApp registers its own CLI verbs," oclif's plugin system is exactly that pattern. Heroku CLI has dozens of plugins.

### 3. `@oclif/core` vs `@oclif/oclif` split

`@oclif/core` is the runtime. `@oclif/oclif` is the generator. EMA depends on the small lib in production and uses the generator only at dev time.

### 4. Built-in `--json` mode

Every command supports `--json` for structured output. **EMA's CLI should never deviate from this.** It enables the daemon to invoke its own CLI as a subprocess and parse structured output.

### 5. Auto-generated help + completions

`ema help`, `ema task --help`, shell completions for bash/zsh/fish — all generated from command metadata. Zero maintenance.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §4` | Pin oclif as the CLI framework. Add rule: "every command must support `--json` for daemon self-invocation." |
| `[[canon/specs/EMA-V1-SPEC]]` §2 CLI | The CLI is mentioned as a peer but has no framework. Pick oclif. |

## Gaps surfaced

- The CLI architecture is a black box in canon. Just "ema <noun> <verb>." No framework, no plugin story, no JSON contract, no help generation strategy.

## Notes

- Commander.js (28k stars) is the alternative — simpler, but falls over past ~20 commands in a flat structure. Oclif wins as EMA scales.
- 9.5k stars, MIT, mature. Production-tested at Salesforce scale.

## Connections

- `[[research/cli-terminal/_MOC]]`
- `[[canon/specs/EMA-V1-SPEC]]` §11 question 5 (CLI framework)
- `[[canon/specs/AGENT-RUNTIME]]`

#research #cli-terminal #signal-S #oclif #cli-framework
