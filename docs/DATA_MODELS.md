# EMA Data Models

> **Status:** As-built, April 2026  
> **Database:** SQLite via `ecto_sqlite3` at `~/.local/share/ema/ema.db`  
> **ID format:** String IDs with 3-letter prefix + 8 random chars (e.g., `pro_a1b2c3d4`)

---

## Feature F1 — Workflow Observatory

### `intent_nodes`

Maps high-level product intent down to implementation. 5 levels: `0=product, 1=flow, 2=action, 3=system, 4=implementation`.

```elixir
schema "intent_nodes" do
  field :id,              :string        # "int_a1b2c3d4"
  field :title,           :string
  field :description,     :string
  field :level,           :integer       # 0-4
  field :status,          :string        # "planned" | "partial" | "complete"
  field :linked_task_ids, :string        # JSON array of task IDs (stringified)
  field :linked_wiki_path,:string        # e.g. "projects/ema/refiner.md"
  belongs_to :parent,   IntentNode, type: :string  # nil for level-0 roots
  belongs_to :project,  Project,    type: :string
  timestamps(type: :utc_datetime)
end
```

**Indexes:** `(project_id)`, `(level)`, `(parent_id)`

**Example:**
```json
{
  "id": "int_f3a9b2c1",
  "title": "Proposal generation pipeline",
  "level": 1,
  "description": "Generator-Refiner-Debater-Scorer-Tagger PubSub chain",
  "status": "complete",
  "linked_task_ids": "[\"tsk_a1b2\", \"tsk_c3d4\"]",
  "project_id": "pro_ema0001"
}
```

### `intent_edges`

Typed relationships between intent nodes.

```elixir
schema "intent_edges" do
  field :id,           :string
  field :relationship, :string   # "depends-on" | "implements" | "enables" | "blocks"
  belongs_to :source,  IntentNode, type: :string
  belongs_to :target,  IntentNode, type: :string
  timestamps(type: :utc_datetime)
end
```

### `gaps`

Detected friction points from 7 automated scanners.

```elixir
schema "gaps" do
  field :id,          :string
  field :description, :string
  field :gap_type,    :string     # "stale_task" | "orphan_note" | "incomplete_goal" |
                                  # "missing_doc" | "todo_code" | "unlinked_proposal" |
                                  # "idle_responsibility"
  field :severity,    :integer    # 1-5
  field :status,      :string     # "open" | "resolved" | "ignored"
  field :source,      :string     # which scanner generated it
  belongs_to :project, Project, type: :string
  timestamps(type: :utc_datetime)
end
```

**Indexes:** `(status, severity)`, `(project_id)`

### `token_events`

Every Claude call recorded for cost tracking.

```elixir
schema "token_events" do
  field :id,            :string
  field :model,         :string      # "opus" | "sonnet" | "haiku" | ...
  field :input_tokens,  :integer
  field :output_tokens, :integer
  field :cost_usd,      :float       # calculated at insert time
  field :context,       :string      # "proposal" | "agent" | "pipe" | ...
  belongs_to :project, Project, type: :string
  timestamps(type: :utc_datetime)
end
```

**Indexes:** `(inserted_at)`, `(model)`, `(context)`

**Cost rates** (hardcoded in `TokenTracker`):
| Model | Input /1M | Output /1M |
|-------|-----------|------------|
| opus  | $15.00    | $75.00     |
| sonnet| $3.00     | $15.00     |
| haiku | $0.25     | $1.25      |

---

## Feature F2 — Proposal Intelligence

### `proposals`

Core proposal record, updated at each pipeline stage.

```elixir
schema "proposals" do
  field :id,                   :string
  field :title,                :string
  field :summary,              :string
  field :body,                 :string
  field :status,               :string     # "draft" | "refined" | "debated" | "scored" | "queued" |
                                           # "approved" | "redirected" | "killed"
  field :confidence,           :float      # 0.0-1.0, set by Debater
  field :idea_score,           :integer    # 1-10, set by Scorer
  field :prompt_quality_score, :integer    # 1-10, set by Scorer
  field :score_breakdown,      :map        # {codebase_coverage, architectural_coherence, impact, prompt_specificity}
  field :risks,                {:array, :string}
  field :benefits,             {:array, :string}
  field :tags,                 {:array, :string}   # set by Tagger
  field :generation_log,       :map        # pipeline metadata / timing
  field :embedding,            :binary     # vector embedding (stored as binary)
  field :intent_aligned,       :boolean, default: false   # set by Scorer via F1 check
  field :duplicate_of,         :string     # ID of similar proposal if flagged

  belongs_to :project,          Project,  type: :string
  belongs_to :seed,             Seed,     type: :string   # origin seed
  belongs_to :parent_proposal,  __MODULE__, type: :string # for redirect lineage

  has_many :tags_assoc, ProposalTag
  timestamps(type: :utc_datetime)
end
```

**Indexes:** `(status)`, `(project_id)`, `(seed_id)`, `(parent_proposal_id)`, `(inserted_at)`

