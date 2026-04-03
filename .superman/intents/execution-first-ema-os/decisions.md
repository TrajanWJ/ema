# Design Decisions

## 2026-04-03

### D1: agent_sessions is separate from claude_sessions
**Decision:** New `agent_sessions` table for EMA-dispatched sessions. Keep `claude_sessions` for passively-discovered sessions.  
**Reason:** `claude_sessions` is a read-only mirror of `~/.claude/projects/` filesystem. `agent_sessions` is EMA's controlled dispatch record. They can be linked by session_id but serve different purposes.

### D2: intent_path stored as relative path from project root
**Decision:** `intent_path = ".superman/intents/execution-first-ema-os"` (no trailing slash)  
**Reason:** Portable. Doesn't break if project is moved. Always resolvable via `Project.path`.

### D3: result_path defaults to intent_path + /result.md
**Decision:** If `result_path` is null in execution, default to `intent_path <> "/result.md"`  
**Reason:** Predictable convention. Harvester always knows where to write.

### D4: requires_approval defaults true
**Decision:** All executions require human approval before dispatch unless explicitly set false.  
**Reason:** Safety. Autonomous dispatch should be opt-in per execution mode.

### D5: Execution mode enum
**Decision:** `research | outline | implement | review | harvest | refactor`  
**Reason:** Each mode implies a different agent prompt template and expected output format.

### D6: Delegation packet is required, not inferred
**Decision:** Dispatcher will not attempt to infer delegation targets. If an execution has no structured packet, it waits in `awaiting_approval` until one is provided.  
**Reason:** Vague delegation produces garbage outputs. Specificity is a hard constraint.

### D7: status.json tracks clarity and energy
**Decision:** `status.json` has fields: `status`, `clarity` (0-10), `energy` (0-10), `latest_execution_id`, `open_questions[]`, `completion_pct`  
**Reason:** Clarity and energy reflect the actual state of an intent — whether it's well-understood and whether there's momentum. These drive EMA's recommendation logic.

### D8: BrainDump items auto-create intent folders
**Decision:** When `BrainDump.create_item/1` spawns an execution, also create `.superman/intents/<slug>/` with a minimal `intent.md` (raw content) and `status.json` (idle state). Slug is generated via `IntentFolder.slugify(String.slice(content, 0, 60))`.  
**Reason:** Intent folders are the semantic anchor for executions. Without one, the patchback path (`intent_path`) is nil and results are lost. Auto-creation ensures every execution has a place to write results. The folder can be sparse initially — just `intent.md` + `status.json`. Agents populate the rest. (Resolves Q1 from research.md)

### D9: Completion callback — inline for local, REST endpoint for remote
**Decision:** Local Claude completions are handled inline by the Dispatcher (it already calls `on_session_completed` after `Claude.AI.run` returns). Remote/external agents call `POST /api/executions/:id/complete` with `{result_summary: "..."}`. A background `ExecutionHarvester` GenServer is a future safety net, not the primary path.  
**Reason:** Local completions are synchronous — the Dispatcher has the result in hand. Remote completions are asynchronous — the agent needs a way to call back. A REST endpoint is simpler and more debuggable than polling. The harvester is insurance for missed callbacks, not the main mechanism. (Resolves Q2 from research.md)

### D10: HQ is the ExecutionsApp — a standalone surface, not an extension of ProposalsApp
**Decision:** Build `ExecutionsApp` as a new, dedicated frontend component rendering a vertical timeline of executions grouped by status. It is the "HQ" surface described in architecture signals. It is NOT an extension of ProposalsApp or a tab within it.  
**Reason:** Per signal: "HQ is a timeline of executions. Not a proposal list. Not a task board." Proposals shape intent. Executions track runtime. These are different data sources with different lifecycles. Merging them into one UI would conflate semantic readiness with runtime state. ExecutionsApp owns the runtime view; ProposalsApp owns the intention view. (Resolves Q3 from research.md)
