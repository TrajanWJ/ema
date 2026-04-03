# EMA Project Context

## Core Loop (desired)
```
brain dump item
  → intent folder (.superman/intents/<slug>/)
  → Execution (DB row, runtime state)
  → proposal/approval
  → agent delegation (structured packet)
  → harvested result
  → patch intent files (result.md, execution-log.md, status.json)
  → next execution
```

## What Exists Today

**Input layer:**
- `BrainDump.create_item/1` — fires `"brain_dump:item_created"` on PubSub + EventBus

**Proposal layer:**
- `ProposalEngine.Generator.generate/1` — takes Seed, calls Claude, creates Proposal, broadcasts `{:proposals, :generated, proposal}`
- `ProposalEngine.Scheduler` — 1-minute tick, dispatches active seeds
- Full pipeline: Generator → Refiner → Debater → Tagger (PubSub `"proposals:pipeline"`)

**Approval:**
- `Proposals.approve_proposal/1` — sets status `"approved"`, broadcasts `"proposal_approved"` — then nothing

**Agent layer:**
- `Agents.AgentWorker` — GenServer handling messages, Claude CLI calls
- `OpenClaw.AgentBridge` — polls gateway every 5s (no dispatch method)
- `ClaudeSessions.SessionWatcher` — passive filesystem discovery only

**Harvesting:**
- `Harvesters.SessionHarvester` — designed, not implemented

**Evolution:**
- `Evolution.SignalScanner` — scans for behavior signals, unaware of executions

## What Is Missing
1. `executions` table — the runtime linkage object
2. `execution_events` table — audit trail per execution
3. `agent_sessions` table — EMA-dispatched sessions (not passive discovery)
4. `Ema.Executions` context module
5. BrainDump → Execution wire
6. Approved proposal → Dispatcher → agent
7. Session → Execution feedback on completion
8. Harvester → intent file patchback

## Design Invariants
- **Intent** = semantic, pre-execution, markdown, slow-changing
- **Execution** = committed, runtime, DB row, fast-changing
- **.superman** = durable memory (survives DB resets)
- **HQ** = execution surface (timeline of runtime state)
- **EMA** = intention/readiness surface (shapes what to do)
- No vague agent delegation — all packets must be structured
