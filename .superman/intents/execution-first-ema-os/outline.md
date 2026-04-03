# Outline: Execution-First EMA OS

**Execution:** outline-001  
**Date:** 2026-04-03  
**Status:** complete  
**Depends on:** research.md (complete)

---

## 1. Filesystem Structure

### .superman/ directory tree

```
.superman/
  project.md                  # Project identity: name, stack, repo, ports, active systems
  context.md                  # Current state: what exists, what's missing, design invariants
  inbox/                      # Unprocessed brain dump items awaiting intent promotion
    .gitkeep
  intents/
    <slug>/                   # One folder per intent (kebab-case slug)
      intent.md               # Human-readable description of the intent (what + why)
      signals.md              # Architecture signals, design decisions captured during discussion
      decisions.md            # Numbered design decisions (D1, D2, ...) with rationale
      research.md             # Output of research-mode execution
      outline.md              # Output of outline-mode execution
      plan.md                 # Concrete implementation plan (steps, files, tests)
      result.md               # Output of the most recent execution (overwritten each time)
      execution-log.md        # Append-only log of all executions against this intent
      status.json             # Machine-readable state (see schema below)
```

### Naming conventions

- **Intent slugs:** kebab-case, max 60 chars, derived from title. Example: `execution-first-ema-os`
- **File names:** fixed set per intent folder. No arbitrary files — agents know exactly what to read/write.
- **No nesting:** intents are flat under `intents/`. No sub-intents. Composition happens via execution chains, not folder hierarchy.

### status.json schema

```json
{
  "slug": "string",
  "status": "idle | in_progress | blocked | completed | abandoned",
  "phase": 1,
  "clarity": 8,
  "energy": 9,
  "latest_execution_id": "string | null",
  "open_questions": ["string"],
  "completion_pct": 0,
  "last_updated": "2026-04-03T12:00:00Z"
}
```

### Intent folder creation rules

1. **From BrainDump:** Auto-create when `create_item/1` spawns an execution. Slug from `Slug.slugify(String.slice(content, 0, 60))`. Folder contains only `intent.md` with the raw content.
2. **From REST API:** `POST /api/executions` with `intent_slug` auto-creates if folder doesn't exist.
3. **Manual:** User creates folder + intent.md directly. EMA discovers on next scan.

### Template for new intent folders

`intent.md` (minimal):
```markdown
# {Title}

{Raw content from brain dump item or user input}
```

`status.json` (initial):
```json
{
  "slug": "{slug}",
  "status": "idle",
  "phase": 0,
  "clarity": 3,
  "energy": 5,
  "latest_execution_id": null,
  "open_questions": [],
  "completion_pct": 0,
  "last_updated": "{ISO8601 now}"
}
```

---

## 2. Runtime Schema

### executions table

| Field | Type | Purpose | Constraints |
|-------|------|---------|-------------|
| `id` | `string` | Primary key | 8-byte random base64, not null |
| `title` | `string` | Human-readable name | not null, max 255 |
| `mode` | `string` | Agent behavior mode | not null, one of: `research`, `outline`, `implement`, `review`, `harvest`, `refactor` |
| `status` | `string` | Lifecycle state | not null, one of: `created`, `proposed`, `awaiting_approval`, `approved`, `delegated`, `running`, `harvesting`, `completed`, `failed`, `cancelled` |
| `objective` | `text` | What the agent should accomplish | nullable (defaults to title) |
| `project_slug` | `string` | Links to projects table | nullable, index |
| `intent_slug` | `string` | Links to .superman/intents/<slug>/ | nullable, index |
| `intent_path` | `string` | Relative path from project root | nullable, e.g. `.superman/intents/execution-first-ema-os` |
| `result_path` | `string` | Override for result output location | nullable, defaults to `{intent_path}/result.md` |
| `requires_approval` | `boolean` | Safety gate for dispatch | not null, default `true` |
| `brain_dump_item_id` | `string` | Source brain dump item | nullable, index |
| `proposal_id` | `string` | FK to proposals | nullable, index |
| `task_id` | `string` | FK to tasks | nullable |
| `session_id` | `string` | FK to claude_sessions (passive discovery link) | nullable |
| `agent_session_id` | `string` | **Remove.** Redundant with agent_sessions.execution_id | — |
| `metadata` | `map` | Flexible JSON (result_summary stored here on completion) | default `%{}` |
| `completed_at` | `utc_datetime` | When execution reached terminal state | nullable |
| `inserted_at` | `utc_datetime` | Created timestamp | auto |
| `updated_at` | `utc_datetime` | Last modified | auto |

