# EMA API Contracts

> **Base URL:** `http://localhost:4488/api`  
> **Auth:** None (local daemon, no auth)  
> **Format:** JSON request/response bodies  
> **WebSocket:** `ws://localhost:4488/socket`

---

## Feature F1: Workflow Observatory

### Intent Map

#### `GET /api/intent`
List intent nodes with optional filters.

**Query params:** `project_id`, `level` (0-4), `parent_id`

**Response:**
```json
{
  "nodes": [
    {
      "id": "int_f3a9b2c1",
      "title": "Proposal generation pipeline",
      "description": "Generator-Refiner-Debater-Scorer-Tagger PubSub chain",
      "level": 1,
      "level_name": "flow",
      "status": "complete",
      "linked_task_ids": ["tsk_a1b2", "tsk_c3d4"],
      "linked_wiki_path": "projects/ema/pipeline.md",
      "parent_id": "int_root001",
      "project_id": "pro_ema0001"
    }
  ]
}
```

#### `GET /api/intent/tree?project_id=pro_ema0001`
Return the full tree (nested children).

**Response:**
```json
{
  "tree": [
    {
      "id": "int_root001",
      "title": "Personal AI operating system",
      "level": 0,
      "level_name": "product",
      "children": [
        {
          "id": "int_f3a9b2c1",
          "title": "Proposal generation pipeline",
          "level": 1,
          "children": [...]
        }
      ]
    }
  ]
}
```

#### `POST /api/intent`
Create an intent node.

**Request:**
```json
{
  "title": "Refiner subscribes to PubSub :generated",
  "description": "Listens for proposals:pipeline :generated events and runs critique pass",
  "level": 3,
  "parent_id": "int_f3a9b2c1",
  "project_id": "pro_ema0001"
}
```

**Response:** `{ "node": {...} }` — same shape as list item

#### `PUT /api/intent/:id`
Update an intent node (title, description, status, linked_task_ids, linked_wiki_path).

#### `DELETE /api/intent/:id`
Delete an intent node (cascades to edges).

#### `POST /api/intent/edges`
Create a typed edge between two nodes.

**Request:**
```json
{
  "source_id": "int_a1b2",
  "target_id": "int_c3d4",
  "relationship": "implements"
}
```

Valid relationships: `depends-on`, `implements`, `enables`, `blocks`

---

### Gaps (Friction Map)

#### `GET /api/gaps`
**Query params:** `source`, `severity` (1-5), `project_id`, `status`

**Response:**
```json
{
  "gaps": [
    {
      "id": "gap_a1b2c3d4",
      "description": "Task 'Finish auth module' has not been updated in 14 days",
      "gap_type": "stale_task",
      "severity": 3,
      "status": "open",
      "source": "stale_tasks_scanner",
      "project_id": "pro_ema0001",
      "inserted_at": "2026-04-03T10:00:00Z"
    }
  ],
  "total": 12,
  "by_type": { "stale_task": 5, "orphan_note": 3, "missing_doc": 4 }
}
```

#### `POST /api/gaps/:id/resolve`
Mark a gap as resolved.

**Response:** `{ "gap": { "status": "resolved", ... } }`

#### `POST /api/gaps/:id/create_task`
Create a task to address this gap.

**Response:** `{ "task": { "id": "...", "title": "...", ... } }`

#### `GET /api/token-usage`
**Query params:** `days` (default: 30), `model`, `context`, `project_id`

**Response:**
```json
{
  "total_cost_usd": 4.72,
  "total_input_tokens": 847000,
  "total_output_tokens": 213000,
  "by_model": {
    "sonnet": { "cost_usd": 3.21, "calls": 47 },
    "haiku":  { "cost_usd": 0.12, "calls": 210 },
    "opus":   { "cost_usd": 1.39, "calls": 6 }
  },
  "daily_spend": [
    { "date": "2026-04-01", "cost_usd": 0.83 },
    { "date": "2026-04-02", "cost_usd": 1.12 }
  ],
  "forecast_7d_usd": 8.40,
  "spike_detected": false
}
```

#### WebSocket: `intent:live`
Broadcasts on node CRUD: `{ "event": "node_created" | "node_updated" | "node_deleted", "node": {...} }`

#### WebSocket: `gaps:live`
Broadcasts gap counts: `{ "event": "gaps_updated", "counts": { "open": 12, "by_type": {...} } }`

---

## Feature F2: Proposal Intelligence

### Proposals

#### `GET /api/proposals`
**Query params:** `status`, `project_id`, `tag`, `confidence_min`, `seed_id`

