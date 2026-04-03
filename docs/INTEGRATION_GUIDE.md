# EMA Integration Guide

> **Audience:** The Coder agent building EMA features  
> **Purpose:** Complete spec for all external integrations — Superman, OpenClaw, Vault, and the cross-feature wiring between F1–F5

---

## 1. Superman Integration

### What Superman Is

Superman is an external code intelligence server (not part of EMA). It runs as a separate process at `localhost:3000` and provides:
- Codebase indexing and semantic search
- Natural language questions answered with code references
- Autonomous code modification (`apply-changes`)
- Flow diagram extraction
- Intent graph extraction from code structure

EMA does **not** manage Superman's lifecycle. It's a peer service.

### Connection

**Client module:** `Ema.Intelligence.SupermanClient` (`daemon/lib/ema/intelligence/superman_client.ex`)

```elixir
# Base URL from env or default
base_url = System.get_env("SUPERMAN_URL", "http://localhost:3000")
```

**Health check before every call:**
```elixir
case SupermanClient.health_check() do
  {:ok, _} -> proceed()
  {:error, reason} ->
    Logger.warning("[Superman] Unavailable: #{inspect(reason)}")
    {:error, :superman_unavailable}
end
```

### Endpoint Map

| EMA Intent | Superman Endpoint | Method | Timeout |
|-----------|------------------|--------|---------|
| Index a repo | `/project/set` | POST | 30s |
| Ask codebase question | `/query` | POST | 120s |
| Get improvement suggestions | `/suggestions` | GET | 30s |
| Get code flow diagrams | `/project/flows` | GET | 30s |
| Apply code changes | `/apply-changes` | POST | 180s |
| Autonomous improvement | `/project/self-evolve` | POST | 300s |
| Get intent graph | `/intent-graph` | GET | 30s |
| Get panels (UI data) | `/project/panels` | GET | 30s |
| Build from task | `/project/build` | POST | 180s |
| Simulate flow | `/simulate` | POST | 120s |

### Session Continuity Hook (F3 ↔ Superman)

The `SupermanContinuityHook` ensures Superman's code modifications are tracked in EMA's session store.

**Location:** `daemon/lib/ema/intelligence/superman_continuity_hook.ex`

```elixir
defmodule Ema.Intelligence.SupermanContinuityHook do
  @moduledoc """
  Before/after wrapper for Superman API calls.
  Writes session context before calls and imports tool_calls after.
  """

  alias Ema.Claude.SessionManager
  require Logger

  @doc """
  Attach session context to Superman options.
  Returns enriched opts map with :session_context key.
  """
  @spec before_call(session_id :: String.t(), opts :: map()) :: map()
  def before_call(session_id, opts) do
    case SessionManager.get_session(session_id) do
      nil -> opts
      session ->
        summary = SessionManager.build_context_summary(session)
        Map.put(opts, :session_context, summary)
    end
  end

  @doc """
  Import Superman's tool calls back as session messages.
  """
  @spec after_call(session_id :: String.t(), superman_result :: map()) :: :ok
  def after_call(session_id, %{"tool_calls" => tool_calls}) when is_list(tool_calls) do
    Enum.each(tool_calls, fn tc ->
      SessionManager.add_message(session_id, "tool", tc["description"] || tc["name"], %{
        tool: tc["name"],
        files_touched: tc["files"] || []
      })
    end)
    :ok
  end
  def after_call(_session_id, _result), do: :ok
end
```

**Usage pattern:**
```elixir
session_id = SessionManager.create_session(%{context: "intent-driven analysis"})
enriched = SupermanContinuityHook.before_call(session_id, %{instruction: task})
case SupermanClient.apply_task(enriched.instruction) do
  {:ok, result} ->
    SupermanContinuityHook.after_call(session_id, result)
    {:ok, result}
  {:error, reason} ->
    Logger.warning("[Superman] apply_task failed: #{inspect(reason)}")
    {:error, reason}
end
```

### Error Handling

```
Superman call
  ↓
{:ok, result}            → proceed
{:error, :timeout}       → log, return {:error, :superman_timeout}
{:error, status >= 500}  → log, retry once after 2s, then error
{:error, :econnrefused}  → log, return {:error, :superman_unavailable}
```