**Indexes:**
- `[:status]` — filter by lifecycle state (HQ timeline groups by status)
- `[:intent_slug]` — find all executions for an intent
- `[:project_slug]` — find all executions for a project
- `[:brain_dump_item_id]` — trace back to source item
- `[:proposal_id]` — link approval chain
- `[:inserted_at]` — timeline ordering

**Note on agent_session_id:** Research identified this as redundant (G9). The `agent_sessions` table already has an `execution_id` FK pointing back. No code sets `agent_session_id` on the execution. Recommend removing the field in the next migration to reduce confusion.

### execution_events table

| Field | Type | Purpose | Constraints |
|-------|------|---------|-------------|
| `id` | `string` | Primary key | 8-byte random base64, not null |
| `execution_id` | `string` | FK to executions | not null, index |
| `type` | `string` | Event kind | not null, freeform but conventionally: `created`, `status_changed`, `proposal_linked`, `session_linked`, `dispatch_failed`, `completed`, `cancelled` |
| `actor_kind` | `string` | Who caused this event | not null, one of: `system`, `user`, `agent`, `harvester`, `pipe` |
| `payload` | `map` | Event-specific data | default `%{}` |
| `at` | `utc_datetime` | When the event occurred | not null |

**Indexes:**
- `[:execution_id]` — list all events for an execution (the primary query)
- `[:type]` — filter by event type (useful for audit)

**Semantics:** Events are append-only. They form an audit trail. Every state transition and linkage creates an event. The payload carries the diff (e.g., `%{from: "created", to: "approved"}` for status changes).

### agent_sessions table

| Field | Type | Purpose | Constraints |
|-------|------|---------|-------------|
| `id` | `string` | Primary key | 8-byte random base64, not null |
| `execution_id` | `string` | FK to executions | not null, index |
| `agent_role` | `string` | Role from delegation packet | not null, one of: `implementer`, `researcher`, `reviewer`, `refactorer`, `harvester`, `outliner` |
| `status` | `string` | Session lifecycle | not null, one of: `pending`, `running`, `completed`, `failed`, `cancelled` |
| `transcript_ref` | `string` | Path or ID of session transcript | nullable |
| `prompt_sent` | `text` | Full delegation prompt sent to agent | nullable |
| `result_summary` | `text` | Agent's output summary | nullable, populated on completion |
| `started_at` | `utc_datetime` | When agent started working | nullable |
| `ended_at` | `utc_datetime` | When agent finished | nullable |
| `metadata` | `map` | Flexible (stores full delegation packet) | default `%{}` |
| `inserted_at` | `utc_datetime` | Created timestamp | auto |
| `updated_at` | `utc_datetime` | Last modified | auto |

**Indexes:**
- `[:execution_id]` — find all sessions for an execution
- `[:status]` — find running/pending sessions

**Semantics:** Each dispatch creates one agent_session row. One execution can have multiple agent_sessions (retries, multi-step). The agent_session is the dispatch record — it captures what was sent and what came back. It is distinct from `claude_sessions` which is a passive filesystem mirror.

---

## 3. Event Flow

### PubSub topic map

