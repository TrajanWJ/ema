---
id: FRONTEND-TASK-MASTER-PATTERNS
type: research
layer: research
title: "task-master patterns — 6 concrete steals for the execution system"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/top-steals-from-task-master-concrete-with-elixir-translati/"
recovered_at: 2026-04-12
source: "task-master (GitHub reference — exact repo TBD)"
signal_tier: Port
connections:
  - { target: "[[research/frontend-patterns/_MOC]]", relation: parent }
  - { target: "[[intents/INT-TASK-MASTER-STEALS]]", relation: source }
  - { target: "[[canon/specs/EXECUTION-SYSTEM]]", relation: references }
tags: [research, task-master, execution-system, dependency-graph, loop-presets, preliminary]
---

# task-master Patterns

> **Note:** This is a research node accompanying [[intents/INT-TASK-MASTER-STEALS]]. The intent captures the *work* of porting the patterns. This node captures the *patterns themselves* so they can be referenced independently.

## The six patterns

### 1. Task dependency graph

- Add `dependencies: string[]` field to Task schema (array of task IDs this task blocks on)
- `DependencyGraph` module with:
  - `build_blocks_map(tasks) → Map<task_id, blocked_by_ids[]>`
  - `filter_ready(tasks) → tasks[]` (only tasks whose dependencies are all complete)
- Enables topological task ordering without extra infrastructure

### 2. Workflow state machine

- Execution phases are **serializable** (JSON-persistable on every state change)
- Guard conditions on transitions prevent invalid moves (`running → complete` only if success criteria met)
- Auto-persistence on every state change (no explicit save)
- Attempt counting for bounded retry logic

### 3. Loop presets (named autonomous loops)

Five presets the system ships:

| Preset | Purpose |
|---|---|
| `default` | General-purpose loop — no specialization |
| `test-coverage` | Runs until test coverage target met |
| `entropy` | Runs until system entropy metric drops below threshold |
| `proposals` | Runs the proposal pipeline end-to-end once |
| `brain-dump-triage` | Processes brain dump inbox until empty or timeout |

Each preset is a structured prompt template for autonomous Claude runs. User invokes via `ema loop <preset>`.

### 4. Preflight checker

Validates the environment before dispatching any execution:
- Daemon running?
- Required env vars set?
- Vault accessible?
- No pending migrations?
- Disk space available?

Fails fast — better than dispatching into a broken state and failing mid-run.

### 5. MCP `withToolContext` wrapper

Centralized error handling for MCP tool calls. Every tool invocation is wrapped in a shared try/catch that produces a standardized error format (same shape for every tool). Prevents tool-by-tool error handling drift.

### 6. CLI command registry with categories

CLI commands register themselves with metadata:
```
{ name, category, description, examples, aliases }
```
Used for:
- Help generation (`ema help` shows categories)
- Tab completion (complete command names within a category)
- Discoverability (`ema help intents` shows all intent commands)

## Why steal these

None of the six are EMA-original. They're all pulled from an external `task-master` project that happened to get them right. Porting is a matter of translating shape, not inventing logic. Low risk, high value, each closes a specific gap in the execution/CLI/MCP surface.

## Gaps / open questions

- **task-master repo identity.** "task-master" is a common name. The old intent doesn't specify the repo. Candidate: claude-task-master or similar. Needs a targeted lookup.
- **Elixir translations.** Original intent said "with Elixir translations" — those translations existed in commit history or local notes that weren't recovered. Needs extraction or reimplementation in TS.
- **Loop preset "entropy" metric.** What does entropy measure in this context? System state variability? Unprocessed brain dumps? Stale intents? Needs definition before implementation.
- **Preflight scope.** Per-execution (run before every dispatch) or per-session (run once at daemon start)? Probably the former for safety, but expensive.

## Related

- [[intents/INT-TASK-MASTER-STEALS]] — the work intent
- [[canon/specs/EXECUTION-SYSTEM]] — the system these patterns port into
- [[research/frontend-patterns/_MOC]] — parent

#research #task-master #patterns #execution-system #preliminary
