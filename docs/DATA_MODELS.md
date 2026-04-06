# EMA Data Models

> **Status:** As-built, April 2026
> **Database:** SQLite via `ecto_sqlite3` at `~/.local/share/ema/ema.db`
> **ID format:** String IDs with 3-letter prefix + 8 random chars (e.g., `pro_a1b2c3d4`)
> **Schemas:** 84 Ecto schemas across 55+ context modules
> **Migrations:** 86 migration files (2026-03-29 through 2026-04-11)

---

## Table of Contents

1. [Core Domain](#core-domain) — Projects, Tasks, Brain Dump, Goals, Habits, Journal
2. [Proposals & Seeds](#proposals--seeds) — Proposal pipeline, seeds, tags
3. [Execution & Automation](#execution--automation) — Executions, Pipes, Campaigns
4. [Agents](#agents) — Agent fleet, channels, conversations, runs
5. [AI Sessions](#ai-sessions) — AI sessions, Claude sessions, CLI sessions
6. [Intelligence](#intelligence) — Tokens, gaps, intent, memory, trust, context
7. [Knowledge & Vault](#knowledge--vault) — Second Brain, notes, links
8. [Business](#business) — Contacts, Finance, Invoices, Meetings
9. [System](#system) — Organizations, Spaces, Settings, Workspace, Evolution, Temporal
10. [Migration Index](#migration-index) — Complete migration listing

---

## Core Domain

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
  field :github_url,   :string   # added 20260403
  field :space_id,     :string   # added 20260409
  belongs_to :parent,          __MODULE__, type: :string
  belongs_to :source_proposal, Proposal,  type: :string
  has_many :tasks, :proposals, :seeds, :sessions
  timestamps(type: :utc_datetime)
end
```

**Indexes:** `(slug)` unique, `(status)`, `(space_id)`

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
  field :agent_intent, :string     # added 20260407 — intent for agent execution
  field :space_id,     :string     # added 20260409
  belongs_to :project, :goal, :responsibility, :parent
  has_many :subtasks, :comments, :agent_runs
  many_to_many :blocked_by (via task_dependencies)
  timestamps(type: :utc_datetime)
end
```

**Indexes:** `(status)`, `(project_id)`, `(goal_id)`, `(parent_id)`, `(space_id)`

### `task_dependencies`

Join table for task blocking relationships.

```
source_task_id, target_task_id
```

### `task_comments`

```elixir
schema "task_comments" do
  field :id, :string
  field :body, :string
  belongs_to :task, type: :string
  timestamps(type: :utc_datetime)
end
```

### `brain_dump_items` (inbox_items)

```elixir
schema "inbox_items" do
  field :id,        :string
  field :content,   :string
  field :source,    :string
  field :processed, :boolean, default: false
  field :action,    :string
  field :project_id,:string
  field :space_id,  :string      # added 20260409
  # Intent-enhanced fields (20260409):
  field :intent_type,    :string
  field :priority_hint,  :integer
  field :entity_refs,    {:array, :string}
  field :intent_metadata,:map
  timestamps(type: :utc_datetime)
end
```

### `goals`

```elixir
schema "goals" do
  field :id,          :string
  field :title,       :string
  field :description, :string
  field :status,      :string
  field :due_date,    :date
  field :progress,    :integer
  field :space_id,    :string     # added 20260409
  belongs_to :project, type: :string
  has_many :tasks
  timestamps(type: :utc_datetime)
end
```

### `habits`

```elixir
schema "habits" do
  field :id,        :string
  field :name,      :string
  field :frequency, :string
  field :streak,    :integer, default: 0
  field :archived,  :boolean, default: false
  field :space_id,  :string      # added 20260409
  has_many :logs, HabitLog
  timestamps(type: :utc_datetime)
end
```

### `habit_logs`

```elixir
schema "habit_logs" do
  field :id, :string
  field :date, :date
  field :completed, :boolean
  belongs_to :habit, type: :string
  timestamps(type: :utc_datetime)
end
```

### `journal_entries`

```elixir
schema "journal_entries" do
  field :id,     :string
  field :date,   :date
  field :body,   :string
  field :mood,   :integer
  field :energy, :integer
  field :space_id, :string       # added 20260409
  timestamps(type: :utc_datetime)
end
```

---

## Proposals & Seeds

### `proposals`

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
  field :tags,                 {:array, :string}
  field :generation_log,       :map
  field :embedding,            :binary              # vector embedding (20260401)
  field :intent_aligned,       :boolean, default: false
  field :duplicate_of,         :string
  field :source_fingerprint,   :string              # added 20260410
  field :space_id,             :string              # added 20260409
  # Genealogy fields (20260404):
  field :parent_proposal_id,   :string
  # Pipeline fields (20260405):
  field :pipeline_stage,       :string
  field :pipeline_metadata,    :map
  belongs_to :project, :seed, :parent_proposal
  has_many :tags_assoc, ProposalTag
  timestamps(type: :utc_datetime)
end
```

**Indexes:** `(status)`, `(project_id)`, `(seed_id)`, `(parent_proposal_id)`, `(inserted_at)`, `(space_id)`

### `proposal_seeds`

```elixir
schema "proposal_seeds" do
  field :id,                :string
  field :name,              :string
  field :prompt_template,   :string
  field :seed_type,         :string   # "cron" | "git" | "session" | "vault" | "usage" |
                                      # "brain_dump" | "cross" | "dependency"
  field :schedule,          :string   # cron expression or nil
  field :active,            :boolean, default: true
  field :last_run_at,       :utc_datetime
  field :run_count,         :integer, default: 0
  field :context_injection, :map
  field :metadata,          :map
  belongs_to :project, type: :string
  has_many :proposals
  timestamps(type: :utc_datetime)
end
```

### `proposal_tags`

```elixir
schema "proposal_tags" do
  field :id,   :string
  field :name, :string
  belongs_to :proposal, type: :string
  timestamps(type: :utc_datetime)
end
```

---

## Execution & Automation

### `executions`

```elixir
schema "executions" do
  field :id,            :string
  field :title,         :string
  field :objective,     :string
  field :status,        :string   # "pending" | "approved" | "running" | "completed" | "failed" | "cancelled"
  field :mode,          :string
  field :intent_slug,   :string
  field :project_slug,  :string
  field :git_diff,      :string   # added 20260406
  field :space_id,      :string   # added 20260409
  belongs_to :proposal, type: :string
  has_many :events, :agent_sessions
  timestamps(type: :utc_datetime)
end
```

### `execution_events`

```elixir
schema "execution_events" do
  field :id,         :string
  field :event_type, :string
  field :payload,    :map
  belongs_to :execution, type: :string
  timestamps(type: :utc_datetime)
end
```

### `agent_sessions`

```elixir
schema "agent_sessions" do
  field :id,          :string
  field :status,      :string
  field :duration_ms, :integer
  field :output_path, :string
  belongs_to :execution, :agent, type: :string
  timestamps(type: :utc_datetime)
end
```

### `pipes`

```elixir
schema "pipes" do
  field :id,              :string
  field :name,            :string
  field :trigger_pattern, :string   # "context:event" format
  field :active,          :boolean, default: true
  field :description,     :string
  has_many :actions, PipeAction
  has_many :transforms, PipeTransform
  has_many :runs, PipeRun
  timestamps(type: :utc_datetime)
end
```

### `pipe_actions`, `pipe_transforms`, `pipe_runs`

Supporting schemas for the pipes system (actions to execute, transforms to apply, execution history).

### `campaigns`

```elixir
schema "campaigns" do
  field :name,        :string
  field :description, :string
  field :steps,       :map
  field :status,      :string
  field :metadata,    :map
  has_many :runs, CampaignRun
  timestamps(type: :utc_datetime)
end
```

### `campaign_runs`

```elixir
schema "campaign_runs" do
  field :status,       :string
  field :current_step, :integer
  field :results,      :map
  field :started_at,   :utc_datetime
  field :completed_at, :utc_datetime
  belongs_to :campaign
  timestamps(type: :utc_datetime)
end
```

### `campaign_flows`

```elixir
schema "campaign_flows" do
  field :name,        :string
  field :flow_type,   :string
  field :config,      :map
  field :status,      :string
  timestamps(type: :utc_datetime)
end
```

---

## Agents

### `agents`

```elixir
schema "agents" do
  field :id,          :string
  field :slug,        :string
  field :name,        :string
  field :model,       :string
  field :temperature, :float
  field :system_prompt,:string
  field :tools,       {:array, :string}
  field :settings,    :map
  field :status,      :string
  has_many :channels, :conversations, :runs
  timestamps(type: :utc_datetime)
end
```

### `agent_channels`

```elixir
schema "agent_channels" do
  field :id,     :string
  field :type,   :string   # "webchat" | "discord" | "telegram" | "api"
  field :config, :map
  field :connection_status, :string   # added 20260410
  belongs_to :agent, type: :string
  timestamps(type: :utc_datetime)
end
```

### `agent_conversations`

```elixir
schema "agent_conversations" do
  field :id,     :string
  field :status, :string
  belongs_to :agent, type: :string
  has_many :messages
  timestamps(type: :utc_datetime)
end
```

### `agent_messages`

```elixir
schema "agent_messages" do
  field :id,      :string
  field :role,    :string
  field :content, :string
  field :metadata,:map
  belongs_to :conversation, type: :string
  timestamps(type: :utc_datetime)
end
```

### `agent_runs`

```elixir
schema "agent_runs" do
  field :id,          :string
  field :status,      :string
  field :duration_ms, :integer
  field :output,      :string
  belongs_to :agent, :task, type: :string
  timestamps(type: :utc_datetime)
end
```

### `agent_trust_scores`

```elixir
schema "agent_trust_scores" do
  field :id,         :string
  field :agent_id,   :string
  field :score,      :float
  field :dimensions, :map
  field :period,     :string
  timestamps(type: :utc_datetime)
end
```

---

## AI Sessions

### `ai_sessions`

EMA-managed AI conversation sessions.

```elixir
schema "ai_sessions" do
  field :id,             :string
  field :status,         :string     # "active" | "completed" | "error" | "forked"
  field :model,          :string
  field :provider_id,    :string
  field :input_tokens,   :integer, default: 0
  field :output_tokens,  :integer, default: 0
  field :cost_usd,       :float,   default: 0.0
  field :parent_id,      :string
  field :fork_message_id,:string
  field :project_path,   :string
  field :context_summary,:string
  field :metadata,       :map
  belongs_to :agent, type: :string
  has_many :messages, AiSessionMessage
  timestamps(type: :utc_datetime)
end
```

### `ai_session_messages`

```elixir
schema "ai_session_messages" do
  field :id,       :string
  field :role,     :string   # "user" | "assistant" | "tool" | "system"
  field :content,  :string
  field :metadata, :map
  belongs_to :session, AiSession, type: :string
  timestamps(type: :utc_datetime)
end
```

### `claude_sessions`

Read-only import of host Claude Code sessions from `~/.claude/projects/**/*.jsonl`.

```elixir
schema "claude_sessions" do
  field :id,            :string
  field :session_id,    :string
  field :status,        :string
  field :project_path,  :string
  field :token_count,   :integer
  field :files_touched, {:array, :string}
  field :tool_calls,    :map
  field :started_at,    :utc_datetime
  field :ended_at,      :utc_datetime
  belongs_to :project, type: :string
  timestamps(type: :utc_datetime)
end
```

### `cli_tools`

```elixir
schema "cli_tools" do
  field :name,        :string
  field :description, :string
  field :command,     :string
  field :config,      :map
  timestamps(type: :utc_datetime)
end
```

### `cli_sessions`

```elixir
schema "cli_sessions" do
  field :status,    :string
  field :output,    :string
  field :metadata,  :map
  belongs_to :tool, CliTool
  timestamps(type: :utc_datetime)
end
```

### `session_store`

DCC primitive persistence.

```elixir
schema "session_store" do
  field :dcc_data,     :string
  field :crystallized, :boolean, default: false
  timestamps(type: :utc_datetime)
end
```

---

## Intelligence

### `token_events`

```elixir
schema "token_events" do
  field :id,            :string
  field :model,         :string
  field :input_tokens,  :integer
  field :output_tokens, :integer
  field :cost_usd,      :float
  field :context,       :string   # "proposal" | "agent" | "pipe" | ...
  belongs_to :project, type: :string
  timestamps(type: :utc_datetime)
end
```

### `token_budgets`

```elixir
schema "token_budgets" do
  field :id,     :string
  field :scope,  :string
  field :limit,  :integer
  field :period, :string
  timestamps(type: :utc_datetime)
end
```

### `intent_nodes`

5-level intent hierarchy: `0=product, 1=flow, 2=action, 3=system, 4=implementation`.

```elixir
schema "intent_nodes" do
  field :id,              :string
  field :title,           :string
  field :description,     :string
  field :level,           :integer       # 0-4
  field :status,          :string        # "planned" | "partial" | "complete"
  field :linked_task_ids, :string        # JSON array
  field :linked_wiki_path,:string
  belongs_to :parent, IntentNode, type: :string
  belongs_to :project, Project, type: :string
  timestamps(type: :utc_datetime)
end
```

### `intent_edges`

```elixir
schema "intent_edges" do
  field :id,           :string
  field :relationship, :string   # "depends-on" | "implements" | "enables" | "blocks"
  belongs_to :source, :target, IntentNode, type: :string
  timestamps(type: :utc_datetime)
end
```

### `intent_clusters`

```elixir
schema "intent_clusters" do
  field :label,              :string
  field :description,        :string
  field :readiness_score,    :float, default: 0.0
  field :item_count,         :integer, default: 0
  field :promoted,           :boolean, default: false
  field :seed_id,            :string
  field :status,             :string, default: "forming"
  field :source_fingerprint, :string
  field :proposal_id,        :string
  field :centroid_embedding, :binary
  field :last_evaluated_at,  :utc_datetime
  timestamps(type: :utc_datetime)
end
```

### `gaps`

```elixir
schema "gaps" do
  field :id,          :string
  field :description, :string
  field :gap_type,    :string     # "stale_task" | "orphan_note" | "incomplete_goal" |
                                  # "missing_doc" | "todo_code" | "unlinked_proposal" |
                                  # "idle_responsibility"
  field :severity,    :integer    # 1-5
  field :status,      :string     # "open" | "resolved" | "ignored"
  field :source,      :string
  belongs_to :project, type: :string
  timestamps(type: :utc_datetime)
end
```

### `memory_fragments`

```elixir
schema "memory_fragments" do
  field :id,        :string
  field :content,   :string
  field :source,    :string
  field :relevance, :float
  field :metadata,  :map
  belongs_to :project, type: :string
  timestamps(type: :utc_datetime)
end
```

### `memory_session_entries`

```elixir
schema "memory_session_entries" do
  field :session_id,    :string
  field :user_id,       :string, default: "trajan"
  field :project_slug,  :string
  field :kind,          :string, default: "context"
  field :content,       :string
  field :weight,        :float, default: 0.5
  field :metadata,      :map, default: %{}
  timestamps(type: :utc_datetime)
end
```

### `memory_user_facts`

```elixir
schema "memory_user_facts" do
  field :user_id,       :string, default: "trajan"
  field :key,           :string
  field :value,         :string
  field :category,      :string, default: "general"
  field :weight,        :float, default: 0.5
  field :source,        :string, default: "manual"
  field :project_slug,  :string
  field :metadata,      :map, default: %{}
  timestamps(type: :utc_datetime)
end
```

### `memory_cross_pollinations`

```elixir
schema "memory_cross_pollinations" do
  field :source_project_slug, :string
  field :target_project_slug, :string
  field :fact_id,             :string
  field :rationale,           :string
  field :applied_at,          :utc_datetime
  timestamps(type: :utc_datetime)
end
```

### `reflexion_entries`

```elixir
schema "reflexion_entries" do
  field :agent, :string
  # additional fields for reflexion content
  timestamps(type: :utc_datetime)
end
```

### `context_fragments`

```elixir
schema "context_fragments" do
  field :project_slug,   :string
  field :fragment_type,  :string
  field :content,        :string
  field :file_path,      :string
  field :relevance_score,:float, default: 0.0
  timestamps(type: :utc_datetime)
end
```

### `git_events`

```elixir
schema "git_events" do
  field :id,          :string
  field :event_type,  :string
  field :repo_path,   :string
  field :payload,     :map
  field :metadata,    :map
  belongs_to :project, type: :string
  timestamps(type: :utc_datetime)
end
```

### `wiki_sync_actions`

```elixir
schema "wiki_sync_actions" do
  field :id,         :string
  field :action_type,:string
  field :file_path,  :string
  field :status,     :string
  field :metadata,   :map
  timestamps(type: :utc_datetime)
end
```

### `vm_health_events`

```elixir
schema "vm_health_events" do
  field :id,         :string
  field :event_type, :string
  field :host,       :string
  field :metrics,    :map
  field :status,     :string
  timestamps(type: :utc_datetime)
end
```

### `usage_records`

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

### `audit_logs`

```elixir
schema "audit_logs" do
  field :id,         :string
  field :action,     :string
  field :actor,      :string
  field :resource,   :string
  field :metadata,   :map
  timestamps(type: :utc_datetime)
end
```

### `harvester_runs`

```elixir
schema "harvester_runs" do
  field :id,           :string
  field :harvester,    :string
  field :status,       :string
  field :items_found,  :integer
  field :duration_ms,  :integer
  field :metadata,     :map
  timestamps(type: :utc_datetime)
end
```

---

## Knowledge & Vault

### `vault_notes`

```elixir
schema "vault_notes" do
  field :id,          :string
  field :file_path,   :string
  field :title,       :string
  field :content,     :string
  field :space,       :string
  field :tags,        {:array, :string}
  field :source_type, :string
  field :metadata,    :map
  timestamps(type: :utc_datetime)
end
```

FTS index added in migration `20260410000001_add_second_brain_fts.exs`.

### `vault_links`

```elixir
schema "vault_links" do
  field :id,        :string
  field :link_type, :string   # "wikilink" | "embed" | "reference" | typed edges (20260403)
  belongs_to :source_note, :target_note, Note, type: :string
  timestamps(type: :utc_datetime)
end
```

### `notes` (simple)

Separate from SecondBrain vault notes.

```elixir
schema "notes" do
  field :id,      :string
  field :title,   :string
  field :body,    :string
  field :space_id,:string    # added 20260409
  timestamps(type: :utc_datetime)
end
```

### `external_vault_sync_entries`

```elixir
schema "external_vault_sync_entries" do
  field :integration,      :string
  field :intent_node_id,   :string
  field :source_host,      :string
  field :source_root,      :string
  field :relative_path,    :string
  field :source_checksum,  :string
  field :source_mtime,     :utc_datetime
  field :last_seen_at,     :utc_datetime
  field :last_synced_at,   :utc_datetime
  field :status,           :string, default: "pending"
  field :last_error,       :string
  field :vault_note_id,    :string
  field :missing_count,    :integer, default: 0
  timestamps(type: :utc_datetime)
end
```

---

## Business

### `contacts`

```elixir
schema "contacts" do
  field :name,    :string
  field :email,   :string
  field :phone,   :string
  field :company, :string
  field :role,    :string
  field :notes,   :string
  field :tags,    :map, default: %{}
  field :status,  :string, default: "active"
  timestamps(type: :utc_datetime)
end
```

### `finance_transactions`

```elixir
schema "finance_transactions" do
  field :description, :string
  field :amount,      :decimal
  field :type,        :string
  field :category,    :string
  field :date,        :date
  field :project_id,  :string
  field :recurring,   :boolean, default: false
  field :notes,       :string
  timestamps(type: :utc_datetime)
end
```

### `invoices`

```elixir
schema "invoices" do
  field :contact_id, :string
  field :project_id, :string
  field :items,      :map, default: %{}
  field :subtotal,   :decimal
  field :tax,        :decimal
  field :total,      :decimal
  field :status,     :string, default: "draft"
  field :due_date,   :date
  field :paid_at,    :utc_datetime
  field :notes,      :string
  timestamps(type: :utc_datetime)
end
```

### `meetings`

```elixir
schema "meetings" do
  field :title,       :string
  field :description, :string
  field :starts_at,   :utc_datetime
  field :ends_at,     :utc_datetime
  field :attendees,   :map, default: %{}
  field :location,    :string
  field :project_id,  :string
  field :notes,       :string
  field :status,      :string, default: "scheduled"
  timestamps(type: :utc_datetime)
end
```

---

## System

### `organizations`

```elixir
schema "organizations" do
  field :name,        :string
  field :slug,        :string
  field :description, :string
  field :avatar_url,  :string
  field :owner_id,    :string
  field :settings,    :map, default: %{}
  has_many :members, :invitations
  timestamps(type: :utc_datetime)
end
```

### `org_members`

```elixir
schema "org_members" do
  field :user_id, :string
  field :role,    :string
  belongs_to :organization
  timestamps(type: :utc_datetime)
end
```

### `org_invitations`

```elixir
schema "org_invitations" do
  field :email, :string
  field :token, :string
  field :role,  :string
  field :status,:string
  belongs_to :organization
  timestamps(type: :utc_datetime)
end
```

### `spaces`

```elixir
schema "spaces" do
  field :name,        :string
  field :space_type,  :string, default: "personal"
  field :ai_privacy,  :string, default: "isolated"
  field :icon,        :string
  field :color,       :string
  field :settings,    :map, default: %{}
  field :archived_at, :utc_datetime
  has_many :members
  timestamps(type: :utc_datetime)
end
```

### `space_members`

```elixir
schema "space_members" do
  field :user_id, :string
  field :role,    :string
  belongs_to :space
  timestamps(type: :utc_datetime)
end
```

### `settings`

```elixir
schema "settings" do
  field :id,    :string
  field :key,   :string
  field :value, :string
  timestamps(type: :utc_datetime)
end
```

### `workspace_windows`

```elixir
schema "workspace_windows" do
  field :id,     :string
  field :app_id, :string
  field :x, :y, :width, :height — :integer
  field :visible, :boolean
  timestamps(type: :utc_datetime)
end
```

### `app_shortcuts`

```elixir
schema "app_shortcuts" do
  field :id,      :string
  field :app_id,  :string
  field :key,     :string
  field :action,  :string
  timestamps(type: :utc_datetime)
end
```

### `behavior_rules` (Evolution)

```elixir
schema "behavior_rules" do
  field :source,          :string
  field :content,         :string
  field :status,          :string, default: "proposed"
  field :version,         :integer, default: 1
  field :diff,            :string
  field :signal_metadata, :map, default: %{}
  timestamps(type: :utc_datetime)
end
```

### `temporal_rhythms`

```elixir
schema "temporal_rhythms" do
  field :day_of_week,          :integer
  field :hour,                 :integer
  field :energy_level,         :float, default: 5.0
  field :focus_quality,        :float, default: 5.0
  field :preferred_task_types, {:array, :string}, default: []
  field :sample_count,         :integer, default: 0
  timestamps(type: :utc_datetime)
end
```

### `temporal_energy_logs`

```elixir
schema "temporal_energy_logs" do
  field :energy_level,  :float
  field :focus_quality, :float
  field :activity_type, :string
  field :source,        :string, default: "manual"
  field :logged_at,     :utc_datetime
  timestamps(type: :utc_datetime)
end
```

### `routines`

```elixir
schema "routines" do
  field :name,        :string
  field :description, :string
  field :steps,       :map, default: %{}
  field :cadence,     :string, default: "daily"
  field :active,      :boolean, default: true
  field :last_run_at, :utc_datetime
  timestamps(type: :utc_datetime)
end
```

### `clipboard_clips`

```elixir
schema "clipboard_clips" do
  field :content,      :string
  field :content_type, :string, default: "text"
  field :source,       :string, default: "manual"
  field :pinned,       :boolean, default: false
  field :expires_at,   :utc_datetime
  timestamps(type: :utc_datetime)
end
```

### `managed_files` (File Vault)

```elixir
schema "managed_files" do
  field :filename,    :string
  field :path,        :string
  field :size_bytes,  :integer
  field :mime_type,   :string
  field :tags,        :map, default: %{}
  field :project_id,  :string
  field :uploaded_at, :utc_datetime
  timestamps(type: :utc_datetime)
end
```

### `decisions`

```elixir
schema "decisions" do
  field :title,         :string
  field :context,       :string
  field :options,       {:array, :map}, default: []
  field :chosen_option, :string
  field :decided_by,    :string
  field :reasoning,     :string
  field :outcome,       :string
  field :outcome_score, :integer
  field :tags,          {:array, :string}, default: []
  field :space_id,      :string
  field :reviewed_at,   :utc_datetime
  timestamps(type: :utc_datetime)
end
```

### `metamind_prompts`

```elixir
schema "metamind_prompts" do
  field :name,               :string
  field :body,               :string
  field :category,           :string
  field :tags,               {:array, :string}, default: []
  field :version,            :integer, default: 1
  field :effectiveness_score,:float, default: 0.0
  field :usage_count,        :integer, default: 0
  field :success_count,      :integer, default: 0
  field :metadata,           :map, default: %{}
  field :parent_id,          :string
  field :template_vars,      {:array, :string}, default: []
  timestamps(type: :utc_datetime)
end
```

### `prompt_templates`

```elixir
schema "prompt_templates" do
  field :name,     :string
  field :body,     :string
  field :category, :string
  field :metadata, :map
  timestamps(type: :utc_datetime)
end
```

### `prompts`

```elixir
schema "prompts" do
  field :name,     :string
  field :body,     :string
  field :category, :string
  field :version,  :integer
  field :metadata, :map
  # Optimizer fields (20260408):
  field :variant_count, :integer
  field :best_score,    :float
  timestamps(type: :utc_datetime)
end
```

### `ingest_jobs`

```elixir
schema "ingest_jobs" do
  field :source_type,       :string
  field :source_uri,        :string
  field :status,            :string, default: "pending"
  field :extracted_title,   :string
  field :extracted_summary, :string
  field :extracted_tags,    {:array, :string}, default: []
  field :vault_path,        :string
  timestamps(type: :utc_datetime)
end
```

### `responsibilities`

```elixir
schema "responsibilities" do
  field :id,           :string
  field :name,         :string
  field :role,         :string
  field :cadence,      :string   # "daily" | "weekly" | "monthly"
  field :health_score, :float
  field :description,  :string
  field :space_id,     :string   # added 20260409
  has_many :check_ins
  timestamps(type: :utc_datetime)
end
```

### `check_ins`

```elixir
schema "check_ins" do
  field :id,     :string
  field :status, :string
  field :notes,  :string
  belongs_to :responsibility, type: :string
  timestamps(type: :utc_datetime)
end
```

### `focus_sessions`

```elixir
schema "focus_sessions" do
  field :id,          :string
  field :status,      :string
  field :duration_ms, :integer
  field :task_id,     :string     # added 20260403
  field :summary,     :string     # added 20260403
  has_many :blocks
  timestamps(type: :utc_datetime)
end
```

### `focus_blocks`

```elixir
schema "focus_blocks" do
  field :id,        :string
  field :block_type,:string
  field :duration,  :integer
  belongs_to :session, type: :string
  timestamps(type: :utc_datetime)
end
```

---

## Migration Index

86 migrations in chronological order:

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `20260329191319_create_inbox_items` | Brain dump inbox |
| 2 | `20260329191541_create_habits` | Habits + habit logs |
| 3 | `20260329191649_create_journal_entries` | Journal |
| 4 | `20260329191746_create_settings` | Settings key-value |
| 5 | `20260329200001_create_goals` | Goals |
| 6 | `20260329200002_create_tasks` | Tasks (initial) |
| 7 | `20260329200003_create_focus` | Focus sessions + blocks |
| 8 | `20260329200004_create_notes` | Simple notes |
| 9 | `20260329200005_create_vault_index` | Vault file index |
| 10 | `20260329200006_create_claude_sessions` | Claude sessions (initial) |
| 11 | `20260329200007_create_agents` | Agents (initial) |
| 12 | `20260329200008_create_app_shortcuts` | App keyboard shortcuts |
| 13 | `20260329205334_create_workspace_windows` | Window state persistence |
| 14 | `20260330100001_create_projects` | Projects |
| 15 | `20260330100002_recreate_tasks` | Tasks (recreated with projects FK) |
| 16 | `20260330100003_create_task_dependencies` | Task blocking relationships |
| 17 | `20260330100004_create_task_comments` | Task comments |
| 18 | `20260330100005_create_proposal_seeds` | Proposal seeds |
| 19 | `20260330100006_create_proposals` | Proposals |
| 20 | `20260330100007_create_proposal_tags` | Proposal tag join table |
| 21 | `20260330100008_create_responsibilities` | Responsibilities |
| 22 | `20260330100009_create_responsibility_check_ins` | Responsibility check-ins |
| 23 | `20260330100010_create_vault_notes_and_links` | Second Brain vault notes + links |
| 24 | `20260330100011_create_pipes` | Pipes + actions + transforms + runs |
| 25 | `20260330100012_recreate_agents` | Agents (recreated with full schema) |
| 26 | `20260330100013_recreate_claude_sessions` | Claude sessions (recreated) |
| 27 | `20260330100014_add_project_id_to_existing_tables` | Add project_id FKs |
| 28 | `20260330100015_drop_old_tables` | Clean up old tables |
| 29 | `20260330100016_create_canvases` | Canvases + elements + data sources |
| 30 | `20260330100017_change_responsibility_health_to_float` | Fix health_score type |
| 31 | `20260401040000_create_claude_usage_records` | Claude usage records |
| 32 | `20260401040001_create_claude_audit_logs` | Claude audit logs |
| 33 | `20260401050000_create_providers_and_accounts` | AI providers + accounts |
| 34 | `20260401050001_create_routing_decisions` | Routing decisions |
| 35 | `20260401100001_add_vector_scores_to_proposals` | Vector embedding + scores on proposals |
| 36 | `20260401100002_create_metamind_prompts` | MetaMind prompt library |
| 37 | `20260401100003_create_behavior_rules` | Evolution behavior rules |
| 38 | `20260403000001_add_github_fields_to_projects` | GitHub URL on projects |
| 39 | `20260403100001_create_ai_sessions` | AI sessions + messages |
| 40 | `20260403100002_create_harvester_runs` | Harvester run tracking |
| 41 | `20260403120000_create_prompt_templates` | Prompt templates |
| 42 | `20260403120001_create_ingest_jobs` | Ingest jobs |
| 43 | `20260403120002_create_decisions` | Decision log |
| 44 | `20260403200001_add_focus_task_and_summary` | Focus task_id + summary |
| 45 | `20260403300001_add_typed_edges_to_vault_links` | Typed edges on vault links |
| 46 | `20260403400001_create_git_events_and_sync_actions` | Git events + wiki sync actions |
| 47 | `20260403500001_create_canvas_templates` | Canvas templates |
| 48 | `20260403500002_create_cli_tools_and_sessions` | CLI tools + sessions |
| 49 | `20260403600001_create_organizations` | Organizations |
| 50 | `20260403600002_create_org_members` | Organization members |
| 51 | `20260403600003_create_org_invitations` | Organization invitations |
| 52 | `20260403700001_create_temporal_rhythms` | Temporal rhythms |
| 53 | `20260403800001_create_token_events` | Token events |
| 54 | `20260403800002_create_agent_trust_scores` | Agent trust scores |
| 55 | `20260403800003_create_vm_health_events` | VM health events |
| 56 | `20260403900001_create_memory_fragments` | Memory fragments |
| 57 | `20260403900002_create_gaps` | System gaps |
| 58 | `20260403900003_create_intent_nodes` | Intent nodes + edges |
| 59 | `20260403900010_create_executions` | Executions |
| 60 | `20260403900011_create_execution_events` | Execution events |
| 61 | `20260403900012_create_agent_sessions` | Agent sessions (execution) |
| 62 | `20260403910001_create_usage_records` | Usage records (bridge) |
| 63 | `20260403910002_create_audit_logs` | Audit logs (bridge) |
| 64 | `20260403950001_create_campaign_flows` | Campaign flows |
| 65 | `20260403950002_create_prompts` | Prompts |
| 66 | `20260404000001_create_session_store` | DCC session store |
| 67 | `20260404000002_add_proposal_genealogy` | Proposal parent_proposal_id |
| 68 | `20260405000001_add_proposal_pipeline_fields` | Proposal pipeline stage + metadata |
| 69 | `20260406000001_add_git_diff_to_executions` | Git diff field on executions |
| 70 | `20260407000001_add_agent_intent_to_tasks` | Agent intent on tasks |
| 71 | `20260407000002_create_memory_tables` | Memory session entries + user facts + cross pollinations |
| 72 | `20260407990001_create_campaign_templates` | Campaign templates (campaigns + runs) |
| 73 | `20260408000000_create_reflexion_entries` | Reflexion entries |
| 74 | `20260408000001_add_optimizer_fields_to_prompts` | Prompt optimizer fields |
| 75 | `20260408000002_create_context_fragments` | Context fragments |
| 76 | `20260409000001_migrate_campaign_statuses` | Campaign status migration |
| 77 | `20260409000010_create_spaces` | Spaces + space members |
| 78 | `20260409000011_add_space_id_to_core_tables` | Add space_id to tasks, goals, habits, journals, notes, proposals, responsibilities |
| 79 | `20260409000020_enhance_inbox_items_for_intent` | Intent-enhanced inbox items (intent_type, priority_hint, entity_refs) |
| 80 | `20260409000021_create_intent_clusters` | Intent clusters |
| 81 | `20260410000001_add_second_brain_fts` | FTS5 index on vault_notes |
| 82 | `20260410000002_create_claude_failure_events` | Claude failure events |
| 83 | `20260410010000_add_source_fingerprint_to_proposals` | Source fingerprint on proposals |
| 84 | `20260410020000_add_connection_status_to_channels` | Connection status on agent channels |
| 85 | `20260411000001_add_embedding_fields_to_inbox_and_clusters` | Embedding fields on inbox items + clusters |
| 86 | `20260411000002_create_external_vault_sync_entries` | External vault sync entries |

---

## Key Constraints & Invariants

| Constraint | Where enforced |
|-----------|----------------|
| Proposal status only moves forward (never backward) | `Proposal.changeset/2` validates inclusion in status list |
| `level` in intent_nodes is 0-4 | `validate_number` in `IntentNode.changeset/2` |
| `confidence` is 0.0-1.0 | `validate_number` in `Proposal.changeset/2` |
| `idea_score` and `prompt_quality_score` are 1-10 | `validate_number` in `Proposal.changeset/2` |
| Sessions are append-only (messages never deleted) | No delete route in `AiSessionMessage` |
| Proposals can only be killed once (KillMemory check) | `KillMemory.check_similar/1` before Generator runs |
| SmartRouter never routes to a tripped circuit | `CircuitBreaker.check(provider_id)` in `SmartRouter.route/2` |
| Project slugs are unique | Unique index on `projects.slug` |
| Space isolation | `space_id` FK on 7 core tables for context separation |