**Rule:** Never block user-facing operations on Superman. All Superman calls should be background or timeout-guarded. If Superman is down, features degrade gracefully (proposals still generate without code-aware context).

---

## 2. OpenClaw Integration

### What OpenClaw Is

OpenClaw is Trajan's agent VM gateway (`localhost:18789`). EMA can dispatch work to OpenClaw agents (coder, researcher, ops, etc.) for long-running tasks.

### Provider Adapter

**Location:** `daemon/lib/ema/claude/adapters/openclaw.ex`

Selected when SmartRouter routes to provider `"openclaw-gateway"`.

```elixir
defmodule Ema.Claude.Adapters.OpenClaw do
  @behaviour Ema.Claude.Backend

  @gateway_url System.get_env("OPENCLAW_URL", "http://localhost:18789")

  def run(prompt, opts) do
    agent_id = Keyword.get(opts, :agent_id, "main")
    model    = Keyword.get(opts, :model, "claude-sonnet-4-6")

    payload = %{task: prompt, model: model, return_result: true}

    case Req.post("#{@gateway_url}/api/agents/#{agent_id}/dispatch",
           json: payload, receive_timeout: 300_000) do
      {:ok, %{status: 200, body: %{"result" => result}}} ->
        {:ok, %{text: result}}
      {:ok, %{status: status, body: body}} ->
        {:error, %{status: status, body: body}}
      {:error, reason} ->
        {:error, reason}
    end
  end

  def stream(prompt, opts, callback) do
    case run(prompt, opts) do
      {:ok, result} -> callback.({:complete, result})
      {:error, reason} -> callback.({:error, reason})
    end
  end

  def capabilities, do: [:dispatch, :agents]

  def healthy? do
    match?({:ok, %{status: 200}}, Req.get("#{@gateway_url}/health", receive_timeout: 5_000))
  end
end
```

### Outcome-to-Session Bridge

When OpenClaw completes a dispatch, record the result as a session message:
```elixir
# After successful OpenClaw dispatch:
SessionManager.add_message(session_id, "tool", "OpenClaw dispatch completed", %{
  agent_id: agent_id,
  files_changed: result["files_changed"] || [],
  summary: result["summary"]
})
```

---

## 3. Vault Integration

### Vault Location

EMA's built-in vault: `~/.local/share/ema/vault/`

This is **separate** from Trajan's host Obsidian vault. The EMA vault is managed entirely by EMA.

### Write Path

All vault writes go through `SecondBrain` context or `SystemBrain`. Never write directly to the filesystem.

```elixir
# Create a note
Ema.SecondBrain.create_note(%{
  file_path: "proposals/prp_8a9b2c3d.md",
  title: "Add real-time token streaming",
  content: "# Proposal\n\n...",
  space: "proposals",
  tags: ["ux", "streaming"]
})

# Update a note
Ema.SecondBrain.update_note("proposals/prp_8a9b2c3d.md", new_content)

# Search vault
Ema.SecondBrain.search("streaming proposals")
```

### Wikilink Conventions by Feature

| Feature | Vault path | Wikilink format |
|---------|-----------|-----------------|
| Projects | `projects/<slug>.md` | `[[projects/ema]]` |
| Proposals | `proposals/<id>.md` | `[[proposals/prp_8a9b2c3d]]` |
| Sessions | `sessions/<date>-<id>.md` | `[[sessions/2026-04-03-ais_a1b2c3]]` |
| Decisions | `decisions/<id>.md` | `[[decisions/dec_001]]` |
| Intent nodes | `intent/<id>.md` | `[[intent/int_f3a9b2c1]]` |
| System state | `system/state/*.md` | Written by SystemBrain (read-only) |

### MCP Server for Claude Code

The wiki MCP server allows Claude Code sessions to read/write EMA vault notes:

```json
{
  "mcpServers": {
    "ema-wiki": {
      "command": "node",
      "args": ["/home/trajan/Projects/ema/daemon/priv/mcp/wiki-mcp-server.js"],
      "env": { "EMA_BASE_URL": "http://localhost:4488" }
    }
  }
}
```