| Topic | Messages | Producer | Consumer |
|-------|----------|----------|----------|
| `"executions"` | `{"execution:created", execution}` | `Ema.Executions.create/1` | `EmaWeb.ExecutionChannel`, Pipes EventBus |
| `"executions"` | `{"execution:updated", execution}` | `Ema.Executions.transition/2`, `link_proposal/2`, `link_session/2` | `EmaWeb.ExecutionChannel` |
| `"executions"` | `{"execution:completed", %{execution, signal}}` | `Ema.Executions.on_session_completed/2` | `EmaWeb.ExecutionChannel`, `IntentFolder` (patchback), Pipes EventBus |
| `"executions:dispatch"` | `{:dispatch, execution}` | `Ema.Executions.dispatch_if_ready/1`, `EmaWeb.ExecutionController.approve/2` | `Ema.Executions.Dispatcher` |
| `"proposals:pipeline"` | `{:proposals, :generated, proposal}` | `ProposalEngine.Generator` | `ProposalEngine.Refiner`, (future: `link_proposal` wire) |
| `"proposals:pipeline"` | `{:proposals, :queued, proposal}` | `ProposalEngine.Tagger` | (future: auto-create execution from queued proposal) |
| `"brain_dump"` | via EventBus `"brain_dump:item_created"` | `Ema.BrainDump.create_item/1` | Pipes Executor |

### Full execution lifecycle as event sequence

```
1. User creates brain dump item
   BrainDump.create_item/1
     → EventBus.broadcast("brain_dump:item_created", ...)
     → Task.Supervisor spawns:
         Executions.create(%{mode: "research", status: "created", ...})
           → record_event("created", ...)
           → broadcast("executions", {"execution:created", execution})
         IntentFolder.create(slug, content)
           → mkdir .superman/intents/<slug>/
           → write intent.md, status.json

2. (Optional) ProposalEngine generates proposal from seed
   Generator creates proposal
     → broadcast("proposals:pipeline", {:proposals, :generated, proposal})
   If seed has brain_dump_item_id:
     → Executions.link_proposal(item_id, proposal_id)
       → record_event("proposal_linked", ...)
       → transition to "proposed"

3. User approves proposal (or directly approves execution)
   Proposals.approve_proposal(proposal_id)
     → Executions.on_proposal_approved(proposal_id)
       → transition to "approved"
       → dispatch_if_ready(execution)  [requires_approval: false for proposal-driven]
   OR
   POST /api/executions/:id/approve
     → transition to "approved"
       → broadcast("executions:dispatch", {:dispatch, execution})

4. Dispatcher receives dispatch message
   Dispatcher.handle_info({:dispatch, execution})
     → Task.Supervisor spawns dispatch_execution:
       → build_packet(execution)
       → format_prompt(packet)
       → create_agent_session(execution_id, %{status: "running", ...})
       → attempt_dispatch:
           OpenClaw.Client.spawn_agent("claude", %{prompt: prompt, execution_id: id})
             → on success: transition to "delegated"
             → on failure: fallback to local Claude CLI
               → Ema.Claude.AI.run(prompt)
               → on success: on_session_completed(execution_id, result)
               → on failure: transition to "failed"

5. Agent completes work
   Local: Dispatcher calls on_session_completed inline (step 4 fallback)
   Remote: Agent POSTs to /api/executions/:id/complete
     → Executions.on_session_completed(id, result_summary)
       → transition to "completed"
       → record_event("completed", %{signal: signal})
       → broadcast("executions", {"execution:completed", %{execution, signal}})
       → IntentFolder.patch(execution, result_summary)
         → write result.md
         → append execution-log.md
         → update status.json

6. Frontend receives real-time update
   ExecutionChannel subscribed to "executions" PubSub
     → push "execution:completed" to connected clients
     → Zustand store updates, HQ timeline re-renders
```

### Pipe integration (future)

Execution events should be broadcast on the Pipes EventBus for automation:
- `"execution:created"` → trigger pipes (e.g., auto-assign to project)
- `"execution:completed"` → trigger pipes (e.g., create follow-up execution)
- `"execution:failed"` → trigger pipes (e.g., notify user, retry)

---

## 4. Module Boundaries

### Ema.Executions (`daemon/lib/ema/executions/executions.ex`)

**Owns:** Execution lifecycle, DB operations, patchback orchestration.

