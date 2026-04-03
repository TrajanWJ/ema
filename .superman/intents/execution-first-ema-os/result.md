# Result: Research & Outline — Execution-First EMA OS

**Execution:** u7NFG_WdyTg (research) + outline-001 (outline)
**Completed:** 2026-04-03
**Signal:** success

## What was produced

Two complete outputs written to this intent folder:

- **research.md** — 8 durable architecture principles, full runtime model analysis, current codebase state (what is wired vs. not), 10 documented gaps (5 critical), 8 prioritized unresolved questions
- **outline.md** — Full filesystem spec, field-level schema for all 3 tables, PubSub event flow map with full lifecycle sequence, module boundaries with function-level status, 9-step build order across 3 sprints

## Critical findings (act on these first)

1. **Dispatcher is broken** — `send_message/1` call crashes at runtime (wrong arity). Fix: use `spawn_agent/2` or match Client signature.
2. **BrainDump executions have no intent anchor** — `intent_slug` and `intent_path` are nil, so patchback no-ops. Fix: IntentFolder.create in BrainDump.create_item.
3. **No completion trigger** — `on_session_completed/2` exists but nothing calls it from outside. Fix: add `/api/executions/:id/complete` endpoint.
4. **No frontend** — ExecutionsApp does not exist. Fix: Sprint 2.

## Implementation path (from outline.md)

Sprint 1 (backend correctness, ~1 session):
1. Fix Dispatcher calls (S)
2. IntentFolder module + BrainDump wire (M)
3. Fix on_session_completed execution_id path (S)
4. Completion REST endpoint (S)
5. Wire link_proposal into ProposalEngine (S)

Sprint 2 (frontend, ~1 session):
6. ExecutionChannel (S)
7. execution-store.ts (M)
8. ExecutionsApp / HQ timeline (L)

Sprint 3 (proof, 10 min):
9. Self-referential test — complete an execution end-to-end

## What works right now (do not rebuild)

- Execution schema, migrations, context module — solid
- All 7 REST routes wired
- Dispatcher GenServer in supervision tree
- Proposal → Execution link via on_proposal_approved
- BrainDump → Execution wired (just needs intent_path populated)
- status.json / execution-log.md patchback code exists (just unreachable)
