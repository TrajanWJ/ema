# Research: Execution-First EMA OS

**Execution:** u7NFG_WdyTg  
**Date:** 2026-04-03  
**Status:** complete

---

## 1. Architecture Principles

These are durable — they should hold regardless of implementation changes.

**P1: Intent is semantic; Execution is runtime.**  
Intent lives as markdown in `.superman/intents/<slug>/`. It is human-readable, slow-changing, and survives DB resets. Execution is a DB row — fast-changing, disposable, and queryable. One intent can have many executions. Executions reference intents; they never replace them.

**P2: `.superman/` is durable project memory.**  
The DB is runtime state that can be wiped, migrated, or rebuilt. `.superman/` is the semantic ground truth that persists through all of that. Intent files should read like project documentation, not schema dumps.

**P3: No vague delegation.**  
Every agent dispatch requires a structured packet with: execution_id, objective, success_criteria, read_files, write_files, constraints, and mode. If any of these are missing, the execution waits — it does not guess.

**P4: Results patch back into semantic state.**  
When an execution completes, its output is written to `result.md`, appended to `execution-log.md`, and reflected in `status.json` within the intent folder. This closes the loop between runtime and durable memory.

**P5: HQ is a timeline of executions; EMA is the intention layer.**  
HQ renders runtime state (status, progress, events). EMA shapes what should be done and whether it's ready. These are separate surfaces with different data sources.

**P6: All executions require approval by default.**  
`requires_approval` defaults to `true`. Autonomous dispatch is opt-in per execution. This is a safety invariant.

**P7: Execution modes determine agent behavior.**  
The six modes (`research | outline | implement | review | harvest | refactor`) each imply a different prompt template, expected output format, and success criteria. Mode is not decorative — it drives the delegation packet.

**P8: agent_sessions is separate from claude_sessions.**  
`claude_sessions` is a read-only mirror of `~/.claude/projects/` (passive discovery). `agent_sessions` is EMA's controlled dispatch record. They serve different purposes and can be linked but are not the same table.

---

## 2. Runtime Model

### Minimal Execution (what actually exists in schema)

```elixir
# daemon/lib/ema/executions/execution.ex
schema "executions" do
  field :id,                 :string       # primary key, random 8-byte base64
  field :title,              :string       # required
  field :mode,               :string       # required, one of 6 modes
  field :status,             :string       # required, one of 10 statuses
  field :objective,          :string       # text, what to accomplish
  field :project_slug,       :string       # links to project
  field :intent_slug,        :string       # links to intent folder
  field :intent_path,        :string       # relative path from project root
  field :result_path,        :string       # where to write results (defaults to intent_path/result.md)
  field :requires_approval,  :boolean      # default true
  field :brain_dump_item_id, :string       # source brain dump item
  field :agent_session_id,   :string       # plain string field (not FK)
  field :metadata,           :map          # flexible JSON blob
  field :completed_at,       :utc_datetime
  belongs_to :proposal                     # FK to proposals table
  belongs_to :task                         # FK to tasks table
  belongs_to :session                      # FK to claude_sessions table
  has_many :events                         # execution_events
  timestamps()
end
```

### Truly necessary fields (load-bearing)
- `id`, `title`, `mode`, `status` — identity and lifecycle
- `objective` — what the agent actually does
- `intent_path` — where to patch results back
- `proposal_id` — links the approval chain
- `requires_approval` — safety gate

### Nice-to-have but currently unused or underutilized
- `project_slug`, `intent_slug` — useful for filtering but not load-bearing in current code (intent_path does the work)
- `task_id` — FK exists but no code path creates this linkage
- `session_id` — FK to claude_sessions, but no code path from passive session discovery links to executions
- `agent_session_id` — plain string field, redundant with agent_sessions table's execution_id FK
- `result_path` — has a sensible default convention (intent_path + /result.md), rarely needs explicit override