| Function | Purpose | Status |
|----------|---------|--------|
| `create/1` | Create execution + record event + broadcast | Exists, needs intent_slug/intent_path population |
| `transition/2` | Change status + record event + broadcast | Exists, works |
| `link_proposal/2` | Connect brain_dump execution to proposal | Exists, never called |
| `on_proposal_approved/1` | Handle proposal approval → create/find execution → dispatch | Exists, works |
| `link_session/2` | Link passive claude_session to execution | Exists, unused |
| `on_session_completed/2` | Handle completion → transition → patchback | Exists, needs fix: uses `session_id` lookup but should also support `execution_id` lookup |
| `dispatch_if_ready/1` | Broadcast dispatch if approved + no approval needed | Exists, works |
| `list_executions/1` | Query with optional filters | Exists, works |
| `get_execution/1` | Get by ID | Exists, works |
| `get_by_proposal/1` | Get by proposal_id | Exists, works |
| `get_by_brain_dump_item/1` | Get by brain_dump_item_id | Exists, works |
| `record_event/3` | Append to audit trail | Exists, works |
| `create_agent_session/2` | Create dispatch record | Exists, works |
| `complete_agent_session/2` | Mark session done + store result | Exists, unused |

**Changes needed:**
1. `on_session_completed/2` — add clause that accepts `execution_id` directly (not just `session_id`). The Dispatcher's local Claude fallback passes `execution.id` when `session_id` is nil.
2. `create/1` — accept and populate `intent_slug` and `intent_path` when provided.
3. `patch_intent_file/2` — extract to `IntentFolder` module.

### Ema.Executions.Dispatcher (`daemon/lib/ema/executions/dispatcher.ex`)

**Owns:** Subscribing to dispatch topic, building delegation packets, formatting prompts, dispatching to agents, handling fallback.

| Function | Purpose | Status |
|----------|---------|--------|
| `handle_info({:dispatch, execution})` | Receive dispatch, spawn task | Exists, works |
| `dispatch_execution/1` | Build packet → create session → attempt dispatch | Exists, works |
| `attempt_dispatch/3` | Try OpenClaw, fall back to local Claude | Exists, **broken** (G1) |
| `attempt_local_claude/2` | Run Claude CLI, call on_session_completed | Exists, **bug** (passes `execution.session_id` which is nil) |
| `build_packet/1` | Construct structured delegation packet | Exists, works |
| `format_prompt/1` | Convert packet to agent prompt text | Exists, works |

**Changes needed:**
1. Fix `attempt_dispatch/3` — call `OpenClaw.Client.spawn_agent("claude", %{prompt: prompt, metadata: %{execution_id: execution.id}})` instead of `send_message/1`.
2. Fix `attempt_local_claude/2` — call `on_session_completed` with `execution.id` instead of `execution.session_id`.
3. After local Claude returns, call `complete_agent_session/2` on the agent_session created in step prior.

### Ema.Executions.IntentFolder (NEW — `daemon/lib/ema/executions/intent_folder.ex`)

**Owns:** All filesystem operations on `.superman/intents/<slug>/` folders.

```elixir
defmodule Ema.Executions.IntentFolder do
  @moduledoc "Manages .superman/intents/<slug>/ lifecycle — create, patch, read status."

  @doc "Create a new intent folder with intent.md and status.json. Returns :ok or {:error, reason}."
  def create(project_path, slug, content)

  @doc "Write result.md with execution output. Overwrites previous result."
  def write_result(project_path, slug, result_summary)

  @doc "Append entry to execution-log.md."
  def append_log(project_path, slug, execution_id, mode, result_summary)

  @doc "Update status.json fields. Merges with existing."
  def update_status(project_path, slug, updates)

  @doc "Read and parse status.json. Returns {:ok, map} or {:error, reason}."
  def read_status(project_path, slug)

  @doc "Check if intent folder exists."
  def exists?(project_path, slug)

  @doc "Generate slug from arbitrary text."
  def slugify(text)
end
```

