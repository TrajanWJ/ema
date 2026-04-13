---
id: INT-EXECUTION-DISPATCHER
type: intent
layer: intents
title: "Agent-spawn dispatcher that picks up approved executions and runs real agents"
status: active
kind: implement
level: initiative
created: 2026-04-12
updated: 2026-04-12
priority: high
exit_condition: "When an execution row is flipped to status 'approved', a Dispatcher worker picks it up, spawns an agent runtime with the intent's runtime bundle as context, streams the agent output into the execution's step_journal, classifies runtime state through the GAC-003 heartbeat poller, and flips the execution to status 'completed' on agent termination. No manual wire-up needed. Integration test: create intent → create execution with intent_slug → approve → observe step_journal fill → see 'completed'."
scope:
  - "workers/src/execution-dispatcher.ts"
  - "workers/agent-runtime/**"
  - "agent-runtime/src/**"
  - "services/core/executions/executions.service.ts"
  - "services/core/actors/runtime-poller.ts"
connections:
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: fulfills }
  - { target: "[[canon/decisions/DEC-005-actor-phases]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: derived_from }
  - { target: "[[intents/GAC-003]]", relation: references }
  - { target: "[[intents/INT-PROPOSAL-PIPELINE]]", relation: blocked_by }
  - { target: "[[executions/EXE-003-intents-port]]", relation: derived_from }
tags: [intent, execution-dispatcher, s-tier-port-5, agent-runtime, v1-blocking]
---

# INT-EXECUTION-DISPATCHER — Agent-spawn runtime

## Why this intent exists

The current `services/core/executions/` has:

- A working CRUD surface (508 LOC service)
- Phase transitions via `execution_phase_transitions`
- A `step_journal` column (per DEC-007 recovery wave augmentation)
- As of EXE-003: `intent_slug` attachment + `executions:created` pipe-bus emission

What it does NOT have is the thing that actually **runs an agent when a row is approved**. `approveExecution(id)` flips the status string. Nothing watches. Nothing spawns. Three agent runtimes coexist in the repo:

1. `agent-runtime/src/agent.ts` — HQ's Anthropic-SDK loop (193 LOC)
2. `workers/agent-runtime/agent-worker.ts` — toy `execFile("claude", ...)` (127 LOC)
3. `workers/src/agent-runtime-heartbeat.ts` — heartbeat skeleton (EXE-001)

None of them are wired to the executions table. This intent closes that gap.

## What must land

- `workers/src/execution-dispatcher.ts` — worker that subscribes to `pipeBus` for `executions:approved` (not just `:created`) and dispatches an agent.
- Dispatcher picks a runtime:
  - v1: wrap `agent-runtime/src/agent.ts` (Anthropic SDK) and treat it as the sole runtime.
  - v2: pty-wrapped runtime per AGENT-RUNTIME.md (Codeman-shaped, 6-layer streaming pipeline) — deferred to a successor intent because node-pty + xterm.js + tmux are not yet installed.
- Context assembly: dispatcher calls `services/core/intents/getRuntimeBundle(intent_slug)` and passes the bundle's intent/phase/links/events into the runtime prompt.
- Reflexion injector: pull learnings from the most recent 3 completed executions on the same intent (via `listIntents({ intent_slug })` + `step_journal` scan) and prepend them to the agent's system prompt. This is the old `Ema.Reflexion` pattern.
- Scope enforcement: Dispatcher wraps the agent's file-write tool calls with `validateIntentForKind` + per-call glob checks against `intent.scope`. GAC-004 promises this and has the validator function — it just has no caller.
- Step journal sink: agent events stream into `appendStep(executionId, step)` so `step_journal` fills in real time.
- Runtime-state coupling: dispatcher registers the agent process as a `RuntimeTarget` on the worker-side heartbeat (`registerAgentTarget({ actorId: intent_slug + ':' + execution_id, getSnapshot })`). The heartbeat classifier already exists — it just needs real pane content. For the SDK runtime, the "pane content" is the most recent 64 KB of emitted text from the agent loop.
- Terminal transition: when the agent returns `end_turn` or errors, call `completeExecution(id, summary)` or `updateExecutionStatus(id, 'failed', reason)`.

## What's already done (EXE-003)

- `createExecution()` rejects dangling `intent_slug` references and calls `attachExecution()` ✓
- `pipeBus.trigger('executions:created', ...)` fires on insert ✓
- `getRuntimeBundle(intent_slug)` returns the full context package ✓
- `PHASE_TRANSITION_DDL` is applied at intents service init ✓
- Runtime-state classifier + poller + HTTP seam + WebSocket broadcast exist ✓
- `validateIntentForKind` exists and is wired at intent creation (still no write-time caller) ✓

## Dependencies

- `INT-PROPOSAL-PIPELINE` — ideally blocking: approved proposals should produce executions automatically. This intent can still ship with manual execution creation, but closes the loop only once the pipeline lands.
- `canon/specs/AGENT-RUNTIME.md` pty work — this intent deliberately punts on pty and uses the SDK runtime as v1; pty becomes a successor intent.

## Non-goals

- Multi-machine dispatch (deferred by GAC-001)
- Multi-agent coordination (deferred by GAC-002)
- Ghost session recovery (Codeman pattern — tracked separately as `INT-GHOST-SESSION-RECOVERY` when it lands)
- Reward/retry loops for failed executions (queue as `INT-EXECUTION-RETRY`)

## Exit condition

> When an execution row is flipped to `approved`, a Dispatcher worker picks it up, spawns an agent runtime with the intent's runtime bundle as context, streams the agent output into the execution's `step_journal`, classifies runtime state through the GAC-003 heartbeat poller, and flips the execution to `completed` on agent termination. No manual wire-up needed. Integration test: create intent → create execution with `intent_slug` → approve → observe `step_journal` fill → see `completed`.

#intent #active #priority-high #s-tier-port-5 #execution-dispatcher #v1-blocking
