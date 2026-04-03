# Key Signals (2026-04-03 Design Session)

## Architecture Signals

**HQ is a timeline of executions.**  
Not a proposal list. Not a task board. A chronological stream of work units with status. Each row is an Execution. The surface is runtime state.

**EMA is the intention/readiness layer.**  
EMA shapes *what* should be done and *whether* it's ready. Execution decides *when* and *how*. EMA surfaces intents. HQ surfaces executions.

**.superman is durable project semantic memory.**  
DB is runtime state — it can be reset, migrated, wiped. `.superman/` is persistent semantic context that survives all of that. Intent files should read like project documentation, not schema dumps. They are the semantic ground truth.

**Intent must stay distinct from execution.**  
- Intent = what you want to achieve (markdown, human-readable, slow-changing, durable)
- Execution = a single attempt to advance that intent (DB row, fast-changing, disposable)
- One intent can have many executions. Executions reference intents, they do not replace them.

**Direct agent delegation requires structured packets.**  
When an approved execution is dispatched to an agent, the packet must include:
- `execution_id` — the runtime row being executed
- `project_slug` — which project this belongs to
- `intent_slug` — which intent folder this advances
- `agent_role` — implementer | researcher | reviewer | refactorer | harvester
- `objective` — the specific thing this execution should achieve
- `success_criteria[]` — what done looks like
- `read_files[]` — files the agent must read before starting
- `write_files[]` — files the agent must write results to
- `constraints[]` — what must not happen
- `mode` — research | outline | implement | review | harvest | refactor
- `requires_patchback` — whether harvester must write results back to intent files

**Results must patch back into semantic state.**  
When an execution completes, the harvested result is:
1. Written to `result.md` in the intent folder
2. Appended as an entry in `execution-log.md`
3. Used to update `plan.md` with candidate next executions
4. Reflected in `status.json` (status, clarity, energy, latest_execution_id, open_questions)

**No vague delegation.**  
If an agent cannot determine exactly what to read, what to write, and what success looks like — the delegation packet is incomplete. Do not delegate until the packet is specific.

## Loop Signal
```
brain dump
  → intent folder
  → Execution created
  → proposal/approval
  → structured delegation packet
  → agent runs with specific read/write targets
  → harvester collects outputs
  → intent files patched
  → next execution candidates generated
  → status.json updated
```