**Response:**
```json
{
  "proposals": [
    {
      "id": "prp_8a9b2c3d",
      "title": "Add real-time token streaming to proposal UI",
      "summary": "Show token generation live in the proposals app, stage by stage.",
      "status": "queued",
      "confidence": 0.82,
      "idea_score": 8,
      "prompt_quality_score": 7,
      "score_breakdown": {
        "codebase_coverage": 8,
        "architectural_coherence": 9,
        "impact": 8,
        "prompt_specificity": 7
      },
      "tags": ["ux", "streaming", "proposals"],
      "risks": ["Adds complexity to frontend state management"],
      "benefits": ["Immediate feedback", "Shows pipeline progress"],
      "intent_aligned": true,
      "duplicate_of": null,
      "seed_id": "sed_c1d2e3f4",
      "parent_proposal_id": null,
      "project_id": "pro_ema0001",
      "inserted_at": "2026-04-03T09:00:00Z"
    }
  ],
  "total": 47
}
```

#### `GET /api/proposals/:id`
Single proposal with full body included.

**Additional fields:** `"body": "## Problem\n\n..."`, `"generation_log": {...}`

#### `POST /api/proposals/:id/approve`
Approve a proposal → creates a task via the Pipes stock pipe.

**Response:**
```json
{
  "proposal": { "status": "approved", ... },
  "task": {
    "id": "tsk_x1y2z3",
    "title": "Add real-time token streaming to proposal UI",
    "status": "proposed",
    "source_type": "proposal",
    "source_id": "prp_8a9b2c3d",
    "project_id": "pro_ema0001"
  }
}
```

#### `POST /api/proposals/:id/redirect`
Redirect → generates 3 new seeds from the proposal's core idea.

**Request (optional):** `{ "angle": "focus on backend only" }` — optional guidance for seed generation

**Response:**
```json
{
  "proposal": { "status": "redirected", ... },
  "seeds": [
    { "id": "sed_new1", "name": "Backend streaming for proposals", ... },
    { "id": "sed_new2", "name": "Cost estimation per pipeline stage", ... },
    { "id": "sed_new3", "name": "Token budget UI for generator", ... }
  ]
}
```

#### `POST /api/proposals/:id/kill`
Kill a proposal → logged in KillMemory to suppress similar future proposals.

**Response:** `{ "proposal": { "status": "killed", ... }, "kill_pattern_id": "km_..." }`

#### `GET /api/proposals/:id/lineage`
Return full ancestry chain for a proposal.

**Response:**
```json
{
  "proposal_id": "prp_8a9b2c3d",
  "lineage": [
    {
      "id": "sed_c1d2e3f4",
      "type": "seed",
      "name": "EMA UX improvements",
      "seed_type": "cron"
    },
    {
      "id": "prp_parent001",
      "type": "proposal",
      "title": "Streaming UI for EMA",
      "status": "redirected",
      "generation": 1
    },
    {
      "id": "prp_8a9b2c3d",
      "type": "proposal",
      "title": "Add real-time token streaming to proposal UI",
      "status": "queued",
      "generation": 2
    }
  ]
}
```

### Seeds

#### `GET /api/seeds`
**Query params:** `project_id`, `active`, `seed_type`

**Response:** `{ "seeds": [{...}] }`

#### `POST /api/seeds`
Create a new seed.

**Request:**
```json
{
  "name": "Weekly architecture review",
  "prompt_template": "Review the EMA {{project_name}} codebase. What architectural improvements would most increase maintainability?",
  "seed_type": "cron",
  "schedule": "0 9 * * 1",
  "project_id": "pro_ema0001",
  "context_injection": {
    "include_project_context": true,
    "include_recent_proposals": 10,
    "include_active_tasks": 5
  }
}
```

#### `POST /api/engine/pause` / `POST /api/engine/resume`
Pause or resume the entire proposal pipeline. Scheduler stops dispatching seeds.

**Response:** `{ "status": "paused" | "running" }`

#### WebSocket: `proposal`
Channel `proposal:<proposal_id>` or `proposals:pipeline`.

Events: `proposal_created`, `proposal_updated`, `proposal_queued`, `proposal_pipeline_stage`.

Pipeline stage event format:
```json
{
  "event": "proposal_pipeline_stage",
  "proposal_id": "prp_8a9b2c3d",
  "stage": "refined",
  "data": { "updated_fields": ["body", "risks", "benefits"] }
}
```

---

## Feature F3: Persistent Sessions

### AI Sessions

#### `GET /api/sessions`
**Query params:** `status`, `agent_id`, `project_path`

