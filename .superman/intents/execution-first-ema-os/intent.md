# Execution-First EMA OS with Intent Folders and Runtime Executions

## Summary
Replace EMA's disconnected proposal/task/session model with a unified execution-first runtime. Every unit of work is an **Execution** DB row that links source intent → proposal → agent session → harvested result. Intent lives as markdown in `.superman/intents/<slug>/`. Execution is the runtime bridge.

## Why It Exists
The current architecture has all pieces but no connective tissue:
- Proposals are generated but never executed (Ralph loop returns `{status: "idle"}`)
- Agent sessions are discovered passively but not linked to proposals
- Results are not harvested back into any semantic state
- No feedback loop from outcomes to intent

Without Execution as a first-class object, EMA is a proposal factory with no actuator.

## Desired Outcome
1. Every brain dump item can spawn an Execution
2. Every Execution has a clear status timeline: `created → approved → delegated → running → completed`
3. Agent sessions are spawned *from* executions via structured delegation packets
4. Results are written back into the intent folder that originated the work
5. `status.json` in each intent folder reflects current state
6. Evolution engine sees execution outcomes as signals

## Success Criteria
- [ ] `.superman/` folder structure exists with project.md, context.md, inbox/, intents/
- [ ] `executions`, `execution_events`, `agent_sessions` migrations pass
- [ ] `Ema.Executions` context compiles with all lifecycle functions
- [ ] `BrainDump.create_item` creates a linked Execution
- [ ] `Proposals.approve_proposal` triggers Dispatcher
- [ ] `ExecutionsApp` renders timeline with status groups
- [ ] First execution (this one) appears completed in HQ

## Current Status
- Phase: 1 — Bootstrap
- Status: in_progress