**Why separate module:** The file I/O code in `executions.ex:patch_intent_file/2` is already 30 lines. Adding folder creation and status reading would push it further. IntentFolder encapsulates the `.superman/` filesystem contract — a single place to change if the folder structure evolves.

### Ema.Harvesters.ExecutionHarvester (NEW — `daemon/lib/ema/harvesters/execution_harvester.ex`)

**Owns:** Watching for completed agent sessions and triggering `on_session_completed/2`.

```elixir
defmodule Ema.Harvesters.ExecutionHarvester do
  @moduledoc "Polls agent_sessions for completed sessions and triggers patchback."
  use GenServer

  # Polls every 30 seconds for agent_sessions with status "completed"
  # that have not yet triggered on_session_completed.
  # This handles the case where an external agent completes
  # but the REST callback was missed.

  # For local Claude: not needed (Dispatcher handles inline).
  # For remote agents: acts as a safety net alongside the REST endpoint.
end
```

**Priority:** Low. The REST completion endpoint (Step 5) is the primary path. This is a fallback for reliability. Build after the REST endpoint is proven.

### EmaWeb.ExecutionController (`daemon/lib/ema_web/controllers/execution_controller.ex`)

**Owns:** REST API surface for executions.

| Action | Route | Status |
|--------|-------|--------|
| `index` | `GET /api/executions` | Exists, works |
| `show` | `GET /api/executions/:id` | Exists, works |
| `create` | `POST /api/executions` | Exists, works |
| `approve` | `POST /api/executions/:id/approve` | Exists, works |
| `cancel` | `POST /api/executions/:id/cancel` | Exists, works |
| `events` | `GET /api/executions/:id/events` | Exists, works |
| `agent_sessions` | `GET /api/executions/:id/agent-sessions` | Exists, works |
| `complete` | `POST /api/executions/:id/complete` | **NEW** — accepts `{result_summary: "..."}`, calls `on_session_completed` |

**Changes needed:**
1. Add `complete/2` action.
2. Add route: `post "/executions/:id/complete", ExecutionController, :complete`

### EmaWeb.ExecutionChannel (NEW — `daemon/lib/ema_web/channels/execution_channel.ex`)

**Owns:** Real-time push of execution state to frontend.

```elixir
defmodule EmaWeb.ExecutionChannel do
  use EmaWeb, :channel

  @impl true
  def join("executions:lobby", _payload, socket) do
    send(self(), :after_join)
    {:ok, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    # Subscribe to PubSub "executions" topic
    Phoenix.PubSub.subscribe(Ema.PubSub, "executions")
    # Push initial state
    executions = Ema.Executions.list_executions()
    push(socket, "state", %{executions: serialize_all(executions)})
    {:noreply, socket}
  end

  # Forward PubSub messages to client
  def handle_info({"execution:created", execution}, socket) do
    push(socket, "execution:created", serialize(execution))
    {:noreply, socket}
  end

  def handle_info({"execution:updated", execution}, socket) do
    push(socket, "execution:updated", serialize(execution))
    {:noreply, socket}
  end

  def handle_info({"execution:completed", %{execution: execution, signal: signal}}, socket) do
    push(socket, "execution:completed", %{execution: serialize(execution), signal: signal})
    {:noreply, socket}
  end
end
```

**Registration in user_socket.ex:**
```elixir
channel "executions:*", EmaWeb.ExecutionChannel
```

---

## 5. Build Order

### Sprint 1: Fix + Wire (backend correctness)

**Step 1: Fix Dispatcher OpenClaw call + local Claude completion**  
- **Complexity:** S  
- **Dependencies:** None  
- **Risk:** Low  
- **Files:**  
  - `daemon/lib/ema/executions/dispatcher.ex:55-60` — Replace `Client.send_message(%{...})` with `Client.spawn_agent("claude", %{prompt: prompt, metadata: %{execution_id: execution.id}})`  
  - `daemon/lib/ema/executions/dispatcher.ex:76` — Replace `execution.session_id || execution.id` with `execution.id`  
- **Test:** Dispatcher dispatches without crash. Local Claude fallback calls `on_session_completed` with execution ID.