**Example:**
```json
{
  "id": "prp_8a9b2c3d",
  "title": "Add real-time token streaming to proposal UI",
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
  "benefits": ["Immediate feedback loop for users", "Shows pipeline progress"],
  "intent_aligned": true,
  "seed_id": "sed_c1d2e3f4",
  "parent_proposal_id": null,
  "project_id": "pro_ema0001"
}
```

### `proposal_seeds`

Templates that drive the Generator. Scheduled or one-shot.

```elixir
schema "proposal_seeds" do
  field :id,                :string
  field :name,              :string
  field :prompt_template,   :string   # {{project_name}}, {{recent_tasks}} etc.
  field :seed_type,         :string   # "cron" | "git" | "session" | "vault" | "usage" |
                                      # "brain_dump" | "cross" | "dependency"
  field :schedule,          :string   # cron expression or nil
  field :active,            :boolean, default: true
  field :last_run_at,       :utc_datetime
  field :run_count,         :integer, default: 0
  field :context_injection, :map      # which context docs to inject
  field :metadata,          :map
  belongs_to :project, Project, type: :string
  has_many :proposals, Proposal
  timestamps(type: :utc_datetime)
end
```

### `proposal_tags`

Many-to-many join between proposals and tag strings.

```elixir
schema "proposal_tags" do
  field :id,   :string
  field :name, :string
  belongs_to :proposal, Proposal, type: :string
  timestamps(type: :utc_datetime)
end
```

---

## Feature F3 — Persistent Sessions

### `ai_sessions`

EMA-managed AI conversation sessions (not to be confused with `claude_sessions` which track host Claude Code sessions).

```elixir
schema "ai_sessions" do
  field :id,             :string
  field :status,         :string     # "active" | "completed" | "error" | "forked"
  field :model,          :string
  field :provider_id,    :string
  field :input_tokens,   :integer, default: 0
  field :output_tokens,  :integer, default: 0
  field :cost_usd,       :float,   default: 0.0
  field :parent_id,      :string     # set when forked from another session
  field :fork_message_id,:string     # message ID where fork branched
  field :project_path,   :string     # optional: linked project directory
  field :context_summary,:string     # injected at session start
  field :metadata,       :map        # arbitrary: {agent_id, seed_id, stage, ...}
  belongs_to :agent, Ema.Agents.Agent, type: :string
  has_many :messages, AiSessionMessage
  timestamps(type: :utc_datetime)
end
```

**Indexes:** `(status)`, `(agent_id)`, `(parent_id)`

### `ai_session_messages`

Individual messages within an AI session.

```elixir
schema "ai_session_messages" do
  field :id,         :string
  field :role,       :string   # "user" | "assistant" | "tool" | "system"
  field :content,    :string
  field :metadata,   :map      # {tool_name, files_touched, token_count, ...}
  belongs_to :session, AiSession, type: :string
  timestamps(type: :utc_datetime)
end
```

### `claude_sessions`

Read-only import of host Claude Code sessions from `~/.claude/projects/**/*.jsonl`.

```elixir
schema "claude_sessions" do
  field :id,            :string
  field :session_id,    :string     # from JSONL filename
  field :status,        :string     # "active" | "completed" | "unknown"
  field :project_path,  :string     # from JSONL content
  field :token_count,   :integer
  field :files_touched, {:array, :string}
  field :tool_calls,    :map        # parsed tool call summary
  field :started_at,    :utc_datetime
  field :ended_at,      :utc_datetime
  belongs_to :project, Project, type: :string
  timestamps(type: :utc_datetime)
end
```

**Note:** Written by `SessionWatcher` + `SessionLinker`. Read-only to application code. Not synced bidirectionally.

---

## Feature F4 — Quality Gradient

### Quality Scores (embedded in `proposals`)

Quality signals live in the `proposals` table (no separate schema). Key fields set by the Scorer stage:

| Field | Type | Set By | Meaning |
|-------|------|--------|---------|
| `confidence` | float 0-1 | Debater | Debate verdict strength |
| `idea_score` | integer 1-10 | Scorer | Overall idea quality (4-dim avg) |
| `prompt_quality_score` | integer 1-10 | Scorer | How actionable the proposal text is |
| `score_breakdown` | map | Scorer | `{codebase_coverage, architectural_coherence, impact, prompt_specificity}` each 1-10 |
| `intent_aligned` | boolean | Scorer/F1 | Whether body references known intent nodes |
| `duplicate_of` | string | Scorer | ID of similar proposal if cosine similarity > 0.85 |

### QualityGate Result Format

Not a DB schema — in-memory only. Pattern-matched in pipeline stages:

```elixir
# Returns one of:
{:accept, result}
{:accept_with_warnings, result, [warning_string, ...]}
{:regenerate, feedback_string}   # triggers another AI.run with feedback
```

---

## Feature F5 — Routing Engine

### Routing Decisions (ephemeral, in-memory)

SmartRouter decisions are in-process state only — not persisted to DB. The decision struct:

```elixir
defmodule Ema.Claude.SmartRouter.RouteTarget do
  @enforce_keys [:provider_id, :account_id, :model, :adapter_module]
  defstruct [
    :provider_id,      # e.g. "claude-personal"
    :account_id,       # from AccountManager
    :model,            # e.g. "opus" | "sonnet" | "haiku"
    :adapter_module,   # Ema.Claude.Adapters.ClaudeCLI
    :strategy,         # :balanced | :cheapest | :fastest | :best | :round_robin | :failover
    :task_type,        # :code_generation | :code_review | :summarization | :creative | ...
    :estimated_cost,   # float USD (optional)
    :reasoning         # string explanation (debug)
  ]
end
```

### Provider Registry (in-memory, GenServer state)

```elixir
# Provider entry in ProviderRegistry state:
%{
  id:           "claude-personal",
  adapter:      Ema.Claude.Adapters.ClaudeCLI,
  healthy:      true,
  last_check:   ~U[2026-04-03 10:00:00Z],
  capabilities: [:streaming, :tools, :sessions],
  rate_limit:   %{requests_per_min: 60, tokens_per_day: 1_000_000},
  latency_ms:   450,   # rolling average
  quality_score: 0.8   # updated by F4 fitness signals
}
```

### `usage_records` (persisted cost data)

```elixir
schema "usage_records" do
  field :id,            :string
  field :provider_id,   :string
  field :model,         :string
  field :input_tokens,  :integer
  field :output_tokens, :integer
  field :cost_usd,      :float
  field :task_type,     :string
  field :duration_ms,   :integer
  field :success,       :boolean
  field :metadata,      :map
  timestamps(type: :utc_datetime)
end
```

---

## Supporting Schemas (shared across features)

### `projects`

```elixir
schema "projects" do
  field :id,           :string
  field :slug,         :string
  field :name,         :string
  field :description,  :string
  field :status,       :string   # "incubating" | "active" | "paused" | "completed" | "archived"
  field :icon,         :string
  field :color,        :string
  field :linked_path,  :string   # git repo or directory on disk
  field :context_hash, :string   # hash of last built context.md
  field :settings,     :map
  belongs_to :parent,          __MODULE__, type: :string
  belongs_to :source_proposal, Proposal,  type: :string
  has_many :tasks,            Task
  has_many :proposals,        Proposal
  has_many :seeds,            Seed
  has_many :sessions,         ClaudeSession
  timestamps(type: :utc_datetime)
end
```

### `tasks`

```elixir
schema "tasks" do
  field :id,           :string
  field :title,        :string
  field :description,  :string
  field :status,       :string     # "proposed" | "todo" | "in_progress" | "in_review" | "done" | ...
  field :priority,     :integer    # 1 (critical) - 5
  field :source_type,  :string     # "proposal" | "responsibility" | "brain_dump" | "manual" | ...
  field :source_id,    :string
  field :effort,       :string     # "xs" | "s" | "m" | "l" | "xl"
  field :due_date,     :date
  field :recurrence,   :string
  field :completed_at, :utc_datetime
  field :metadata,     :map
  belongs_to :project,         Project,  type: :string
  belongs_to :goal,            Goal,     type: :string
  belongs_to :responsibility,  Responsibility, type: :string
  belongs_to :parent,          __MODULE__, type: :string
  has_many :subtasks,   __MODULE__, foreign_key: :parent_id
  has_many :comments,   Comment
  has_many :agent_runs, Run
  many_to_many :blocked_by, __MODULE__, join_through: "task_dependencies", ...
  timestamps(type: :utc_datetime)
end
```

---

## Migration Order

Correct migration order (foreign key dependencies):

```
1. projects
2. goals
3. tasks, task_comments, task_dependencies
4. proposal_seeds
5. proposals, proposal_tags
6. habits, habit_logs
7. journal_entries
8. responsibilities, check_ins
9. brain_dump_items
10. claude_sessions
11. agents, agent_channels, agent_conversations, agent_messages, agent_runs
12. pipes, pipe_actions, pipe_transforms, pipe_runs
13. vault_notes, vault_links
14. canvases, canvas_elements, canvas_data_sources
15. intent_nodes, intent_edges
16. gaps
17. token_events, token_budgets
18. memory_fragments
19. decisions
20. ai_sessions, ai_session_messages
21. usage_records, audit_logs
22. providers, provider_accounts
23. behavior_rules (evolution)
24. app_shortcuts, settings, workspace_windows
```

---

## Key Constraints & Invariants

| Constraint | Where enforced |
|-----------|----------------|
| Proposal status only moves forward (never backward) | `Proposal.changeset/2` validates inclusion in status list |
| `level` in intent_nodes is 0–4 | `validate_number` in `IntentNode.changeset/2` |
| `confidence` is 0.0–1.0 | `validate_number` in `Proposal.changeset/2` |
| `idea_score` and `prompt_quality_score` are 1–10 | `validate_number` in `Proposal.changeset/2` |
| Sessions are append-only (messages never deleted) | No delete route in `AiSessionMessage` |
| Proposals can only be killed once (KillMemory check) | `KillMemory.check_similar/1` before Generator runs |
| SmartRouter never routes to a tripped circuit | `CircuitBreaker.check(provider_id)` in `SmartRouter.route/2` |