### Valid statuses
```
created → proposed → awaiting_approval → approved → delegated → running → harvesting → completed
                                                                                      → failed
                                                                                      → cancelled
```

### Supporting schemas
- **Event** (`execution_events`): `id, execution_id, type, actor_kind, payload, at` — audit trail
- **AgentSession** (`agent_sessions`): `id, execution_id, agent_role, status, prompt_sent, result_summary, started_at, ended_at, metadata` — dispatch record

---

## 3. Current Codebase State

### What is wired and compiles

| Component | File | Status |
|-----------|------|--------|
| Execution schema | `daemon/lib/ema/executions/execution.ex` | Complete, 46 lines |
| Event schema | `daemon/lib/ema/executions/event.ex` | Complete, 24 lines |
| AgentSession schema | `daemon/lib/ema/executions/agent_session.ex` | Complete, 35 lines |
| Executions context | `daemon/lib/ema/executions/executions.ex` | Complete, 299 lines — full CRUD + lifecycle |
| Dispatcher GenServer | `daemon/lib/ema/executions/dispatcher.ex` | Complete, 175 lines — builds packets, formats prompts |
| ExecutionController | `daemon/lib/ema_web/controllers/execution_controller.ex` | Complete — index, show, create, approve, cancel, events, agent_sessions |
| Router | `daemon/lib/ema_web/router.ex:198-205` | 7 routes under `/api/executions` |
| Migrations | `20260403900010`, `900011`, `900012` | executions, execution_events, agent_sessions tables |
| Supervision | `daemon/lib/ema/application.ex:33` | Dispatcher is in the supervision tree |
| TaskSupervisor | `daemon/lib/ema/application.ex:20` | Used by Dispatcher for async dispatch |

### What is actually connected end-to-end

1. **BrainDump → Execution**: `BrainDump.create_item/1` creates an Execution in a Task.Supervisor child (async, fire-and-forget). Sets mode to "research", status to "created", requires_approval to true.

2. **Proposal approved → Execution**: `Proposals.approve_proposal/1` calls `Ema.Executions.on_proposal_approved/1`. This either finds an existing execution linked to the proposal or creates one. It transitions to "approved" and calls `dispatch_if_ready/1`.

3. **Dispatch chain**: `dispatch_if_ready/1` broadcasts on `"executions:dispatch"` if `requires_approval == false`. Dispatcher subscribes and builds a structured delegation packet.

4. **Dispatcher → OpenClaw (broken)**: Dispatcher calls `Ema.OpenClaw.Client.send_message/1` with a map, but the actual Client defines `send_message/2` taking `(session_id, message)`. **This call will crash at runtime.**

5. **Dispatcher → Local Claude (fallback)**: If OpenClaw fails, falls back to `Ema.Claude.AI.run/1`. This works if Claude CLI is available.

6. **Completion → patchback**: `on_session_completed/2` writes result.md, appends to execution-log.md, writes status.json to intent folder.

7. **REST API**: All 7 routes are wired. Controller can list, show, create, approve, cancel executions and query events/sessions.

### What is NOT connected

- **No WebSocket channel** for executions (no real-time push to frontend)
- **No frontend ExecutionsApp** (no component, no store, no UI)
- **No execution channel** in `user_socket.ex`
- **BrainDump → Execution** does not set `intent_slug` or `intent_path` (the execution has no semantic anchor)
- **link_proposal/2** is defined but never called (the BrainDump→Execution→Proposal link is not wired)
- **session_id linkage** from passive claude_sessions to executions — no code path exists
- **Harvester** — no GenServer watches for completed sessions to trigger `on_session_completed/2`

---

## 4. Gaps

### Critical (blocks the loop from closing)

**G1: Dispatcher OpenClaw call is broken.**  
`dispatcher.ex:56` calls `Ema.OpenClaw.Client.send_message(%{content: prompt, metadata: ...})` but the Client expects `send_message(session_id, message)`. This is a compile-time-safe but runtime-crash bug.