**Response:**
```json
{
  "sessions": [
    {
      "id": "ais_a1b2c3",
      "status": "completed",
      "model": "sonnet",
      "provider_id": "claude-personal",
      "input_tokens": 4500,
      "output_tokens": 1200,
      "cost_usd": 0.032,
      "parent_id": null,
      "fork_message_id": null,
      "project_path": "/home/trajan/Projects/ema",
      "agent_id": null,
      "inserted_at": "2026-04-03T08:00:00Z",
      "updated_at": "2026-04-03T08:02:00Z"
    }
  ]
}
```

#### `GET /api/sessions/:id/messages`
Return all messages in a session (ordered by insertion).

**Response:**
```json
{
  "session_id": "ais_a1b2c3",
  "messages": [
    {
      "id": "aim_x1y2z3",
      "role": "user",
      "content": "Refine this proposal: ...",
      "metadata": {},
      "inserted_at": "2026-04-03T08:00:00Z"
    },
    {
      "id": "aim_x1y2z4",
      "role": "assistant",
      "content": "Here is the refined proposal...",
      "metadata": { "input_tokens": 450, "output_tokens": 1200 },
      "inserted_at": "2026-04-03T08:00:12Z"
    }
  ]
}
```

#### `POST /api/sessions/:id/fork`
Fork a session from a specific message.

**Request:**
```json
{ "message_id": "aim_x1y2z4" }
```

**Response:**
```json
{
  "session": {
    "id": "ais_forked001",
    "status": "active",
    "parent_id": "ais_a1b2c3",
    "fork_message_id": "aim_x1y2z4",
    "input_tokens": 0,
    "output_tokens": 0,
    "cost_usd": 0.0
  }
}
```

#### `POST /api/sessions/:id/resume`
Mark a session as active again (client side — actual resumption is handled when Bridge connects).

---

## Feature F4: Quality Gradient

Quality gate results are not surfaced via REST — they happen synchronously within pipeline stages. The Scorer's output is visible on proposals.

#### `GET /api/proposals?intent_aligned=true`
Filter proposals that passed intent alignment check.

#### `GET /api/proposals?idea_score_min=7`
Filter proposals by minimum idea score.

---

## Feature F5: Routing Engine

#### `GET /api/providers`
List all registered providers and their health.

**Response:**
```json
{
  "providers": [
    {
      "id": "claude-personal",
      "adapter": "ClaudeCLI",
      "healthy": true,
      "capabilities": ["streaming", "tools", "sessions"],
      "latency_ms": 450,
      "quality_score": 0.8,
      "rate_limit": {
        "requests_per_min": 60,
        "tokens_per_day": 1000000
      }
    },
    {
      "id": "ollama-local",
      "adapter": "Ollama",
      "healthy": true,
      "capabilities": ["streaming"],
      "latency_ms": 80,
      "quality_score": 0.5,
      "rate_limit": null
    }
  ]
}
```

#### `POST /api/providers/:id/health-check`
Force a health check on a specific provider.

**Response:** `{ "healthy": true | false, "latency_ms": 420, "error": null }`

#### `GET /api/routing/estimate`
Estimate cost for a task without running it.

**Request:**
```json
{
  "prompt": "Generate a proposal for improving the vault graph visualization",
  "task_type": "creative",
  "strategy": "balanced"
}
```

**Response:**
```json
{
  "estimates": [
    {
      "provider_id": "claude-personal",
      "model": "sonnet",
      "estimated_cost_usd": 0.018,
      "estimated_latency_ms": 2400,
      "quality_score": 0.8,
      "balanced_score": 0.74
    },
    {
      "provider_id": "ollama-local",
      "model": "llama3.3",
      "estimated_cost_usd": 0.0,
      "estimated_latency_ms": 800,
      "quality_score": 0.5,
      "balanced_score": 0.61
    }
  ],
  "recommended": "claude-personal/sonnet"
}
```

---

## Superman Integration

Superman is an external code intelligence service at `http://localhost:3000`. EMA proxies calls through REST endpoints.

#### `GET /api/superman/status`
Proxies `GET /` from Superman.

**Response:** `{ "status": "ok", "version": "...", "project": "..." }`

#### `POST /api/superman/index`
Index a repository.

**Request:** `{ "path": "/home/trajan/Projects/ema" }`

**Response:** `{ "indexed": true, "file_count": 2457 }`

#### `POST /api/superman/ask`
Ask a natural language question about the codebase.

**Request:**
```json
{
  "question": "What modules handle PubSub event routing?",
  "repo_path": "/home/trajan/Projects/ema"
}
```

**Response:**
```json
{
  "answer": "Phoenix.PubSub is configured in Ema.Application...",
  "references": [
    { "file": "lib/ema/application.ex", "line": 42 },
    { "file": "lib/ema/proposal_engine/generator.ex", "line": 88 }
  ]
}
```