EMA daemon must be running — MCP server proxies REST calls to `localhost:4488`.

**Available MCP tools:** `wiki.search`, `wiki.get`, `wiki.create`, `wiki.update`, `wiki.related`, `wiki.gaps`, `wiki.graph`

---

## 4. Cross-Feature Wiring

### F1 ↔ F2: Intent-Genealogy Bridge

**What:** Proposals carry genealogy (seed_id, parent_proposal_id) that maps into the IntentMap hierarchy. Combiner creates cross-pollination seeds referencing multiple parents.

**Integration point:** `IntentMap.find_relevant_nodes/1`

```elixir
# To build in IntentMap:
def find_relevant_nodes(text) when is_binary(text) do
  all_nodes = list_nodes()
  downcased = String.downcase(text)
  Enum.filter(all_nodes, fn node ->
    String.contains?(downcased, String.downcase(node.title))
  end)
end
```

**Called by Scorer** after computing scores:
```elixir
nodes = IntentMap.find_relevant_nodes(proposal.body || proposal.title)
Proposals.update_proposal(proposal.id, %{intent_aligned: length(nodes) > 0})
```

**Lineage query** (`GET /api/proposals/:id/lineage`) traverses:
1. `proposal.parent_proposal_id` → direct parent proposal
2. `proposal.seed_id` → origin seed
3. Recurse on parent until nil

### F1 ↔ F5: Budget & Quality Signals to SmartRouter

**What:** CostForecaster detects cost spikes → signals SmartRouter to temporarily prioritize cheaper providers. Scorer publishes quality scores per provider+model → SmartRouter adjusts quality tiers.

**PubSub topic:** `"routing:signals"`

**CostForecaster emits** (to build):
```elixir
# In Ema.Intelligence.CostForecaster.check_spikes/0:
if spike_detected do
  Phoenix.PubSub.broadcast(Ema.PubSub, "routing:signals", {:budget_spike, :over_threshold})
end
```

**Scorer emits** (to build):
```elixir
# In Ema.ProposalEngine.Scorer, after persisting scores:
provider_id = get_in(proposal.generation_log, ["provider_id"])
model = get_in(proposal.generation_log, ["model"])
if provider_id && model do
  Phoenix.PubSub.broadcast(Ema.PubSub, "routing:signals", {
    :quality_signal, provider_id, model, proposal.idea_score / 10.0
  })
end
```

**SmartRouter subscribes** (to build in `init/1`):
```elixir
Phoenix.PubSub.subscribe(Ema.PubSub, "routing:signals")

# Handlers:
def handle_info({:budget_spike, :over_threshold}, state) do
  Logger.info("[SmartRouter] Budget spike — boosting cost weight")
  {:noreply, %{state | balanced_weights: %{cost: 0.60, latency: 0.25, quality: 0.15}}}
end

def handle_info({:quality_signal, provider_id, model, score}, state) do
  key = {provider_id, model}
  scores = Map.put(state.quality_scores || %{}, key, score)
  {:noreply, %{state | quality_scores: scores}}
end
```

### F2 ↔ F3: Session Context for Generator

**What:** ContextManager injects recent AI session summaries into Generator prompts so proposals have awareness of recent work.

**SessionManager method to build:**
```elixir
def context_for_project(project_path) do
  Repo.all(
    from s in AiSession,
    where: s.project_path == ^project_path and s.status == "completed",
    order_by: [desc: s.inserted_at],
    limit: 5,
    preload: :messages
  )
  |> Enum.map(fn session ->
    last_msg = List.last(session.messages)
    snippet = if last_msg, do: String.slice(last_msg.content, 0, 200), else: ""
    "Session #{session.id} (#{session.input_tokens + session.output_tokens} tokens): #{snippet}"
  end)
end
```

**ContextManager** includes in prompt:
```elixir
recent_sessions = SessionManager.context_for_project(project.linked_path || "")
session_block = if recent_sessions != [] do
  "## Recent AI Sessions\n" <> Enum.join(recent_sessions, "\n")
else
  ""
end
```

### F2 ↔ F4: Quality Gate in Pipeline

