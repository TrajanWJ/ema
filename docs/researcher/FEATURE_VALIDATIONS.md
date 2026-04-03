# EMA Feature Validations

**Researcher Agent — Feature Validation Layer**
**Date:** 2026-04-03
**Status:** Living document — updated as features ship and are tested

---

## Methodology

Each feature is validated against:
1. **Claim** — what the spec says the feature does
2. **Test criteria** — how to verify it
3. **Result** — pass / partial / fail / not-testable
4. **Evidence** — what was actually observed
5. **Gaps** — what still needs fixing

---

## F1 — Intent Graph (Workflow Observatory / Intent-Driven Analysis)

### Claim
The IntentMap provides a 5-level hierarchy (Product → Flow → Action → System → Implementation) with typed edges, real-time updates, and enables "search by intent" — linking high-level goals down to code-level nodes.

### Success Criteria
- [ ] Can create an intent node at each of the 5 levels
- [ ] Can create typed edges between nodes (depends-on, implements, enables, blocks)
- [ ] `tree/1` returns a correctly nested hierarchy
- [ ] Real-time channel updates fire on node create/update/delete
- [ ] Frontend tree renders all 5 levels with correct parent-child relationships
- [ ] Intent search returns nodes and traces full path Product→Implementation

### Current Evidence

**What's built (verified from codebase):**
- `Ema.Intelligence.IntentMap` — Full CRUD: `list_nodes/1`, `get_node/1`, `create_node/1`, `update_node/1`, `delete_node/1`
- `IntentNode` schema: `level` (0-4), `title`, `description`, `parent_id`, `project_id`, `linked_task_ids`, `linked_wiki_path`
- `IntentEdge` schema: `source_id`, `target_id`, relationship type
- `IntentMapApp.tsx` frontend component exists with tree visualization
- Channel `intent:live` broadcasts node CRUD in real-time

**What's NOT built:**
- `tree/1` function appears to be missing from the module (only list_nodes with filters exists)
- Intent search — not implemented (FEATURES.md says "Not implemented: Intent search across the hierarchy")
- Flow-to-code swimlane visualization — not implemented
- Automatic linking between intent nodes and code files — manual only (via `linked_task_ids`, not automatic)

### Result: **PARTIAL**

The data model is correct. The tree API endpoint exists. Real-time sync is wired. But the core user-facing claim ("search by intent") is not testable yet — search isn't built, and the `tree/1` hierarchical builder needs verification.

### Validation Test (Trajan can run this)
```bash
# On host machine
cd ~/Projects/ema
# Start daemon, then:
curl http://localhost:4488/api/intent/nodes \
  -H "Content-Type: application/json"
# Should return array of intent nodes
# If empty, seed one:
curl -X POST http://localhost:4488/api/intent/nodes \
  -H "Content-Type: application/json" \
  -d '{"title": "Personal AI OS", "level": 0}'
# Then check tree:
curl http://localhost:4488/api/intent/nodes?level=0
```

### Gaps / Next Steps
1. Implement `tree/1` — build hierarchical from flat list. Simple recursive grouping by `parent_id`.
2. Add intent search endpoint — FTS5 across title+description+linked fields
3. Wire Superman `get_flows` output → auto-generate Level 3/4 nodes from code analysis
4. The claim "search by intent" requires a search UI in IntentMapApp — add search box with full-path results

---

## F2 — Durable Context (Session Memory / Proposal Genealogy)

### Claim
EMA survives gateway restart. Sessions, memory fragments, decisions, and proposal genealogy persist in SQLite — not in-memory. After a restart, the daemon rehydrates from the database.

### Success Criteria
- [ ] Daemon restart does not lose in-flight proposals
- [ ] Session memory fragments survive restart
- [ ] Intent nodes survive restart
- [ ] Pipe run history survives restart
- [ ] Token tracking history survives restart
- [ ] GapInbox state survives restart

### Current Evidence

**What's built:**
- All state is in SQLite via Ecto — no in-memory-only critical state found
- `session_memories` table via `MemoryFragment` schema
- `proposal_seeds`, `proposals`, `proposal_tags` — all Ecto-persisted
- `token_events`, `token_budgets` — Ecto-persisted
- `gaps` table — Ecto-persisted
- OTP GenServers hold runtime state but load from DB on `init`

**Key risk to verify:**
- `GapScanner` and `GapInbox.scan_all()` — do they lose scan state on restart? They appear to be pure scanners (no in-memory scan cursor), so restart just triggers a fresh scan at boot (30s delay). ✅ Acceptable.
- `ProposalEngine.Scheduler` — holds current seed schedules in GenServer state. On restart, it reloads active seeds from DB. Need to verify `Scheduler.init/1` does this correctly.
- `KillMemory` — stores pattern state. Needs to reload from DB on start.

### Result: **LIKELY PASS (needs live verification)**

Architecture is correct — SQLite-first. The specific concern is whether `KillMemory` and `Scheduler` reload their state from DB on restart, vs. starting cold.