**G2: No frontend for executions.**  
No ExecutionsApp component, no Zustand store, no WebSocket channel. The user cannot see, approve, or monitor executions.

**G3: BrainDump creates executions without intent anchoring.**  
`brain_dump.ex` creates executions with `mode: "research"` but no `intent_slug`, `intent_path`, or `project_slug`. The patchback function (`patch_intent_file`) will no-op because `intent_path` is nil.

**G4: No harvester closes the loop.**  
Nothing watches for completed agent sessions or Claude CLI results and calls `on_session_completed/2`. The patchback code exists but is never triggered by external completion events.

**G5: Proposal → Execution link is one-directional.**  
`on_proposal_approved` creates an execution from a proposal, but if a BrainDump item spawned both a proposal (via ProposalEngine) AND an execution, `link_proposal/2` is never called to connect them.

### Important (degrades quality)

**G6: No execution WebSocket channel.**  
Real-time updates for the HQ timeline require a Phoenix channel. Currently only REST polling is possible.

**G7: `infer_signal/1` is naive.**  
Signal inference checks byte_size — anything >= 50 bytes is "success", < 50 is "partial", nil/empty is "failed". This will misclassify most results.

**G8: `dispatch_if_ready/1` only fires when `requires_approval == false`.**  
Since `on_proposal_approved` creates executions with `requires_approval: false`, this works for proposal-driven executions. But for BrainDump-created executions (requires_approval: true), there is no UI or API call that transitions them to approved AND dispatches. The controller's `approve/2` action does broadcast dispatch, which is correct but untested.

### Minor (cosmetic or future)

**G9: `agent_session_id` field on Execution is redundant.**  
The `agent_sessions` table has an `execution_id` FK. The plain string `agent_session_id` on the execution schema is never set by any code path.

**G10: status.json always writes `completion_pct: 10`.**  
Hardcoded in `patch_intent_file/2`. Not calculated from actual progress.

---

## 5. Unresolved Questions

### Priority 1 (must resolve before next implementation)

**Q1: How should BrainDump items get intent folders?**  
Currently `create_item` creates an execution with no intent_slug or intent_path. Options:
- Auto-create intent folder from item content (slug from first ~40 chars)
- Require explicit intent assignment via UI before execution
- Only items explicitly promoted to "intent" get folders
**Recommendation:** Auto-create with slugified title. The folder can be empty initially — just intent.md with the raw content.

**Q2: What triggers `on_session_completed`?**  
No code path calls this today. Options:
- Dispatcher calls it inline after `Ema.Claude.AI.run` returns (partially done in `attempt_local_claude`)
- A harvester GenServer polls agent_sessions for status changes
- The agent itself calls back via REST endpoint
**Recommendation:** For local Claude, Dispatcher already handles this inline. For external agents (OpenClaw), add a `/api/executions/:id/complete` endpoint that agents call when done.

**Q3: Should execution approval happen in Proposals UI or a dedicated Executions UI?**  
The approve action exists on the controller but there's no frontend. Options:
- Extend ProposalsApp with an "Execute" button post-approval
- Build a standalone ExecutionsApp (HQ timeline)
- Both
**Recommendation:** Build ExecutionsApp as the HQ timeline. This is the core surface per the architecture signals.

### Priority 2 (important but can ship without)

**Q4: How do intent folders get created for non-BrainDump executions?**  
Manual executions created via REST API need intent folders too. Should creation auto-mkdir? Should there be a template?

**Q5: When does an execution transition from `delegated` to `running`?**  
Dispatcher transitions to "delegated" after sending to OpenClaw. Who transitions to "running"? The agent? A heartbeat poller?

**Q6: How should `infer_signal` work for real?**  
Current byte_size check is a placeholder. Should it parse structured output? Check for error patterns? Use mode-specific criteria?

### Priority 3 (future concerns)

