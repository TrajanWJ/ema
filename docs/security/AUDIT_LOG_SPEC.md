# EMA Audit Log Specification

> Which operations are logged, what fields are required, and how to query them.
> **Last Updated:** 2026-04-03

---

## Purpose

EMA's audit log answers: "What happened, when, why, and what did it touch?"

It's not a debug log. It's not an error log. It's a structured record of security-relevant operations that a user can review if something unexpected happens ("Why did the engine generate a proposal about X?" / "Who approved this task?").

---

## Schema

```elixir
defmodule Ema.Audit.Event do
  schema "audit_events" do
    field :event_type, :string        # See event type catalog below
    field :actor, :string             # "user" | "engine" | "pipe" | "harvester:<name>" | "superman"
    field :action, :string            # What was done
    field :resource_type, :string     # "proposal" | "task" | "seed" | "pipe" | "agent" | "setting"
    field :resource_id, :string       # ID of the affected record (string for flexibility)
    field :metadata, :map             # Event-specific fields (see catalog)
    field :outcome, :string           # "success" | "failure" | "blocked"
    field :failure_reason, :string    # Set when outcome = "failure" or "blocked"
    field :ip_source, :string         # "local" | "localhost" — always local for EMA

    timestamps(type: :utc_datetime)
  end
end
```

---

## Event Type Catalog

### Proposal Lifecycle

| event_type | actor | When fired | Required metadata fields |
|---|---|---|---|
| `proposal.generated` | `engine` | Proposal created by pipeline | `seed_id`, `generator_stage`, `confidence` |
| `proposal.refined` | `engine` | Refiner pass complete | `proposal_id`, `confidence_delta` |
| `proposal.debated` | `engine` | Debater pass complete | `proposal_id`, `confidence`, `steelman_present`, `redteam_present` |
| `proposal.tagged` | `engine` | Tagger assigns tags | `proposal_id`, `tags` |
| `proposal.queued` | `engine` | Proposal enters review queue | `proposal_id` |
| `proposal.approved` | `user` | User approves proposal | `proposal_id`, `task_id_created` |
| `proposal.redirected` | `user` | User redirects proposal | `proposal_id`, `redirect_note_length`, `seeds_created` |
| `proposal.killed` | `user` | User kills proposal | `proposal_id`, `kill_memory_updated` |
| `proposal.kill_suppressed` | `engine` | Proposal blocked by KillMemory | `proposal_id`, `matched_pattern` |

### Seed Lifecycle

| event_type | actor | When fired | Required metadata fields |
|---|---|---|---|
| `seed.created` | `user` | User creates a seed | `seed_id`, `seed_type`, `has_schedule` |
| `seed.created_by_harvester` | `harvester:<name>` | Harvester generates seed | `seed_id`, `source_file`, `source_length` |
| `seed.created_by_combiner` | `engine` | Combiner creates cross-pollination seed | `seed_id`, `parent_proposal_ids` |
| `seed.fired` | `engine` | Seed dispatched to Generator | `seed_id`, `run_count` |
| `seed.modified` | `user` | User edits seed template | `seed_id`, `fields_changed` |
| `seed.deleted` | `user` | User deletes seed | `seed_id` |
| `seed.toggled` | `user` | User enables/disables seed | `seed_id`, `new_state` |

### Task Lifecycle

| event_type | actor | When fired | Required metadata fields |
|---|---|---|---|
| `task.created` | `user` / `engine` | Task created | `task_id`, `source_type`, `source_id` |
| `task.status_changed` | `user` | Task status transition | `task_id`, `from_status`, `to_status` |
| `task.decomposed` | `user` | Task broken into subtasks | `task_id`, `subtask_ids` |

### Engine Operations

| event_type | actor | When fired | Required metadata fields |
|---|---|---|---|
| `engine.paused` | `user` | User pauses proposal engine | — |
| `engine.resumed` | `user` | User resumes proposal engine | — |
| `engine.rate_limit_hit` | `engine` | Rate limit triggered | `component`, `limit_type`, `current_count` |
| `engine.circuit_breaker_tripped` | `engine` | Error rate exceeded threshold | `component`, `error_count`, `window_seconds` |

### Agent Operations

| event_type | actor | When fired | Required metadata fields |
|---|---|---|---|
| `agent.message_sent` | `user` | User sends message to agent | `agent_id`, `message_length` |
| `agent.claude_called` | `engine` | AgentWorker calls Claude CLI | `agent_id`, `prompt_length`, `flags_used` |
| `agent.memory_summarized` | `engine` | AgentMemory runs summarization | `agent_id`, `messages_compressed`, `token_count` |
| `agent.created` | `user` | New agent created | `agent_id`, `model`, `tools_enabled` |
| `agent.tool_executed` | `engine` | Agent tool runs | `agent_id`, `tool_name`, `outcome` |