### Validation Test (Trajan can run this)
```bash
# On host: start daemon, create a few proposals and seeds
# Note the IDs
curl http://localhost:4488/api/proposals | jq '.[0].id'
curl http://localhost:4488/api/seeds | jq '.[0].id'

# Restart the daemon
pkill -f "mix phx.server" && cd ~/Projects/ema/daemon && mix phx.server &
sleep 5

# Verify same data
curl http://localhost:4488/api/proposals | jq '.[0].id'  # Should match
curl http://localhost:4488/api/seeds | jq '.[0].id'       # Should match
```

### Gaps
1. Add a startup log in `KillMemory.init/1` confirming how many patterns were reloaded
2. Verify `Scheduler.init/1` queries active seeds from DB at start (check `ProposalEngine.Scheduler`)
3. Consider a "daemon health" endpoint: `GET /api/health` that reports uptime, loaded seeds, pipeline status — useful for diagnosing post-restart state

---

## F3 — Proposal Engine Pipeline (Proposal Intelligence)

### Claim
The 5-stage pipeline (Scheduler → Generator → Refiner → Debater → Scorer → Tagger) runs autonomously. Seeds fire on schedule. Each stage handles failures gracefully. The pipeline produces quality-gated proposals.

### Success Criteria
- [ ] Scheduler dispatches a seed on its configured interval
- [ ] Generator produces a structured proposal from a seed
- [ ] Refiner strengthens the proposal (measurably different from raw)
- [ ] Debater produces steelman + red-team + synthesis + confidence score
- [ ] Scorer produces idea_score and prompt_quality_score (1-10 each)
- [ ] Tagger assigns at least one tag and sets status to "queued"
- [ ] User can approve/redirect/kill from frontend
- [ ] Killing a proposal logs to KillMemory (verify Jaccard dedup next time)

### Current Evidence

**From FEATURES.md (current status):**
- ✅ Full pipeline wired via PubSub
- ✅ Scheduler dispatching seeds
- ✅ KillMemory tracking patterns
- ✅ Combiner cross-pollination
- ✅ Context injection
- ✅ User actions wired

**Unverified claims:**
- Does the Refiner actually produce meaningfully different output? (Hard to verify without running it)
- Scorer's cosine similarity dedup (>0.85 threshold) — needs an actual vector store or falls back to keyword comparison?
- Stage failure isolation — if Generator hangs, does it block the whole pipeline?

**Risk:** `Ema.Vectors` module exists (from `ls daemon/lib/ema/`). If Scorer uses actual embeddings, it needs a vector store. If that's not running, scoring may silently skip dedup.

### Result: **NEEDS LIVE TEST**

The architecture is correct and all stages exist. But the actual quality of output and failure handling needs a real test with Claude running.

### Validation Test (Trajan can run this)
```bash
# On host: ensure daemon is running and Claude CLI is available
which claude  # Should exist

# Create a test seed
curl -X POST http://localhost:4488/api/seeds \
  -H "Content-Type: application/json" \
  -d '{"name": "test-seed", "prompt_template": "Brainstorm 1 improvement to EMA brain dump feature", "schedule": null, "active": true}'

# Immediately run it
curl -X POST http://localhost:4488/api/seeds/{ID}/run-now

# Check proposals queue after ~60s
curl http://localhost:4488/api/proposals | jq '.[] | {title, confidence, status, estimated_scope}'

# Verify it went through all stages
curl http://localhost:4488/api/proposals/{ID} | jq '{steelman, red_team, synthesis, confidence, tags}'
```

### Gaps
1. **Stage failure isolation**: Add supervision for each pipeline stage. If Generator crashes (Claude timeout), it should restart without killing Refiner/Debater.
2. **Scoring without vectors**: Verify what happens when `Ema.Vectors` isn't initialized. Scorer should degrade gracefully to keyword-only dedup.
3. **Auto-approve**: Not implemented. Proposals with confidence >0.85 AND idea_score >8 should be auto-approved (per spec). This is missing.

---

## F4 — Decision Memory (Decision Memory Feature)

### Claim
Decisions are captured from sessions, vault notes, and explicit logging. Past decisions surface as precedents when similar decisions arise.

### Success Criteria
- [ ] `SessionMemory.extract_fragments_for_session/1` extracts decisions, insights, blockers
- [ ] Vault graph correctly identifies decision notes by typed edges
- [ ] `context_for_project/1` returns relevant past decisions
- [ ] WikiSync suggests vault note updates when code changes
- [ ] Git watcher detects commits and triggers analysis

### Result: **PARTIAL**

Infrastructure is built (session memory extraction, git watcher, wiki sync). But automatic precedent surfacing is not implemented — it's a manual lookup only via `search_sessions/1`.

### Key Gap
The most valuable claim — "surface relevant precedents when similar decisions arise" — is not implemented. This is the feature users would actually feel. It requires:
1. Hook into proposal/task creation
2. Search decision memory for related past decisions
3. Inject as context into the creation workflow

---

## F5 — Agent Routing / Orchestration (Execution Fabric)