**Q7: Should executions be linked to the Pipes system?**  
Pipes already have an EventBus. Execution state changes could be pipe triggers. Not needed now but natural extension.

**Q8: Multi-execution coordination?**  
Some intents need multiple sequential executions (research → outline → implement). Who manages the sequence? Manual for now.

---

## 6. Implementation Path

Ordered by dependency. Each item is concrete and testable.

### Step 1: Fix Dispatcher OpenClaw call
**File:** `daemon/lib/ema/executions/dispatcher.ex:55-60`  
**What:** Fix the `send_message` call to match the Client's actual signature, or route through a different method (e.g., `spawn_agent/2`). Also ensure the local Claude fallback calls `on_session_completed` correctly (it currently references `execution.session_id` which may be nil).  
**Test:** Dispatcher dispatches without crashing when OpenClaw is down (falls back to local Claude).

### Step 2: Wire BrainDump → intent folder creation
**File:** `daemon/lib/ema/brain_dump/brain_dump.ex` (modify create_item)  
**What:** When creating an execution from a brain dump item, also:
1. Generate `intent_slug` from slugified item content
2. Set `intent_path` to `.superman/intents/<slug>`
3. Create the intent folder with a minimal `intent.md` containing the item content
**Test:** Creating a brain dump item produces an execution with a populated intent_path and a real directory on disk.

### Step 3: Build execution WebSocket channel
**Files:** New `daemon/lib/ema_web/channels/execution_channel.ex`, modify `user_socket.ex`  
**What:** Channel joins `"executions:lobby"`, subscribes to PubSub `"executions"` topic, pushes `execution:created`, `execution:updated`, `execution:completed` events to connected clients.  
**Test:** Channel pushes events when executions are created/transitioned.

### Step 4: Build ExecutionsApp frontend (HQ timeline)
**Files:** New `app/src/components/executions/ExecutionsApp.tsx`, new `app/src/stores/execution-store.ts`  
**What:** Zustand store with `loadViaRest()` + `connect()` pattern. Component renders a vertical timeline grouped by status (running → approved → created → completed). Each card shows title, mode, status, timestamps. Approve/cancel buttons on pending items.  
**Test:** App renders executions from REST API, updates in real-time via channel.

### Step 5: Add completion endpoint
**File:** Modify `daemon/lib/ema_web/controllers/execution_controller.ex`, modify router  
**What:** Add `POST /api/executions/:id/complete` that accepts `{result_summary: "..."}` and calls `Ema.Executions.on_session_completed/2`. This is how external agents report back.  
**Test:** POSTing a result summary transitions execution to completed and writes intent files.

### Step 6: Wire link_proposal into ProposalEngine
**File:** `daemon/lib/ema/proposal_engine/generator.ex` (modify `create_proposal_from_result`)  
**What:** After creating a proposal from a seed, if the seed has a `brain_dump_item_id`, call `Ema.Executions.link_proposal(item_id, proposal.id)` to connect the execution chain: brain_dump → execution → proposal.  
**Test:** A brain dump item that generates a proposal has its execution linked to that proposal.

### Step 7: Build intent folder template system
**File:** New `daemon/lib/ema/executions/intent_folder.ex`  
**What:** Module that manages intent folder lifecycle: `create/2` (creates dir + intent.md + status.json), `update_status/2`, `append_log/3`. Extract the file I/O from `executions.ex:patch_intent_file` into this module.  
**Test:** Creating an intent folder produces well-formed markdown files. Updating status writes valid JSON.

### Step 8: Self-referential test — complete this execution
**What:** Create an execution row for this research task (execution-first-ema-os, mode: research). Write the result (this file) to the intent folder. Mark the execution as completed. Verify the full loop: execution exists in DB, result.md exists on disk, status.json reflects completion.  
**Test:** `GET /api/executions?intent_slug=execution-first-ema-os` returns a completed execution.
