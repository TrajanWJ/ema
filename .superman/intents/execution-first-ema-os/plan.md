# Plan: Execution-First EMA OS

**Last updated:** 2026-04-03

## Next candidate executions

### Sprint 1 — Backend Correctness

**EX-002: Fix Dispatcher + completion path**
- Mode: implement
- Objective: Fix Dispatcher's broken send_message call. Fix attempt_local_claude to call on_session_completed with execution.id. Add on_execution_completed/2 to Executions context.
- Files: dispatcher.ex, executions.ex
- Success: Dispatcher dispatches without crash. Local Claude fallback completes execution.
- Complexity: S

**EX-003: Create IntentFolder module + wire into BrainDump**
- Mode: implement
- Objective: New module Ema.Executions.IntentFolder with create/3, write_result/3, append_log/5, update_status/3, read_status/2, exists?/2, slugify/1. Wire into brain_dump.ex so create_item populates intent_slug, intent_path, and creates folder. Extract patch_intent_file from executions.ex into IntentFolder.
- Files: intent_folder.ex (new), brain_dump.ex, executions.ex
- Success: Brain dump item produces execution with intent_path set AND .superman/intents/<slug>/ folder on disk.
- Complexity: M

**EX-004: Completion REST endpoint**
- Mode: implement
- Objective: Add POST /api/executions/:id/complete that accepts {result_summary} and calls on_execution_completed. Add route in router.
- Files: execution_controller.ex, router.ex
- Success: POSTing result summary transitions execution to completed and writes intent files.
- Complexity: S

**EX-005: Wire link_proposal into ProposalEngine**
- Mode: implement
- Objective: In generator.ex, after creating proposal from seed, if seed has brain_dump_item_id, call Executions.link_proposal(item_id, proposal_id).
- Files: proposal_engine/generator.ex
- Success: Brain dump item generates proposal → execution is linked to proposal.
- Complexity: S

### Sprint 2 — Frontend

**EX-006: ExecutionChannel + execution-store.ts**
- Mode: implement
- Objective: New execution_channel.ex subscribed to "executions" PubSub. Register in user_socket.ex. New execution-store.ts with loadViaRest() + connect() pattern, approve/cancel/complete actions.
- Files: execution_channel.ex (new), user_socket.ex, execution-store.ts (new)
- Success: Join executions:lobby, receive state push, receive updates on transition.
- Complexity: M

**EX-007: ExecutionsApp — HQ timeline**
- Mode: implement
- Objective: New ExecutionsApp.tsx rendering vertical timeline grouped by status. Cards: title, mode badge, status badge, timestamps. Approve/cancel on pending. Click to expand events + agent sessions. Register in workspace.ts, App.tsx, Launchpad.
- Files: ExecutionsApp.tsx (new), workspace.ts, App.tsx, Launchpad.tsx
- Success: App renders, shows executions, approve works, real-time updates via channel.
- Complexity: L

### Sprint 3 — Proof

**EX-008: Self-referential test — complete this intent end-to-end**
- Mode: research (self-documenting)
- Objective: Create execution row for this intent. Complete it via REST endpoint. Verify: DB row + result on disk + status.json updated. This proves the full loop works.
- Success: GET /api/executions?intent_slug=execution-first-ema-os returns a completed execution.
- Complexity: S

## Invariants (never change these)

- Intent = semantic/pre-execution (markdown, human-readable, survives DB resets)
- Execution = committed/runtime (DB row, queryable, disposable)
- .superman = durable memory
- HQ = execution surface (runtime view)
- EMA = intention/readiness surface (semantic view)
- No vague agent delegation
- All outputs must patch back into project semantic state