### Claim
Agent routing correctly dispatches tasks to the right agent. The system handles failures, tracks outcomes, and routes with measurable accuracy.

### Success Criteria
- [ ] `AgentWorker.send_message/2` correctly routes to Claude CLI
- [ ] Tool calls are executed against the Pipes registry
- [ ] Agent memory compresses at >20 messages
- [ ] Session watcher auto-links sessions to projects
- [ ] Trust scores are recalculated daily

### Current Evidence

**Working:**
- `AgentWorker` — GenServer per agent, Claude CLI invocation
- `AgentMemory` — compresses at >20 messages
- Session watching/parsing — confirmed
- Trust scoring — `TrustScorer` with daily recalculation

**Not working:**
- Agent tool execution limited: only `brain_dump:create_item` implemented
- Discord/Telegram adapters — stubbed (need nostrum/ex_gram deps)
- Execution dispatcher — scaffolded but not integrated
- No routing *accuracy* metric exists yet — "correctly routes" is unmeasured

### Result: **PARTIAL**

Routing works for the webchat channel. But multi-channel routing (Discord, Telegram) is blocked on dependency installation. And the routing "accuracy" claim is unmeasurable without actual usage data.

### Validation Test (Trajan can run this)
```bash
# On host: test agent chat via webchat
curl -X POST http://localhost:4488/api/agents/{AGENT_SLUG}/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a brain dump item: test routing validation", "conversation_id": null}'
# Should return response AND create a brain dump item (if brain_dump:create_item tool is working)

# Verify the brain dump item was created
curl http://localhost:4488/api/brain-dump | jq '.items[] | select(.content | contains("test routing"))'
```

---

## F6 — Pattern Crystallizer

### Claim
EMA detects recurring successful patterns at 5+ occurrences / 70%+ success rate and proposes crystallization.

### Result: **SCAFFOLDED ONLY**

Evolution engine has schema and API but the actual pattern detection logic is stubbed. The scan endpoint exists but doesn't actually find patterns.

### Gap
This is the highest-risk feature — it promises something that requires real usage data (5+ pipe runs, task completions, etc.). It can't be meaningfully tested until the system has been in use for weeks.

**Recommendation:** Deprioritize for Sprint 2. Come back after 30 days of real usage.

---

## F7 — Proposal Genealogy DAG

### Claim
A tree visualization shows how proposals evolved — parents, redirect forks, cross-pollinations.

### Result: **DATA EXISTS, UI MISSING**

`parent_proposal_id`, `seed_id`, and `generation_log` are all tracked. Lineage REST endpoint exists. But the Evolution view (DAG visualization) in `ProposalsApp` is not built.

### Gap
The `react-force-graph-2d` package is installed but unused. Connect it to the lineage data and render the tree in `ProposalsApp` Evolution tab.

---

## Summary Table

| Feature | Claim Status | What's Working | Key Gap |
|---|---|---|---|
| F1 Intent Graph | PARTIAL | CRUD, real-time sync, tree data | Search by intent not implemented |
| F2 Durable Context | LIKELY PASS | SQLite-first architecture | Need to verify Scheduler/KillMemory reload |
| F3 Proposal Pipeline | NEEDS TEST | Pipeline wired, stages exist | Need live run with Claude |
| F4 Decision Memory | PARTIAL | Extraction, git watch | Automatic precedent surfacing missing |
| F5 Agent Routing | PARTIAL | Webchat routing works | Multi-channel blocked, no accuracy metric |
| F6 Pattern Crystallizer | SCAFFOLDED | Schema, API | Pattern detection logic not implemented |
| F7 Proposal Genealogy | DATA OK | DB tracking, REST | Frontend visualization not built |

---

## Test Script for Trajan

A single integrated test to run after daemon startup:

```bash
#!/bin/bash
# EMA Feature Smoke Test
BASE="http://localhost:4488/api"

echo "=== 1. Intent Graph ==="
curl -s -X POST "$BASE/intent/nodes" \
  -H "Content-Type: application/json" \
  -d '{"title": "Personal AI OS", "level": 0}' | jq '.id'

echo "=== 2. Proposal Seed (F3) ==="
SEED=$(curl -s -X POST "$BASE/seeds" \
  -H "Content-Type: application/json" \
  -d '{"name": "smoke-test", "prompt_template": "Suggest 1 improvement to task management", "active": true}' | jq -r '.id')
echo "Seed: $SEED"

echo "=== 3. Run Seed Now ==="
curl -s -X POST "$BASE/seeds/$SEED/run-now" | jq '.status'

echo "=== 4. Check Proposals After 60s ==="
sleep 60
curl -s "$BASE/proposals" | jq 'length'

echo "=== 5. Gap Scan ==="
curl -s "$BASE/gaps" | jq 'length'

echo "=== 6. Token Tracking ==="
curl -s "$BASE/tokens/summary" | jq '.total_cost_usd'

echo "=== 7. Daemon Health ==="
curl -s "$BASE/vm/health" | jq '.status'
```
