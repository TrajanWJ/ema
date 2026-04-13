---
id: INT-TASK-MASTER-STEALS
type: intent
layer: intents
title: "Task-master top steals — 6 concrete patterns to port into the execution system"
status: preliminary
kind: port
phase: discover
priority: medium
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/top-steals-from-task-master-concrete-with-elixir-translati/"
recovered_at: 2026-04-12
original_author: human
exit_condition: "All 6 patterns are either ported to TS or explicitly declined with a reason: (1) Task dependency graph with DependencyGraph module. (2) Workflow state machine with guards + auto-persistence + attempt counting. (3) Loop presets for autonomous Claude loops (5 named presets). (4) Preflight environment checker. (5) MCP withToolContext wrapper for centralized error handling. (6) CLI command registry with categories."
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[intents/INT-FEEDBACK-LOOP-INTEGRATION]]", relation: sibling }
tags: [intent, port, task-master, patterns, dependency-graph, loop-presets, recovered, preliminary]
---

# INT-TASK-MASTER-STEALS

## Original intent text (verbatim)

> TOP STEALS from task-master (concrete, with Elixir translations): 1) Task dependency graph — add dependencies field to Task schema, build DependencyGraph module with build_blocks_map/filter_ready. 2) Workflow state machine — serializable execution phases with guard conditions, auto-persistence, attempt counting. 3) Loop presets — structured prompts for autonomous Claude loops (default, test-coverage, entropy, proposals, brain-dump-triage). 4) Preflight checker — validate environment before dispatching executions. 5) MCP withToolContext wrapper — centralized error handling. 6) CLI command registry with categories.

## The six patterns

### 1. Task dependency graph

- Add `dependencies: string[]` field to Task schema
- New module `DependencyGraph` with two primary methods:
  - `build_blocks_map(tasks)` — returns `Map<task_id, blocked_by_ids[]>`
  - `filter_ready(tasks)` — returns only tasks whose dependencies are all complete

### 2. Workflow state machine

- Serializable execution phases (JSON-persistable state)
- Guard conditions on transitions (can't go from `running → complete` without checking success)
- Auto-persistence on every state change
- Attempt counting for retry logic

### 3. Loop presets — structured prompts for autonomous Claude loops

Five named presets:
- **default** — general-purpose loop
- **test-coverage** — runs until test coverage target met
- **entropy** — runs until system entropy drops below threshold (whatever entropy means in context)
- **proposals** — runs the proposal pipeline end-to-end
- **brain-dump-triage** — processes the brain dump inbox until empty or timeout

### 4. Preflight checker

Validates the environment before dispatching an execution. Checks: daemon running, required env vars set, vault accessible, no pending migrations, etc. Fails fast instead of dispatching into a broken state.

### 5. MCP `withToolContext` wrapper

Centralized error handling for MCP tool calls. Wraps every tool invocation in a try/catch with standardized error format. Currently each MCP tool has its own error handling, which leads to inconsistent error shapes.

### 6. CLI command registry with categories

CLI commands registered with metadata: name, category (e.g., `intents`, `proposals`, `agents`), description, examples. Used for help generation, tab completion, and discoverability.

## Why these matter

These are **not EMA-original** patterns — they're steals from an external project (task-master). But they're concrete, ported in small chunks, and each one closes a specific gap in the current execution/MCP/CLI surfaces. Low risk, high value.

## Gaps / open questions

- **task-master project identity.** Which task-master? Probably claude-task-master or a similar repo. Needs a reference node under `research/agent-orchestration/`.
- **Elixir translations.** The original noted "with Elixir translations" — the translations aren't in the intent text. They're likely in the comment history of the old build. Needs follow-up.
- **Loop preset "entropy" semantics.** Unclear what entropy measures. Needs clarification before implementation.
- **Preflight checker scope.** Per-execution or per-batch? Synchronous or async?

## Related

- [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER PORT `Ema.Executions.Dispatcher` — parent execution system
- [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — loops execute within the feedback loop
- `research/agent-orchestration/` — candidate location for a task-master research node

#intent #port #task-master #patterns #recovered #preliminary