**What:** Scorer calls QualityGate after computing dimension scores. On `:regenerate`, it re-dispatches to Generator with feedback.

```elixir
# In Scorer.do_score/1:
result_map = %{
  "title" => proposal.title,
  "summary" => proposal.summary,
  "body" => proposal.body,
  "risks" => proposal.risks || [],
  "benefits" => proposal.benefits || []
}

iteration = proposal.quality_iteration || 1

case QualityGate.evaluate(result_map, :proposal, iteration) do
  {:accept, _} ->
    persist_scores(proposal, vector, breakdown)

  {:accept_with_warnings, _, warnings} ->
    persist_scores(proposal, vector, breakdown, warnings: warnings)

  {:regenerate, feedback} when iteration < 3 ->
    Proposals.update_proposal(proposal.id, %{quality_iteration: iteration + 1})
    Generator.regenerate(proposal, feedback)

  {:regenerate, _feedback} ->
    # Max iterations — accept with warnings
    persist_scores(proposal, vector, breakdown,
      warnings: ["Max quality iterations (3) reached"])
end
```

**Generator.regenerate/2** (to build):
```elixir
def regenerate(proposal, feedback) do
  GenServer.cast(__MODULE__, {:regenerate, proposal, feedback})
end

def handle_cast({:regenerate, proposal, feedback}, state) do
  Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
    prompt = """
    You previously generated this proposal but it failed quality checks:

    Title: #{proposal.title}
    Body: #{proposal.body}

    Quality feedback:
    #{feedback}

    Please regenerate addressing all issues. Return the same JSON structure.
    """
    case Ema.Claude.AI.run(prompt, model: "opus") do
      {:ok, result} ->
        Ema.Proposals.update_proposal(proposal.id, parse_regenerated(result))
        Phoenix.PubSub.broadcast(Ema.PubSub, "proposals:pipeline",
          {:proposals, :generated, Ema.Proposals.get_proposal(proposal.id)})
      {:error, reason} ->
        Logger.warning("[Generator] Regeneration failed: #{inspect(reason)}")
    end
  end)
  {:noreply, state}
end
```

### F3 ↔ Superman: Continuity Hook

Fully specified in Section 1 above. The hook wraps `before_call/2` and `after_call/2` around any Superman call that modifies code.

**Where to wire it:** Any controller action that calls `SupermanClient.apply_task/1`, `SupermanClient.build_task/1`, or `SupermanClient.autonomous_run/0`.

### F4 ↔ F1: Intent Alignment Check

Already described in the F1 ↔ F2 section. The Scorer is the single integration point:
1. Scorer computes 4-dimension scores
2. Scorer calls `IntentMap.find_relevant_nodes/1`
3. Sets `intent_aligned` flag on proposal
4. Broadcasts quality signal to SmartRouter (F5)

### F5 ↔ All: RoutingEngine Consumes Everything

SmartRouter is the terminal consumer of signals from all features:

```
F1 (CostForecaster) ──budget_spike──→ SmartRouter (boost cost weight)
F4 (Scorer)         ──quality_signal──→ SmartRouter (update quality tiers)
F3 (CircuitBreaker) ──trip/reset──→ SmartRouter (exclude/include provider)
```

The SmartRouter PubSub subscription on `"routing:signals"` is the single ingress point for all external signals.

---

## 5. Transaction Boundaries

### What's Atomic (single DB transaction)

| Operation | Scope |
|-----------|-------|
| Proposal status update + tag creation | Single Repo.transaction |
| Task creation from approved proposal | Single Repo.transaction (proposal update + task insert) |
| Session create + first message | Single Repo.transaction |
| Seed creation from redirect | Single Repo.transaction (proposal update + 3 seed inserts) |
| KillMemory pattern insert | Single Repo.insert (no transaction needed) |

### What's Eventual Consistency

| Operation | Why |
|-----------|-----|
| Pipeline stages (Generator → Refiner → ...) | Each stage is an async Task under PubSub — stages can fail independently |
| Superman call + session import | Superman is external; after_call may fail even if Superman succeeded |
| Scorer quality signal → SmartRouter | PubSub cast; SmartRouter may lag behind Scorer |
| GapScanner → gap records | Scans are best-effort; stale gaps are cleaned on next scan |
| SystemBrain vault writes | Debounced 5s; crash between event and write loses update (self-heals on next event) |