**Step 2: Create IntentFolder module + wire into BrainDump**  
- **Complexity:** M  
- **Dependencies:** None  
- **Risk:** Low  
- **Files:**  
  - New: `daemon/lib/ema/executions/intent_folder.ex` — `create/3`, `write_result/3`, `append_log/5`, `update_status/3`, `read_status/2`, `exists?/2`, `slugify/1`  
  - Modify: `daemon/lib/ema/brain_dump/brain_dump.ex:36-48` — Generate intent_slug via `IntentFolder.slugify(item.content)`, set `intent_path`, call `IntentFolder.create/3`  
  - Modify: `daemon/lib/ema/executions/executions.ex:257-298` — Replace inline `patch_intent_file/2` with calls to `IntentFolder`  
- **Test:** Creating a brain dump item produces an execution with `intent_slug` set AND a `.superman/intents/<slug>/` folder on disk with `intent.md` and `status.json`.

**Step 3: Fix on_session_completed to accept execution_id directly**  
- **Complexity:** S  
- **Dependencies:** Step 1  
- **Risk:** Low  
- **Files:**  
  - `daemon/lib/ema/executions/executions.ex:132` — Add `on_execution_completed(execution_id, result_summary)` that looks up by execution ID instead of session ID  
  - `daemon/lib/ema/executions/dispatcher.ex:76` — Call `on_execution_completed` instead of `on_session_completed`  
- **Test:** Local Claude fallback completes an execution, writes result to intent folder.

**Step 4: Add completion REST endpoint**  
- **Complexity:** S  
- **Dependencies:** Step 3  
- **Risk:** Low  
- **Files:**  
  - `daemon/lib/ema_web/controllers/execution_controller.ex` — Add `complete/2` action  
  - `daemon/lib/ema_web/router.ex:205` — Add `post "/executions/:id/complete", ExecutionController, :complete`  
- **Test:** `POST /api/executions/:id/complete` with `{result_summary: "..."}` transitions execution to completed.

**Step 5: Wire link_proposal into ProposalEngine**  
- **Complexity:** S  
- **Dependencies:** Step 2  
- **Risk:** Low  
- **Files:**  
  - `daemon/lib/ema/proposal_engine/generator.ex` — After creating proposal, if seed has `brain_dump_item_id`, call `Ema.Executions.link_proposal(item_id, proposal.id)`  
- **Test:** Brain dump item that generates a proposal has its execution linked to that proposal.

### Sprint 2: Frontend (user can see and interact with executions)

**Step 6: Build ExecutionChannel**  
- **Complexity:** S  
- **Dependencies:** Steps 1-4 (backend must broadcast correctly)  
- **Risk:** Low  
- **Files:**  
  - New: `daemon/lib/ema_web/channels/execution_channel.ex`  
  - Modify: `daemon/lib/ema_web/user_socket.ex` — Add `channel "executions:*", EmaWeb.ExecutionChannel`  
- **Test:** Join `executions:lobby`, receive `state` push with current executions, receive updates on transition.

**Step 7: Build execution-store.ts (Zustand)**  
- **Complexity:** M  
- **Dependencies:** Step 6  
- **Risk:** Low  
- **Files:**  
  - New: `app/src/stores/execution-store.ts` — Follow existing store pattern: `loadViaRest()` hits `GET /api/executions`, `connect()` joins `executions:lobby` channel. Actions: `approve(id)`, `cancel(id)`, `complete(id, summary)`.  
- **Test:** Store loads executions, subscribes to channel, updates on push events.

**Step 8: Build ExecutionsApp (HQ timeline)**  
- **Complexity:** L  
- **Dependencies:** Step 7  
- **Risk:** Medium (UI design decisions, glass aesthetic consistency)  
- **Files:**  
  - New: `app/src/components/executions/ExecutionsApp.tsx` — Vertical timeline, grouped by status. Cards show title, mode badge, status badge, timestamps. Approve/cancel buttons on pending items. Click to expand: objective, events, agent sessions.  
  - Modify: `app/src/types/workspace.ts` — Add `executions` to `APP_CONFIGS`  
  - Modify: `app/src/components/layout/Launchpad.tsx` — Add HQ tile  
  - Modify: `app/src/App.tsx` — Add route  