#### `POST /api/superman/apply`
Apply a code change instruction.

**Request:**
```json
{
  "instruction": "Add intent_aligned field to the Proposal schema",
  "session_context": "Working on F4 quality gradient. Scorer needs to write intent alignment result to proposals table."
}
```

**Response:**
```json
{
  "success": true,
  "files_changed": [
    "daemon/lib/ema/proposals/proposal.ex",
    "daemon/priv/repo/migrations/20260403001_add_intent_aligned_to_proposals.exs"
  ],
  "tool_calls": [
    { "name": "Edit", "file": "...", "description": "Added intent_aligned field" }
  ]
}
```

**Timeout:** 180s. On timeout: `{ "error": "timeout", "partial_result": null }` — treat as non-destructive; re-run safe.

#### `GET /api/superman/gaps`
Get code intelligence gaps from Superman.

**Response:**
```json
{
  "gaps": [
    {
      "type": "missing_test",
      "file": "lib/ema/proposal_engine/scorer.ex",
      "description": "Scorer module has no corresponding test file"
    }
  ]
}
```

#### `GET /api/superman/intent-graph`
Get Superman's view of intent relationships from code analysis.

**Response:**
```json
{
  "nodes": [
    { "id": "scorer", "type": "module", "path": "lib/ema/proposal_engine/scorer.ex" }
  ],
  "edges": [
    { "from": "scorer", "to": "quality_gate", "type": "calls" }
  ]
}
```

---

## OpenClaw Integration

OpenClaw is the agent orchestration platform running at `http://localhost:18789`. EMA can dispatch work to OpenClaw agents for execution.

#### `POST /api/openclaw/dispatch`
Dispatch a task to an OpenClaw agent.

**Request:**
```json
{
  "agent_id": "coder",
  "task": "Implement the SupermanContinuityHook module at daemon/lib/ema/intelligence/superman_continuity_hook.ex",
  "context": {
    "project_path": "/home/trajan/Projects/ema",
    "session_id": "ais_a1b2c3"
  }
}
```

**Response:**
```json
{
  "dispatch_id": "ocl_dispatch_001",
  "status": "queued",
  "agent_id": "coder"
}
```

#### `GET /api/openclaw/dispatch/:id`
Poll dispatch status.

**Response:**
```json
{
  "dispatch_id": "ocl_dispatch_001",
  "status": "completed",
  "result": {
    "files_created": ["daemon/lib/ema/intelligence/superman_continuity_hook.ex"],
    "summary": "Created SupermanContinuityHook with before_call/2 and after_call/2"
  }
}
```

---

## Vault / Wiki MCP (for Claude Code sessions)

The MCP server at `daemon/priv/mcp/wiki-mcp-server.js` exposes EMA vault operations as MCP tools.

**Configuration for Claude Code** (`~/.claude/settings.json`):
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

**Available MCP tools:**

| Tool | Description |
|------|-------------|
| `wiki.search` | Full-text search of vault notes. Params: `query`, `space?`, `limit?` |
| `wiki.get` | Get a note by file path with full content. Params: `path` |
| `wiki.create` | Create a new vault note. Params: `path`, `title`, `content`, `space?`, `tags?[]` |
| `wiki.update` | Update note content. Params: `path`, `content` |
| `wiki.related` | Find notes linked to a given note. Params: `path`, `limit?` |
| `wiki.gaps` | Find orphan notes and low-connectivity areas. Params: none |
| `wiki.graph` | Get full knowledge graph (nodes + edges). Params: `depth?` |

**Example MCP call result for `wiki.search`:**
```json
{
  "count": 3,
  "notes": [
    {
      "id": "vn_a1b2c3",
      "file_path": "projects/ema/pipeline.md",
      "title": "Proposal Pipeline Design",
      "space": "projects",
      "tags": ["proposals", "pipeline", "architecture"],
      "snippet": "...Generator → Refiner → Debater → Scorer..."
    }
  ]
}
```

---

## Error Responses

All endpoints return standard error shapes:

```json
{ "error": "not_found", "message": "Proposal prp_xyz not found" }
{ "error": "validation_failed", "details": { "title": ["can't be blank"] } }
{ "error": "upstream_timeout", "message": "Superman call timed out after 180s" }
{ "error": "circuit_tripped", "message": "Provider claude-personal circuit breaker tripped (hard)" }
```

**HTTP status codes:**
- `200` — success
- `201` — created
- `400` — bad request / validation error
- `404` — not found
- `422` — unprocessable (business rule failure)
- `503` — upstream service unavailable (Superman, Claude CLI)
- `504` — upstream timeout