### Pipe Operations

| event_type | actor | When fired | Required metadata fields |
|---|---|---|---|
| `pipe.created` | `user` | User creates a pipe | `pipe_id`, `trigger_pattern`, `action_type` |
| `pipe.executed` | `pipe` | Pipe Executor runs a pipe | `pipe_id`, `trigger_event`, `action_type`, `outcome` |
| `pipe.rate_limited` | `engine` | Pipe hit rate limit | `pipe_id`, `executions_in_window` |
| `pipe.action_blocked` | `engine` | Blocked action type attempted | `pipe_id`, `attempted_action_type` |

### External Integration Operations

| event_type | actor | When fired | Required metadata fields |
|---|---|---|---|
| `superman.called` | `engine` / `user` | Superman API called | `request_payload_hash`, `response_received`, `latency_ms` |
| `superman.response_rejected` | `engine` | Superman response failed validation | `rejection_reason` |
| `claude_session.imported` | `engine` | Session JSONL parsed and imported | `session_id`, `project_linked`, `file_size_bytes` |
| `claude_session.parse_error` | `engine` | JSONL parse failed | `file_path`, `error_type` |

### Security Events (always log, never suppress)

| event_type | When fired | Required metadata fields |
|---|---|---|
| `security.input_sanitized` | Harvester/parser strips injection attempt | `source`, `pattern_matched`, `content_length_before`, `content_length_after` |
| `security.path_traversal_blocked` | Path validation rejects traversal attempt | `attempted_path`, `validated_path` |
| `security.rate_limit_blocked` | Request blocked by rate limiter | `endpoint`, `requester`, `limit_type` |
| `security.pipe_action_blocked` | Pipe tried disallowed action type | `pipe_id`, `action_type` |
| `security.kill_memory_anomaly` | > 20 kills in 5 minutes | `kill_count`, `window_seconds` |

---

## Implementation

### Writing Events

```elixir
defmodule Ema.Audit do
  @spec log(String.t(), String.t(), String.t(), String.t(), map()) :: :ok
  def log(event_type, actor, resource_type, resource_id, metadata \\ %{}) do
    %Ema.Audit.Event{}
    |> Ema.Audit.Event.changeset(%{
      event_type: event_type,
      actor: actor,
      resource_type: resource_type,
      resource_id: resource_id,
      metadata: metadata,
      outcome: "success",
      ip_source: "local"
    })
    |> Ema.Repo.insert()
    # Fire and forget — audit failures must not break the operation
    :ok
  end

  @spec log_blocked(String.t(), String.t(), String.t(), String.t(), String.t(), map()) :: :ok
  def log_blocked(event_type, actor, resource_type, resource_id, reason, metadata \\ %{}) do
    # Same as log/5 but outcome: "blocked", failure_reason: reason
  end
end
```

### Querying Events

The admin dashboard exposes an audit log view with:
- Filter by: event_type, actor, resource_type, date range
- Sort by: inserted_at (default desc)
- Export: JSON

Phoenix Channel `audit:live` broadcasts security events in real-time for live monitoring in the admin dashboard.

### Retention

- Default retention: 90 days
- Security events: 365 days (never auto-deleted)
- User can export before deletion

### Indexes

```elixir
# In migration:
create index(:audit_events, [:event_type])
create index(:audit_events, [:actor])
create index(:audit_events, [:resource_type, :resource_id])
create index(:audit_events, [:inserted_at])
# Composite for security monitoring:
create index(:audit_events, [:event_type, :inserted_at])
```

---

## What Is NOT Logged

- Routine read operations (viewing proposals, loading task boards, reading vault notes)
- Internal GenServer state transitions (use telemetry for those)
- Claude CLI outputs (too large; session summaries are stored in `claude_sessions` table)

The audit log is about **actions with side effects** — things that change state, call external systems, or represent security events.

---

## Adversarial Test Cases

These are test scenarios the Coder should implement to verify audit log coverage. If any of these tests fail, the security gate is broken:

```
test "proposal.approved logged when user approves"
test "proposal.killed logged when user kills"
test "seed.created_by_harvester logged with source info"
test "pipe.action_blocked logged when executor tries disallowed action"
test "security.input_sanitized logged when harvester strips injection"
test "security.path_traversal_blocked logged on traversal attempt"
test "superman.called logged on every API call"
test "engine.circuit_breaker_tripped logged when error threshold hit"
test "audit event written even when main operation fails"  # critical: audit must not be skipped on error
```