- **Test:** App renders, shows executions, approve button transitions execution, real-time updates via channel.

### Sprint 3: Close the loop (self-referential proof)

**Step 9: Self-referential test — complete this execution**  
- **Complexity:** S  
- **Dependencies:** Steps 1-4  
- **Risk:** Low  
- **Files:** No code changes — operational test  
- **What:**  
  1. Create execution row for `execution-first-ema-os` with mode `outline`, link to this intent folder  
  2. Write this outline as `result.md`  
  3. Append to `execution-log.md`  
  4. Update `status.json` with `latest_execution_id`, `completion_pct: 20`  
  5. Verify: `GET /api/executions?intent_slug=execution-first-ema-os` returns the execution  
- **Test:** Full loop demonstrated: execution exists in DB, result on disk, status.json reflects completion.

### Complexity summary

| Step | What | Size | Sprint |
|------|------|------|--------|
| 1 | Fix Dispatcher calls | S | 1 |
| 2 | IntentFolder + BrainDump wire | M | 1 |
| 3 | on_execution_completed | S | 1 |
| 4 | Completion REST endpoint | S | 1 |
| 5 | link_proposal wire | S | 1 |
| 6 | ExecutionChannel | S | 2 |
| 7 | execution-store.ts | M | 2 |
| 8 | ExecutionsApp (HQ) | L | 2 |
| 9 | Self-referential test | S | 3 |

**Total: 2S sprint + 1M sprint + 1L sprint = ~3 focused sessions.**

Sprint 1 is all backend — can be done in one session. Sprint 2 is frontend — store is straightforward, app is the largest piece. Sprint 3 is a 10-minute operational proof.

---

## Appendix: Key function signatures (for implementers)

### IntentFolder

```elixir
# Returns :ok | {:error, reason}
IntentFolder.create(
  "/home/trajan/Projects/ema",   # project_path
  "execution-first-ema-os",      # slug
  "Replace disconnected model…"  # raw content for intent.md
)

# Returns :ok | {:error, reason}
IntentFolder.write_result(project_path, slug, result_summary)

# Returns :ok | {:error, reason}
IntentFolder.append_log(project_path, slug, execution_id, mode, result_summary)

# Returns :ok | {:error, reason}
IntentFolder.update_status(project_path, slug, %{
  latest_execution_id: "abc123",
  completion_pct: 20,
  status: "in_progress"
})

# Returns "execution-first-ema-os"
IntentFolder.slugify("Execution-First EMA OS with Intent Folders!")
```

### Completion endpoint

```
POST /api/executions/:id/complete
Content-Type: application/json

{
  "result_summary": "Research complete. See research.md for findings."
}

Response 200:
{
  "execution": { ...serialized execution with status "completed"... }
}
```

### Delegation packet (as built by Dispatcher)

```elixir
%{
  execution_id: "u7NFG_WdyTg",
  project_slug: "ema",
  intent_slug: "execution-first-ema-os",
  agent_role: "outliner",
  objective: "Produce implementation outline for filesystem structure...",
  mode: "outline",
  requires_patchback: true,
  success_criteria: [
    "Filesystem structure defined",
    "Runtime schema specified",
    "Event flow documented",
    "App boundaries clear",
    "Build order established"
  ],
  read_files: [
    ".superman/intents/execution-first-ema-os/intent.md",
    ".superman/intents/execution-first-ema-os/signals.md",
    ".superman/project.md",
    ".superman/context.md",
    ".superman/intents/execution-first-ema-os/research.md"
  ],
  write_files: [
    ".superman/intents/execution-first-ema-os/outline.md",
    ".superman/intents/execution-first-ema-os/decisions.md"
  ],
  constraints: [
    "Do not modify files outside the write_files list",
    "Be specific and concrete — no vague conclusions",
    "Write complete file contents, not diffs"
  ]
}
```