### Recovery Paths

| Failure | Recovery |
|---------|----------|
| Generator fails mid-proposal | Proposal never created — next Scheduler tick re-dispatches seed |
| Refiner/Debater/Scorer/Tagger fails | Upstream proposal stays at previous stage; stage restarts (OTP) and re-subscribes; next matching PubSub event re-triggers |
| Superman timeout | Caller gets `{:error, :superman_timeout}`; session records partial state; user can retry |
| SmartRouter state lost (process crash) | Restarts with default weights; quality_scores rebuild as Scorer emits new signals |
| SessionManager crash | Restarts from SQLite — all sessions/messages persisted; in-flight cost tracking lost for current session only |
| CircuitBreaker crash | Restarts with all circuits closed — conservative but safe |

---

## 6. PubSub Topic Index

All Phoenix.PubSub topics used across features:

| Topic | Publisher | Subscriber(s) | Message Format |
|-------|-----------|---------------|----------------|
| `"proposals:pipeline"` | Generator, Refiner, Debater, Scorer, Tagger | Next pipeline stage | `{:proposals, stage_atom, proposal}` |
| `"pipes:config"` | Pipes.Loader | Pipes.Executor | `:pipes_changed` |
| `"pipe_trigger:<pattern>"` | Pipes.EventBus | Pipes.Executor | `{:pipe_event, trigger_pattern, payload}` |
| `"pipes:monitor"` | Pipes.Executor | Frontend channel | `{:pipe_run, pipe_id, status}` |
| `"claude_sessions"` | SessionWatcher | SystemBrain | `{:session_detected, %{id, session_id, status}}` |
| `"ema:claude:events"` | Bridge | Any subscriber | StreamParser tagged tuples |
| `"routing:signals"` | CostForecaster, Scorer | SmartRouter | `{:budget_spike, ...}` / `{:quality_signal, ...}` |
| `"intelligence:vm"` | VmMonitor | Frontend channel | `{:vm_health, %{status, latency_ms, ...}}` |
| `"intelligence:trust"` | TrustScorer | Frontend channel | `{:trust_updated, %{score, badge, ...}}` |
| `"intent:live"` | IntentMap controller | Frontend channel | `{:node_created/updated/deleted, node}` |
| `"gaps:live"` | GapScanner | Frontend channel | `{:gaps_updated, counts}` |

---

## 7. Checklist: What Coder Needs to Build

### New Modules

- [ ] `Ema.Intelligence.SupermanContinuityHook` — before_call/2, after_call/2
- [ ] `IntentMap.find_relevant_nodes/1` — text-match intent nodes against proposal body
- [ ] `SessionManager.context_for_project/1` — return recent session summaries for a project path
- [ ] `SessionManager.build_context_summary/1` — summarize a session for injection
- [ ] `Generator.regenerate/2` — re-run generation with QualityGate feedback

### New PubSub Wiring

- [ ] CostForecaster → `"routing:signals"` with `{:budget_spike, :over_threshold}`
- [ ] Scorer → `"routing:signals"` with `{:quality_signal, provider_id, model, score}`
- [ ] SmartRouter subscribe to `"routing:signals"` in `init/1`
- [ ] SmartRouter handle_info for `:budget_spike` and `:quality_signal`

### Schema Changes

- [ ] Add `intent_aligned` boolean to `proposals` table (migration)
- [ ] Add `quality_iteration` integer to `proposals` table (migration)
- [ ] Add `generation_log` should include `provider_id` and `model` fields (update Generator to write these)

### Integration Wiring

- [ ] Wrap Superman apply/build/autonomous calls with SupermanContinuityHook in controllers
- [ ] Wire ContextManager to call `SessionManager.context_for_project/1`
- [ ] Wire Scorer to call `IntentMap.find_relevant_nodes/1` and set `intent_aligned`
- [ ] Wire Scorer to broadcast quality signal after persisting scores
- [ ] Wire QualityGate loop in Scorer.do_score/1 with regeneration path
