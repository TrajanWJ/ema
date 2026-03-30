# EMA Engine — Autonomous Ideation & Project System

**Date:** 2026-03-30
**Status:** Review
**Stack:** Elixir/OTP (core), Phoenix Channels (realtime), Claude CLI (thinking), Tauri + React (UI)

---

## 1. Philosophy

EMA is a personal operating system with an autonomous thinking layer. The Elixir daemon isn't just a backend serving a React app — it's the brain. It runs continuous background processes that observe your work, generate ideas, refine them through debate, and present mature proposals for your review. When you approve work, it tracks execution through a proper project and task system. When you redirect, it forks and explores. When you kill, it learns what you don't want.

Elixir/OTP is the right foundation because this system is fundamentally about:
- Long-running supervised processes that never crash permanently
- Message passing between independent actors (seeds, generators, refiners, taggers)
- Pipeline stages with backpressure
- Process-per-entity isolation (each project, each proposal pipeline, each cron seed)
- Hot observation of everything (telemetry, PubSub, process inspection)

---

## 2. Projects

### 2.1 What a Project Is

A project is a **workspace with memory**. Not a folder. Not a task list. A living context that accumulates understanding over time.

Every project has:
- **Identity:** name, slug, description, status, icon, color
- **Context document:** a living markdown summary of what this project is, current state, decisions made, open questions — auto-maintained by the engine, editable by user
- **Linked directory:** optional path to a git repo or folder on disk
- **Seeds:** proposal seed prompts scoped to this project
- **Session history:** Claude Code sessions auto-linked by project path matching
- **Relationships:** parent/child projects, related projects, spawned-from proposal

### 2.2 Project Lifecycle

```
incubating → active → paused → completed → archived
     ↑                    |
     └── reactivated ─────┘
```

- **Incubating:** idea stage. May have been auto-created from a green-lit proposal. Has context doc and seeds but no active tasks yet.
- **Active:** work happening. Tasks in progress, proposals generating, sessions linking.
- **Paused:** on hold. Cron seeds for this project are suspended. Context preserved.
- **Completed:** done. Final context snapshot. Seeds stopped. Tasks resolved.
- **Archived:** out of sight. Searchable but not shown in default views.

### 2.3 Project Context Document

`~/.local/share/ema/projects/<slug>/context.md`

Auto-generated and auto-updated by the daemon. Constructed from:
- Project description and goals
- Active task summaries
- Recent proposal summaries (approved and pending)
- Recent Claude session summaries (imported from session logs)
- Linked responsibility summaries
- Decision log entries

This document is injected into every Claude CLI call scoped to this project — seed prompt generation, proposal refinement, task elaboration. It's how the system maintains coherent understanding across runs.

The daemon regenerates it via a `ContextBuilder` GenServer that listens to PubSub events (task changes, proposal state changes, session imports) and debounces rebuilds.

### 2.4 Elixir Schema

```elixir
defmodule Ema.Projects.Project do
  schema "projects" do
    field :slug, :string
    field :name, :string
    field :description, :string
    field :status, :string, default: "incubating"
    field :icon, :string
    field :color, :string
    field :linked_path, :string          # optional git repo / directory
    field :context_hash, :string         # hash of last built context.md
    field :settings, :map, default: %{}  # project-specific config

    belongs_to :parent, __MODULE__
    belongs_to :source_proposal, Ema.Proposals.Proposal

    has_many :children, __MODULE__, foreign_key: :parent_id
    has_many :tasks, Ema.Tasks.Task
    has_many :proposals, Ema.Proposals.Proposal
    has_many :seeds, Ema.Proposals.Seed
    has_many :responsibilities, Ema.Responsibilities.Responsibility
    has_many :sessions, Ema.ClaudeSessions.ClaudeSession

    timestamps(type: :utc_datetime)
  end
end
```

### 2.5 OTP Architecture

```
ProjectSupervisor (DynamicSupervisor)
  └── per project:
      ProjectWorker (GenServer)
        ├── manages lifecycle state
        ├── owns context document regeneration
        ├── subscribes to PubSub for relevant events
        └── coordinates with ProposalPipeline for project-scoped seeds
```

Each active project gets its own supervised process. The process:
- Listens for task/proposal/session events via `Phoenix.PubSub`
- Debounces context document rebuilds (5s after last event)
- Manages seed scheduling for project-scoped seeds
- Publishes project-level events (status changes, context rebuilds)

---

## 3. Tasks

### 3.1 What a Task Is

A task is an **actionable work item** with a clear definition of done. Tasks are the atoms of execution — everything the system produces eventually becomes tasks or feeds into tasks.

### 3.2 Task Properties

- **Identity:** title, description (markdown), status, priority (1-5, 1=critical)
- **Ownership:** assigned to a project (required), optionally linked to a goal, optionally linked to a responsibility
- **Source tracking:** where did this task come from?
  - `proposal:<id>` — green-lit proposal
  - `responsibility:<id>` — generated from recurring responsibility
  - `brain_dump:<id>` — promoted from brain dump
  - `manual` — user created
  - `session:<id>` — extracted from Claude session
  - `decomposition:<parent_task_id>` — broken down from parent
- **Relationships:** blocks/blocked_by (dependency graph), parent/subtasks (decomposition), related tasks
- **Scheduling:** due date, estimated effort (t-shirt: xs/s/m/l/xl), recurrence rule (for responsibility-generated tasks)
- **Execution:** linked agent runs, linked Claude sessions, notes/comments log

### 3.3 Task Lifecycle

```
proposed → todo → in_progress → in_review → done
                       |                      |
                       → blocked              → archived
                       |
                       → cancelled
```

- **Proposed:** auto-created from green-lit proposal. Needs user to confirm scope and assign to project.
- **Todo:** accepted, ready to work.
- **In Progress:** actively being worked on. May have linked Claude sessions.
- **Blocked:** waiting on another task or external dependency.
- **In Review:** work done, awaiting verification.
- **Done/Archived/Cancelled:** terminal states.

### 3.4 Task Board

Each project has a kanban-style task board. Columns map to statuses. Drag between columns. Filter by priority, source, assignee (user vs agent). Dependency arrows shown on hover.

Global task view across all projects: filterable, sortable, grouped by project.

### 3.5 Task Decomposition

Any task can be decomposed into subtasks. The system can auto-suggest decomposition by running the task description + project context through Claude CLI. Subtasks inherit the parent's project. Parent task auto-completes when all subtasks complete.

### 3.6 Elixir Schema

```elixir
defmodule Ema.Tasks.Task do
  schema "tasks" do
    field :title, :string
    field :description, :string
    field :status, :string, default: "proposed"
    field :priority, :integer, default: 3
    field :source_type, :string          # proposal | responsibility | brain_dump | manual | session | decomposition
    field :source_id, :string
    field :effort, :string               # xs | s | m | l | xl
    field :due_date, :date
    field :recurrence, :string           # RRULE string or nil
    field :sort_order, :integer
    field :completed_at, :utc_datetime
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project
    belongs_to :goal, Ema.Goals.Goal
    belongs_to :responsibility, Ema.Responsibilities.Responsibility
    belongs_to :parent, __MODULE__

    has_many :subtasks, __MODULE__, foreign_key: :parent_id
    has_many :comments, Ema.Tasks.Comment
    has_many :agent_runs, Ema.Agents.Run

    many_to_many :blocked_by, __MODULE__,
      join_through: "task_dependencies",
      join_keys: [task_id: :id, dependency_id: :id]

    many_to_many :blocks, __MODULE__,
      join_through: "task_dependencies",
      join_keys: [dependency_id: :id, task_id: :id]

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.Tasks.Comment do
  schema "task_comments" do
    field :body, :string
    field :source, :string    # user | system | agent
    belongs_to :task, Ema.Tasks.Task
    timestamps(type: :utc_datetime)
  end
end
```

---

## 4. Proposal Engine

### 4.1 Overview

The proposal engine is EMA's autonomous thinking layer. It continuously generates, refines, debates, tags, and presents ideas for your review. It's not a prompt-and-response system — it's a pipeline of OTP processes that produce increasingly mature proposals.

### 4.2 Seeds

A seed is a prompt template + schedule + context scope. Seeds are the inputs to the engine.

**Seed types:**
- **Cron seeds:** user-defined prompt strings on a schedule. "Every 6 hours, brainstorm new dashboard widgets for ema." Scoped to a project or global.
- **Harvester seeds:** auto-generated from system observation:
  - `GitHarvester` — watches commits, detects patterns, generates seeds about automation/improvement
  - `SessionHarvester` — mines Claude session logs for recurring friction, failed approaches, unfinished ideas
  - `VaultHarvester` — scans Obsidian vault for orphan notes, stale TODOs, knowledge gaps
  - `UsageHarvester` — tracks which ema apps/features are used, proposes improvements to hot paths
  - `BrainDumpHarvester` — watches brain dump for patterns, clusters related captures into seed themes
- **Cross-pollination seeds:** auto-generated when the `Combiner` detects proposals with overlapping tags or related project scopes. Produces synthesis prompts.
- **Dependency seeds:** auto-generated when a proposal is green-lit. "Given that X was approved, what does this enable? What should come next?"

```elixir
defmodule Ema.Proposals.Seed do
  schema "proposal_seeds" do
    field :name, :string
    field :prompt_template, :string      # the actual prompt, with {{variable}} interpolation
    field :seed_type, :string            # cron | git | session | vault | usage | brain_dump | cross | dependency
    field :schedule, :string             # cron expression or nil for one-shot
    field :active, :boolean, default: true
    field :last_run_at, :utc_datetime
    field :run_count, :integer, default: 0
    field :context_injection, :map       # which context docs to inject into the prompt
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project  # nil = global
    has_many :proposals, Ema.Proposals.Proposal

    timestamps(type: :utc_datetime)
  end
end
```

### 4.3 The Pipeline

```
                    ┌──────────────────────────────────────────┐
                    │         Proposal Pipeline                │
                    │         (OTP Supervision Tree)           │
                    │                                          │
  Seeds ──────────► │  Scheduler ──► Generator ──► Refiner     │
                    │                                  │       │
  Harvesters ─────► │                                  ▼       │
                    │                              Debater     │
  Cross-poll ─────► │                                  │       │
                    │                                  ▼       │
                    │                              Tagger      │
                    │                                  │       │
                    │                                  ▼       │
                    │                              Queue  ◄────┼──── User reviews
                    │                                │         │
                    │                    ┌───────────┼─────┐   │
                    │                    ▼           ▼     ▼   │
                    │                 🟢 Green    🟡 Redirect  🔴 Kill
                    │                    │           │         │
                    │                    ▼           ▼         │
                    │              Create Task   Fork 3 new    │
                    │              in Project    seeds back     │
                    │                            into pipeline  │
                    └──────────────────────────────────────────┘
```

**Scheduler** (GenServer + Quantum-style cron):
- Maintains all active seeds and their schedules
- On tick: pushes seed into Generator
- Manages harvester GenServers that produce synthetic seeds
- Respects project status (paused projects = paused seeds)

**Generator** (GenServer, pool of workers):
- Receives a seed + context
- Builds the full prompt: seed template + project context.md + relevant recent proposals + relevant recent sessions
- Shells out to `claude --print -p "<prompt>"` via `System.cmd`
- Parses structured output (JSON with fields: title, summary, problem, approach, tradeoffs, estimated_scope)
- Produces a raw proposal

**Refiner** (GenServer):
- Takes the raw proposal and runs a second Claude pass
- Prompt: "You are a critical reviewer. Here is a proposal for {project}. Strengthen it: find weaknesses, sharpen the approach, remove hand-waving, make it concrete. Output the revised proposal."
- This is what gives proposals quality — they arrive pre-critiqued

**Debater** (GenServer):
- Runs a third pass simulating an internal debate
- Prompt: "Here's a proposal and its critique. Argue for it (steelman), argue against it (red team), then synthesize. Output: final_summary, confidence_score (0-1), key_risks[], key_benefits[]"
- Proposals arrive with a confidence score and honest risk assessment

**Tagger** (GenServer):
- Auto-assigns hierarchical tags based on content analysis
- Domain tags: matches against known project domains, app areas
- Type tags: `new-app`, `enhancement`, `integration`, `refactor`, `experiment`
- Cross-references existing proposals for overlap detection → may trigger cross-pollination seeds

**Queue:**
- The proposals table, ordered by creation time, filterable by tags/project/confidence
- Each proposal sits here until user acts

### 4.4 Proposal Schema

```elixir
defmodule Ema.Proposals.Proposal do
  schema "proposals" do
    field :title, :string
    field :summary, :string              # one-liner for queue view
    field :body, :string                 # full structured proposal (markdown)
    field :status, :string, default: "queued"  # queued | reviewing | approved | redirected | killed
    field :confidence, :float            # 0.0 - 1.0, from debater
    field :risks, {:array, :string}
    field :benefits, {:array, :string}
    field :estimated_scope, :string      # xs | s | m | l | xl
    field :generation_log, :map          # raw outputs from each pipeline stage

    # The internal debate record
    field :steelman, :string
    field :red_team, :string
    field :synthesis, :string

    belongs_to :project, Ema.Projects.Project
    belongs_to :seed, Ema.Proposals.Seed
    belongs_to :parent_proposal, __MODULE__   # if this was forked via redirect

    has_many :tags, Ema.Proposals.ProposalTag
    has_many :children, __MODULE__, foreign_key: :parent_proposal_id
    has_many :tasks, Ema.Tasks.Task, foreign_key: :source_id

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.Proposals.ProposalTag do
  schema "proposal_tags" do
    field :category, :string      # domain | type | custom
    field :label, :string         # e.g., "enhancement:brain-dump" or "integration:claude"
    belongs_to :proposal, Ema.Proposals.Proposal
    timestamps(type: :utc_datetime)
  end
end
```

### 4.5 The Three Actions

**Green (approve):**
1. Proposal status → `approved`
2. Auto-creates a Task with `source_type: "proposal"`, linked to the proposal's project
3. Task gets the proposal body as its description
4. If the proposal's scope is L or XL, system auto-suggests decomposition into subtasks
5. Triggers dependency seeds: "Given {proposal} was approved for {project}, what follow-up work does this enable?"

**Yellow (redirect):**
1. Proposal status → `redirected`
2. Opens a prompt input: user types a redirect note (e.g., "focus more on the CLI integration angle" or "what if this was a background service instead")
3. System creates 3 new seeds, each combining:
   - The original proposal content
   - The user's redirect note
   - A different exploration angle (the Generator prompt explicitly asks for a divergent take)
4. The 3 new seeds immediately enter the pipeline
5. Child proposals link back to parent via `parent_proposal_id` — you can see the evolution tree

**Red (kill):**
1. Proposal status → `killed`
2. The kill is recorded with the proposal's tags and content signature
3. Future proposals that are too similar (detected by Tagger via embedding similarity or keyword overlap) get auto-deprioritized or flagged as "similar to killed proposal X"
4. Over time, the system learns what directions you don't want

### 4.6 Cross-Pollination

The `Combiner` GenServer runs periodically (hourly) and:
1. Scans all `queued` proposals
2. Clusters by tag overlap and content similarity
3. For any cluster of 2+ proposals, generates a synthesis seed: "These proposals are related: {A}, {B}. Design something that combines their strengths into a unified approach."
4. Synthesis proposals link to their source proposals

### 4.7 OTP Supervision Tree

```
Ema.ProposalEngine.Supervisor (Supervisor, rest_for_one)
  ├── Ema.ProposalEngine.Scheduler (GenServer)
  │     └── manages Quantum-style cron for all active seeds
  ├── Ema.ProposalEngine.HarvesterSupervisor (DynamicSupervisor)
  │     ├── GitHarvester (GenServer, watches repos)
  │     ├── SessionHarvester (GenServer, watches ~/.claude/)
  │     ├── VaultHarvester (GenServer, watches vault)
  │     ├── UsageHarvester (GenServer, telemetry listener)
  │     └── BrainDumpHarvester (GenServer, PubSub listener)
  ├── Ema.ProposalEngine.Pipeline (Supervisor)
  │     ├── Generator (GenServer, pooled via :poolboy or Task.Supervisor)
  │     ├── Refiner (GenServer)
  │     ├── Debater (GenServer)
  │     └── Tagger (GenServer)
  ├── Ema.ProposalEngine.Combiner (GenServer, periodic)
  └── Ema.ProposalEngine.KillMemory (GenServer, tracks killed patterns)
```

---

## 5. Responsibilities

### 5.1 What a Responsibility Is

A responsibility is a **recurring obligation organized by role**. Unlike a task (which is done once), a responsibility represents something you're perpetually accountable for.

### 5.2 Structure

- **Role:** the hat you're wearing (e.g., "developer", "self", "maintainer", "learner")
- **Obligation:** what you're accountable for (e.g., "keep ema tests passing", "weekly review", "exercise 3x/week")
- **Cadence:** how often this needs attention (daily, weekly, biweekly, monthly, quarterly, ongoing)
- **Health:** auto-calculated from linked task completion rates and check-in responses
- **Project scope:** global or scoped to specific projects

### 5.3 Responsibility → Task Generation

Responsibilities auto-generate tasks on their cadence. "Weekly review" generates a task every Sunday. "Keep ema tests passing" generates a task whenever CI fails (detected by a harvester). The generated tasks link back to the responsibility via `source_type: "responsibility"`.

### 5.4 Elixir Schema

```elixir
defmodule Ema.Responsibilities.Responsibility do
  schema "responsibilities" do
    field :title, :string
    field :description, :string
    field :role, :string                 # developer | self | maintainer | learner | custom
    field :cadence, :string              # daily | weekly | biweekly | monthly | quarterly | ongoing
    field :health, :float, default: 1.0  # 0.0 - 1.0, auto-calculated
    field :active, :boolean, default: true
    field :last_checked_at, :utc_datetime
    field :recurrence_rule, :string      # RRULE for task generation
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project  # nil = global
    has_many :tasks, Ema.Tasks.Task
    has_many :check_ins, Ema.Responsibilities.CheckIn

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.Responsibilities.CheckIn do
  schema "responsibility_check_ins" do
    field :status, :string        # healthy | at_risk | failing
    field :note, :string
    belongs_to :responsibility, Ema.Responsibilities.Responsibility
    timestamps(type: :utc_datetime)
  end
end
```

### 5.5 OTP

```
Ema.Responsibilities.Supervisor (Supervisor)
  ├── ResponsibilityScheduler (GenServer)
  │     └── generates tasks from active responsibilities on cadence
  ├── HealthCalculator (GenServer)
  │     └── periodically recalculates health scores from task completion data
  └── ResponsibilityHarvester (GenServer)
        └── watches for signals that trigger "ongoing" responsibilities (CI failures, etc.)
```

---

## 6. Claude Session Integration

### 6.1 Session Import

A `SessionWatcher` GenServer watches `~/.claude/projects/` and `~/.claude/` for session data (the same JSONL files claude-devtools reads).

On detecting a new or updated session:
1. Parse the session log
2. Extract: project path, start time, duration, tool calls, files touched, token usage
3. Auto-link to an EMA project by matching `project_path` against `Project.linked_path`
4. Store a structured summary in `claude_sessions` table
5. If no matching project exists, surface it as an "unlinked session" for user to assign

### 6.2 Active Session Detection

A `SessionMonitor` GenServer polls for running `claude` processes (via `/proc` or `System.cmd("pgrep", ...)`) every 5 seconds.

When a Claude session is active:
- Broadcasts via PubSub for UI to show live indicator
- Identifies which project it's running in
- Updates the project's "last active" timestamp

### 6.3 Session → Proposal Feedback Loop

The `SessionHarvester` mines completed sessions for:
- Questions asked repeatedly → seed: "automate or document this"
- Files edited most frequently → seed: "this area needs refactoring attention"
- Failed tool calls / retries → seed: "developer friction point here"
- Long sessions on a topic → seed: "this is complex enough to need its own project"

### 6.4 Schema

```elixir
defmodule Ema.ClaudeSessions.ClaudeSession do
  schema "claude_sessions" do
    field :session_id, :string
    field :project_path, :string
    field :started_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :last_active, :utc_datetime
    field :status, :string, default: "active"  # active | completed | abandoned
    field :token_count, :integer
    field :tool_calls, :integer
    field :files_touched, {:array, :string}
    field :summary, :string               # auto-generated from session content
    field :raw_path, :string              # path to JSONL file
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project

    timestamps(type: :utc_datetime)
  end
end
```

### 6.5 OTP

```
Ema.ClaudeSessions.Supervisor (Supervisor)
  ├── SessionWatcher (GenServer, FileSystem watcher on ~/.claude/)
  ├── SessionMonitor (GenServer, polls for active claude processes)
  ├── SessionParser (GenServer, parses JSONL into structured data)
  └── SessionLinker (GenServer, matches sessions to projects)
```

---

## 7. Brain Dump — Project Integration

The existing brain dump gets two additions:

### 7.1 Project Selector

A dropdown/toggle on the capture input. Default: "Inbox" (no project). Can select any active project. When a brain dump item has a project, its "→ Task" action auto-assigns to that project.

### 7.2 Brain Dump → Proposal Path

New action on brain dump items: "→ Seed". Converts the brain dump text into a proposal seed scoped to the selected project (or global). The seed enters the pipeline immediately for one run, then deactivates (one-shot seed).

---

## 8. Interconnections Map

Everything connects to everything:

```
                        Responsibilities
                        (generate tasks on cadence)
                              │
                              ▼
Seeds ──► Proposals ──green──► Tasks ◄──── Brain Dump (→ Task)
  ▲          │                  │               │
  │          │ redirect         │               │ → Seed
  │          ▼                  ▼               ▼
  │       3 new seeds      Project ◄──── Proposal Seeds
  │                           │
  │                           ▼
  │                      Context Doc ──► injected into all Claude calls
  │                           │
  │                           │
  └── Harvesters ◄── Claude Sessions (auto-linked to projects)
        │
        ├── GitHarvester (commit patterns)
        ├── SessionHarvester (claude friction points)
        ├── VaultHarvester (orphan notes, stale TODOs)
        ├── UsageHarvester (app usage telemetry)
        └── BrainDumpHarvester (capture pattern clustering)
```

**Key feedback loops:**
1. Proposals → approved → tasks → worked on → sessions → harvested → new seeds → new proposals
2. Responsibilities → generate tasks → completion rates → health scores → surface neglected areas → proposal seeds
3. Kill a proposal → similar future proposals deprioritized → engine learns boundaries
4. Redirect a proposal → 3 forks → user preferences revealed → tagger learns patterns
5. Project context doc auto-updates → all future Claude calls for that project are better informed

---

## 9. Frontend Apps

### 9.1 Proposals App

**Queue view (default):**
- List of proposals, newest first
- Per proposal: title, summary, confidence badge (high/med/low), tags, project badge, timestamp
- Expand inline: full body, steelman/red-team/synthesis, risks/benefits, generation log
- Three action buttons: green (approve), yellow (redirect), red (kill)
- Yellow opens inline prompt input for redirect note

**Filters:**
- By project, by tag category, by confidence range, by status
- Search across proposal content

**Evolution view:**
- Tree visualization of proposal lineage (parent → redirect forks → their forks)
- Shows how an idea evolved through multiple redirects

### 9.2 Projects App

**Grid view:**
- Project cards: name, status badge, icon, active task count, pending proposal count, health indicators from linked responsibilities, last activity timestamp
- Status filters, search

**Project detail view:**
- Header: name, status, description, linked path
- Tabs:
  - **Overview:** context doc preview, key metrics, recent activity feed
  - **Tasks:** kanban board (proposed → todo → in_progress → in_review → done)
  - **Proposals:** filtered proposal queue for this project only
  - **Sessions:** Claude session history linked to this project
  - **Seeds:** active cron seeds, with enable/disable/edit/add
  - **Settings:** project config, linked directory, parent project

### 9.3 Responsibilities App

**Role view (default):**
- Grouped by role (developer, self, maintainer, etc.)
- Per responsibility: title, cadence badge, health indicator (green/yellow/red), last check-in, next task due
- Click to expand: description, linked tasks, check-in history, project scope

**Health dashboard:**
- All responsibilities sorted by health score
- At-risk items highlighted
- Trends over time (sparklines)

### 9.4 Tasks App (Global)

**Board view:**
- Kanban across all projects, filterable
- Swim lanes by project or by priority

**List view:**
- Flat list, sortable by priority/due date/project/source
- Bulk actions: assign to project, change priority, link dependency

**Dependency graph:**
- Visual DAG of task dependencies across projects
- Highlights blocked chains

### 9.5 Brain Dump Updates

- Project selector dropdown on CaptureInput (default: Inbox)
- New "→ Seed" action on items (alongside existing → Task, → Note, → Journal)
- Items with project tag show project badge

---

## 10. Complete OTP Supervision Tree

```
Ema.Application (Application)
  ├── Ema.Repo (Ecto Repo)
  ├── Ema.PubSub (Phoenix.PubSub)
  ├── EmaWeb.Endpoint (Phoenix Endpoint)
  │
  ├── Ema.Projects.Supervisor (DynamicSupervisor)
  │     └── per active project: ProjectWorker (GenServer)
  │
  ├── Ema.ProposalEngine.Supervisor (Supervisor, rest_for_one)
  │     ├── Scheduler (GenServer + cron)
  │     ├── HarvesterSupervisor (DynamicSupervisor)
  │     │     ├── GitHarvester
  │     │     ├── SessionHarvester
  │     │     ├── VaultHarvester
  │     │     ├── UsageHarvester
  │     │     └── BrainDumpHarvester
  │     ├── Pipeline (Supervisor)
  │     │     ├── Generator (pooled)
  │     │     ├── Refiner
  │     │     ├── Debater
  │     │     └── Tagger
  │     ├── Combiner (periodic GenServer)
  │     └── KillMemory (GenServer)
  │
  ├── Ema.Responsibilities.Supervisor (Supervisor)
  │     ├── ResponsibilityScheduler
  │     ├── HealthCalculator
  │     └── ResponsibilityHarvester
  │
  ├── Ema.ClaudeSessions.Supervisor (Supervisor)
  │     ├── SessionWatcher (FileSystem)
  │     ├── SessionMonitor (process polling)
  │     ├── SessionParser
  │     └── SessionLinker
  │
  ├── Ema.Tasks.Supervisor (Supervisor)
  │     └── DecompositionWorker (GenServer, handles auto-decompose requests)
  │
  ├── Ema.SecondBrain.Supervisor (Supervisor)
  │     ├── VaultWatcher (FileSystem)
  │     ├── GraphBuilder
  │     ├── Indexer (FTS5)
  │     ├── Ingester
  │     ├── SystemBrain (PubSub → maintains system/ space)
  │     ├── DigestGenerator (daily cron)
  │     └── Bootstrap (one-shot)
  │
  ├── Ema.Pipes.Supervisor (Supervisor)
  │     ├── Registry (trigger/action/transform catalog)
  │     ├── Executor (PubSub subscriber → runs matching pipes)
  │     ├── Loader (DB → memory, seeds defaults on first boot)
  │     └── Monitor (execution history + channel broadcast)
  │
  ├── Ema.Agents.Supervisor (DynamicSupervisor)
  │     └── per active agent:
  │           AgentSupervisor (one_for_one)
  │             ├── AgentWorker (GenServer, Claude CLI calls)
  │             ├── ChannelSupervisor (DynamicSupervisor)
  │             │     ├── DiscordChannel (optional)
  │             │     ├── TelegramChannel (optional)
  │             │     └── WebchatChannel (Phoenix bridge)
  │             └── AgentMemory (conversation summarization)
  │
  ├── Ema.Canvas.Supervisor (Supervisor)
  │     ├── DataRefresher (polls data sources, pushes to channels)
  │     └── Renderer (server-side export)
  │
  └── Existing contexts (BrainDump, Habits, Journal, Settings, etc.)
```

---

## 11. Phoenix Channels (Realtime)

New channels for live updates:

```elixir
# In UserSocket
channel "proposals:queue", EmaWeb.ProposalChannel
channel "projects:*", EmaWeb.ProjectChannel
channel "tasks:*", EmaWeb.TaskChannel
channel "responsibilities:lobby", EmaWeb.ResponsibilityChannel
channel "sessions:live", EmaWeb.SessionChannel
channel "engine:status", EmaWeb.EngineChannel   # pipeline health, active workers, queue depth
channel "vault:*", EmaWeb.VaultChannel           # file tree, graph, note editing
channel "pipes:editor", EmaWeb.PipesEditorChannel  # canvas state sync
channel "pipes:monitor", EmaWeb.PipesMonitorChannel # live execution feed
channel "agents:lobby", EmaWeb.AgentLobbyChannel   # agent list + status
channel "agents:chat:*", EmaWeb.AgentChatChannel   # webchat per agent
channel "canvas:*", EmaWeb.CanvasChannel           # element CRUD, data pushes
```

`engine:status` is notable — it broadcasts the health of the proposal pipeline itself so the UI can show "engine is thinking" indicators, queue depth, active generation count.

---

## 12. REST API Additions

```elixir
scope "/api", EmaWeb do
  pipe_through :api

  # Projects
  resources "/projects", ProjectController, except: [:new, :edit]
  get "/projects/:slug/context", ProjectController, :context
  post "/projects/:slug/rebuild-context", ProjectController, :rebuild_context

  # Tasks
  resources "/tasks", TaskController, except: [:new, :edit]
  post "/tasks/:id/decompose", TaskController, :decompose
  post "/tasks/:id/transition", TaskController, :transition
  get "/projects/:project_id/tasks", TaskController, :by_project

  # Proposals
  get "/proposals", ProposalController, :index
  get "/proposals/:id", ProposalController, :show
  post "/proposals/:id/approve", ProposalController, :approve
  post "/proposals/:id/redirect", ProposalController, :redirect
  post "/proposals/:id/kill", ProposalController, :kill
  get "/proposals/:id/lineage", ProposalController, :lineage

  # Seeds
  resources "/seeds", SeedController, except: [:new, :edit]
  post "/seeds/:id/toggle", SeedController, :toggle
  post "/seeds/:id/run-now", SeedController, :run_now

  # Responsibilities
  resources "/responsibilities", ResponsibilityController, except: [:new, :edit]
  post "/responsibilities/:id/check-in", ResponsibilityController, :check_in

  # Claude Sessions
  get "/sessions", SessionController, :index
  get "/sessions/active", SessionController, :active
  post "/sessions/:id/link", SessionController, :link_project

  # Engine status
  get "/engine/status", EngineController, :status
  post "/engine/pause", EngineController, :pause
  post "/engine/resume", EngineController, :resume

  # Existing routes...
end
```

---

## 13. Database Migrations Needed

New tables:
- `projects` — core project table
- `proposals` — proposal queue with full pipeline output
- `proposal_seeds` — seed definitions with schedules
- `proposal_tags` — hierarchical tag assignments
- `task_dependencies` — join table for blocks/blocked_by
- `task_comments` — comment log per task
- `responsibilities` — recurring obligations by role
- `responsibility_check_ins` — health check-in log

Modifications to existing:
- `tasks` — drop existing table and recreate with expanded schema (current table is empty scaffold). New fields: source_type, source_id, effort, recurrence, sort_order, completed_at, metadata, project_id (FK), responsibility_id (FK), parent_id (self-ref)
- `claude_sessions` — drop existing table and recreate with expanded schema (current table is empty scaffold). New fields: session_id, ended_at, tool_calls, files_touched, raw_path, metadata, project_id (FK)
- `inbox_items` (brain dump) — add: project_id (FK)
- `goals` — add: project_id (FK)
- `agent_runs` — add: task_id (FK) to link runs to tasks, agent_id (FK replacing template_id)

Additional new tables (from sections 19-22):
- `vault_notes` — note metadata and index
- `vault_links` — bidirectional link edges
- `vault_notes_fts` — FTS5 virtual table for full-text search
- `pipes` — pipe definitions (trigger → actions workflows)
- `pipe_actions` — ordered actions per pipe
- `pipe_transforms` — ordered transforms per pipe
- `pipe_runs` — execution history log
- `agents` — replaces `agent_templates` with richer schema
- `agent_channels` — channel bindings per agent (Discord, Telegram, etc.)
- `agent_conversations` — conversation sessions
- `agent_messages` — message history per conversation
- `canvases` — canvas definitions
- `canvas_elements` — elements with data binding support

Drop existing scaffolds:
- `vault_index` — replaced by `vault_notes` + `vault_links`
- `agent_templates` — replaced by `agents`
- `inbox_items` (brain dump) — add: project_id (FK)
- `goals` — add: project_id (FK)

---

## 14. Claude CLI Integration Details

All Claude CLI calls go through a shared `Ema.Claude.Runner` module:

```elixir
defmodule Ema.Claude.Runner do
  @doc "Runs claude CLI with structured prompt, returns parsed output"
  def run(prompt, opts \\ []) do
    project_path = Keyword.get(opts, :project_path)
    timeout = Keyword.get(opts, :timeout, 120_000)
    model = Keyword.get(opts, :model, "sonnet")

    args = build_args(prompt, project_path, model)

    case System.cmd("claude", args, stderr_to_stdout: true, timeout: timeout) do
      {output, 0} -> {:ok, parse_output(output)}
      {error, code} -> {:error, %{code: code, message: error}}
    end
  end

  defp build_args(prompt, project_path, model) do
    base = ["--print", "--output-format", "json", "--model", model, "-p", prompt]
    if project_path, do: base ++ ["--project", project_path], else: base
  end
end
```

**Prompt engineering:** Each pipeline stage (Generator, Refiner, Debater, Tagger) has its own prompt template stored in `priv/prompts/`. Templates use EEx for variable interpolation. Project context.md is injected as a system-level prefix.

---

## 15. Design Language Integration

All new apps follow the existing EMA design spec:
- Glass card surfaces with the established tier system
- Sidebar icons for: Proposals (lightbulb), Projects (folder-tree), Tasks (check-square), Responsibilities (shield), Agents (bot), Second Brain (brain/network), Canvas (palette), Pipes (workflow)
- Same animation springs, hover states, and typography
- Confidence scores shown as colored badges: high (primary/teal), medium (secondary/blue), low (tertiary/amber)
- Three action buttons use semantic colors: green (success), yellow (warning), red (error) — as accent fills on glass-ambient buttons, not literal traffic lights

---

## 16. Proposals App — Detailed View Spec

### 16.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ░░ Ambient Strip ░░░░░░░░░░░░░ Engine: 3 active ░░░░░░░░  │
├───────────┬─────────────────────────────────────────────────┤
│           │  ┌─────────────────────────────────────────┐    │
│  Sidebar  │  │ Toolbar                                 │    │
│           │  │ [+ New Seed] [Pipeline ▾] [Filters ▾]   │    │
│           │  │ [Queue (12)] [Evolution] [Seeds] [Engine]│    │
│           │  └─────────────────────────────────────────┘    │
│           │                                                 │
│           │  ┌─ Queue View ───────────────────────────┐    │
│           │  │                                         │    │
│           │  │  ┌─ Proposal Card ───────────────────┐  │    │
│           │  │  │ ◉ 0.87  Enhancement: Brain Dump    │  │    │
│           │  │  │ "Auto-categorize captures using     │  │    │
│           │  │  │  NLP pattern matching on entry..."   │  │    │
│           │  │  │                                     │  │    │
│           │  │  │ 🏷 enhancement:brain-dump  ema-core │  │    │
│           │  │  │ 📁 ema   ⏱ 2h ago   scope: M       │  │    │
│           │  │  │                                     │  │    │
│           │  │  │  [▼ Expand]                         │  │    │
│           │  │  │                                     │  │    │
│           │  │  │  [● Approve] [◐ Redirect] [✕ Kill]  │  │    │
│           │  │  └─────────────────────────────────────┘  │    │
│           │  │                                         │    │
│           │  │  ┌─ Proposal Card (expanded) ────────┐  │    │
│           │  │  │ ...full body, debate, risks...     │  │    │
│           │  │  └─────────────────────────────────────┘  │    │
│           │  └─────────────────────────────────────────┘    │
├───────────┴─────────────────────────────────────────────────┤
│  ░░ Command Bar ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────────────────────────────┘
```

### 16.2 Toolbar Tabs

**Queue** — the proposal review queue (default view)
**Evolution** — tree view of proposal lineage (redirects, forks, cross-pollinations)
**Seeds** — manage all seed prompts (cron, harvester, one-shot)
**Engine** — pipeline observatory (live status, throughput, health)

### 16.3 Queue View (Detail)

**Proposal Card (collapsed):**
- Left: confidence score as colored circle (teal ≥0.7, blue 0.4-0.7, amber <0.4)
- Title: bold, one line
- Summary: 2 lines max, text-secondary
- Tag row: hierarchical tags as pills, project badge, scope badge (XS-XL), relative timestamp
- Action row: three buttons, evenly spaced
- Hover: card lifts, border brightens

**Proposal Card (expanded):**
Clicking "Expand" reveals:
- **Problem statement** — what this proposal addresses
- **Approach** — how it proposes to solve it
- **Trade-offs** — pro/con analysis
- **Steelman** — best argument for doing this
- **Red team** — best argument against
- **Synthesis** — the debater's final take
- **Risks** — bullet list with severity indicators
- **Benefits** — bullet list
- **Generation log** — collapsible: raw seed prompt, generator output, refiner edits, debater output
- **Lineage** — if this proposal was forked from another, show parent link and sibling count

**Redirect flow:**
1. Click Redirect button
2. Card expands a text input below the actions: "Redirect this idea toward..."
3. User types a note (e.g., "what if this was a CLI tool instead of a UI feature")
4. Submit → card animates out → 3 new proposals will appear in queue as they complete pipeline
5. The 3 forks are visually linked (subtle connector line or "forked from X" badge)

### 16.4 Seed Management View

```
┌─────────────────────────────────────────────────────────┐
│  Seeds                                      [+ New Seed] │
│                                                         │
│  ┌─ Active Seeds ─────────────────────────────────────┐ │
│  │                                                     │ │
│  │  ⏱ "Brainstorm new ema apps"                       │ │
│  │    Project: ema  │  Every 6h  │  Runs: 14          │ │
│  │    Last: 2h ago  │  Next: 4h  │  [Pause] [Edit]    │ │
│  │    [▶ Run Now]   │  [⚡ Accelerate]                 │ │
│  │                                                     │ │
│  │  ⏱ "Integration ideas for vault bridge"             │ │
│  │    Project: ema  │  Every 12h │  Runs: 7           │ │
│  │    Last: 5h ago  │  Next: 7h  │  [Pause] [Edit]    │ │
│  │    [▶ Run Now]   │  [⚡ Accelerate]                 │ │
│  │                                                     │ │
│  │  🔄 GitHarvester (auto)                             │ │
│  │    Watching: ~/Projects/ema  │  Seeds generated: 3  │ │
│  │    [Pause] [Configure]                              │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Paused Seeds ─────────────────────────────────────┐ │
│  │  ...                                                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ One-Shot Seeds (completed) ───────────────────────┐ │
│  │  ...                                                │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**New Seed dialog:**
- Prompt template (textarea, supports `{{project_context}}` and `{{recent_proposals}}` interpolation variables)
- Schedule: preset (hourly, every 6h, daily, weekly) or custom cron expression
- Project scope: dropdown of active projects, or "Global"
- Tags to auto-apply to generated proposals
- "Run immediately after saving" checkbox

**Accelerate button (⚡):**
This is the key interaction you described. Clicking Accelerate on a seed:
1. Immediately triggers 3 parallel runs of this seed with varied temperature/framing
2. The 3 runs go through the full pipeline (generate → refine → debate → tag)
3. Results appear in queue faster because they skip the scheduler wait
4. A subtle "accelerated" badge on the resulting proposals
5. Can also accelerate the entire pipeline for a specific proposal already in queue — pushes it through refiner/debater immediately rather than waiting for batch processing

**Run Now (▶):**
Single immediate execution. Same pipeline, just skips the cron wait.

### 16.5 Pipeline Acceleration Controls

Beyond per-seed acceleration, the toolbar has a **Pipeline dropdown**:

```
Pipeline ▾
├── Status: Running (3 in generator, 1 in refiner, 0 in debater)
├── ──────────
├── ⚡ Boost Mode (2x throughput, more Claude calls)
├── ⏸ Pause Pipeline (stops all generation, keeps queue)
├── ▶ Resume Pipeline
├── ──────────
├── 🔄 Flush & Regenerate (re-run all queued through refiner)
└── ⚙ Pipeline Settings...
```

**Boost Mode:** doubles the generator pool size temporarily, runs refiner and debater in parallel instead of sequential, uses faster model for tagging. Burns more Claude API calls but fills the queue faster. Auto-disables after 1 hour or N proposals (configurable).

**Pipeline Settings dialog:**
- Generator pool size (default: 2 concurrent)
- Refiner enabled/disabled (skip for speed)
- Debater enabled/disabled (skip for speed)
- Default model per stage (generator: opus, refiner: sonnet, debater: sonnet, tagger: haiku)
- Batch size (how many proposals move through each stage per tick)
- Cross-pollination frequency (hourly default)

### 16.6 Engine Observatory View

Live dashboard of the proposal engine internals:

```
┌─────────────────────────────────────────────────────────┐
│  Engine Observatory                                      │
│                                                         │
│  Pipeline Status                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Generator│→ │ Refiner  │→ │ Debater  │→ │ Tagger │ │
│  │ ●●○ 2/3 │  │ ● 1/1   │  │ ○ 0/1   │  │ ○ 0/1 │ │
│  │ 14 today │  │ 12 today │  │ 11 today │  │ 11 today│ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│                                                         │
│  Queue Depth: 12 pending  │  Kill rate: 23%             │
│  Approval rate: 34%       │  Redirect rate: 43%         │
│                                                         │
│  Active Harvesters                                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │ GitHarvester      ● watching  │ 3 seeds today     │  │
│  │ SessionHarvester  ● watching  │ 1 seed today      │  │
│  │ VaultHarvester    ● watching  │ 0 seeds today     │  │
│  │ UsageHarvester    ● watching  │ 2 seeds today     │  │
│  │ BrainDumpHarvester● watching  │ 0 seeds today     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Combiner: last run 45m ago  │  2 cross-pollinations    │
│  KillMemory: 8 patterns tracked                         │
│                                                         │
│  Recent Pipeline Activity (live feed)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 14:32 Generator completed "Auto-archive stale..." │  │
│  │ 14:31 Refiner completed "CLI tool for seed mgmt"  │  │
│  │ 14:28 Tagger assigned enhancement:tasks to #47    │  │
│  │ 14:25 Combiner merged seeds #12 + #15 → synth     │  │
│  │ ...                                                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 16.7 Evolution View

Tree visualization showing how proposals relate:

```
┌─────────────────────────────────────────────────────────┐
│  Evolution                              [Filter ▾]       │
│                                                         │
│  Seed: "Brainstorm new ema apps"                        │
│  │                                                      │
│  ├── #12 "Focus timer with pomodoro" (killed)           │
│  ├── #15 "CLI tool for seed management" (queued)        │
│  ├── #18 "Vault-aware note linking" (approved → Task#7) │
│  │   └── spawned dependency seeds:                      │
│  │       ├── #22 "Bidirectional vault sync" (queued)    │
│  │       └── #23 "Note template system" (queued)        │
│  ├── #21 "Ambient notification system" (redirected)     │
│  │   ├── #24 "System tray notifications" (queued)       │
│  │   ├── #25 "Desktop widget overlay" (killed)          │
│  │   └── #26 "KDE Plasma integration" (queued)          │
│  └── Cross-pollination:                                 │
│      └── #28 = #15 × #23 "CLI seed mgmt + templates"   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Nodes are colored by status. Click any node to see the full proposal. Drag to rearrange view. Zoom/pan for large trees.

---

## 17. Claude CLI Session & Context Management

### 17.1 The Context Problem

Every Claude CLI call the engine makes needs context — project state, recent proposals, session history, responsibilities. Without good context management, the generator produces generic slop. The quality bar depends on this.

### 17.2 Context Assembly

The `Ema.Claude.ContextManager` GenServer is responsible for assembling context for any Claude CLI call. It maintains hot caches of frequently accessed context and assembles prompt prefixes on demand.

```elixir
defmodule Ema.Claude.ContextManager do
  use GenServer

  @doc "Build a context-enriched prompt for a given scope"
  def build_prompt(seed, opts \\ []) do
    project = Keyword.get(opts, :project)
    stage = Keyword.get(opts, :stage, :generator)

    context = %{
      project_context: project && build_project_context(project),
      recent_proposals: build_recent_proposals(project, stage),
      active_tasks: build_active_tasks(project),
      responsibilities: build_responsibilities(project),
      recent_sessions: build_recent_sessions(project),
      kill_patterns: build_kill_patterns(),
      system_state: build_system_state()
    }

    assemble(seed.prompt_template, context, stage)
  end

  defp build_project_context(project) do
    # Read the project's context.md
    # Include: description, status, active goals, recent decisions
    # Truncate to fit token budget (configurable per stage)
  end

  defp build_recent_proposals(project, stage) do
    # Last 10 proposals for this project (or global)
    # For generator: show titles + summaries (avoid repetition)
    # For refiner: show the full proposal being refined
    # For debater: show proposal + refiner output
  end

  defp build_active_tasks(project) do
    # In-progress and todo tasks for context
    # Helps generator avoid proposing work that's already planned
  end

  defp build_kill_patterns do
    # Summaries of killed proposals to avoid regenerating similar ideas
  end

  defp build_system_state do
    # Current ema state: which apps exist, what's been built,
    # what's scaffolded, what the codebase looks like
    # Keeps proposals grounded in reality
  end
end
```

### 17.3 Token Budget Management

Each pipeline stage has a token budget for context injection:

| Stage     | Model (default) | Context budget | Purpose |
|-----------|----------------|----------------|---------|
| Generator | opus           | 8K tokens      | Rich context for creative ideation |
| Refiner   | sonnet         | 4K tokens      | Focused on the proposal + project summary |
| Debater   | sonnet         | 4K tokens      | Proposal + critique, less project context |
| Tagger    | haiku          | 2K tokens      | Minimal, just the proposal text + tag taxonomy |

The ContextManager estimates token counts and truncates intelligently — prioritizing recent and relevant context over comprehensive coverage.

### 17.4 Session Continuity

For multi-turn Claude CLI interactions (like task decomposition or proposal deep-dives), the system uses Claude CLI's `--continue` flag to maintain conversation context:

```elixir
defmodule Ema.Claude.Session do
  @doc "Start a new Claude session for extended interaction"
  def start(prompt, opts) do
    {output, session_id} = run_with_session(prompt, opts)
    {:ok, %{session_id: session_id, output: output}}
  end

  @doc "Continue an existing session"
  def continue(session_id, follow_up) do
    run_continue(session_id, follow_up)
  end
end
```

Use cases:
- **Task decomposition:** Start with "break this task down", then iteratively refine subtasks in the same session
- **Proposal deep-dive:** When a user wants to explore a proposal further before deciding, open a session with the proposal context loaded
- **Seed refinement:** Iteratively improve a seed prompt through conversation

### 17.5 Session Import Detail

The `SessionWatcher` does more than just log metadata. It extracts actionable intelligence:

```elixir
defmodule Ema.ClaudeSessions.Intelligence do
  @doc "Extract structured intelligence from a parsed session"
  def extract(parsed_session) do
    %{
      # What was the session about?
      topic_summary: summarize_topic(parsed_session),

      # What files were most touched?
      hot_files: extract_hot_files(parsed_session),

      # What patterns suggest friction?
      friction_signals: detect_friction(parsed_session),

      # What was decided?
      decisions: extract_decisions(parsed_session),

      # What was left unfinished?
      loose_ends: extract_loose_ends(parsed_session),

      # What tools/approaches were used?
      techniques: extract_techniques(parsed_session)
    }
  end

  defp detect_friction(session) do
    # Multiple retries on same file → editing friction
    # Long gaps between tool calls → thinking/stuck
    # Error outputs → tool failures
    # Same grep patterns repeated → search friction
  end

  defp extract_loose_ends(session) do
    # TODO comments added but not resolved
    # Files opened but not edited
    # Questions asked but not answered
    # Tests written but not passing at session end
  end
end
```

Friction signals and loose ends feed directly into the `SessionHarvester` to generate proposal seeds.

### 17.6 Live Session Integration

When a Claude Code session is detected as active:

1. The `SessionMonitor` broadcasts `{:session_active, project_path}` via PubSub
2. The frontend shows a live indicator in the ambient strip: "Claude active in ema"
3. The project's detail view shows a "Live Session" badge
4. The ContextManager can optionally inject "there's an active Claude session working on X" into proposal generation — avoids proposing work that's literally being done right now
5. When the session ends, the import pipeline runs immediately (not waiting for next poll)

---

## 18. Brain Dump — Full Integration Spec

### 18.1 Project Selector

```
┌─────────────────────────────────────────────────────────┐
│  Capture                                                 │
│  ┌─────────────────────────────────────────┐ ┌────────┐ │
│  │ What's on your mind?                    │ │ Inbox ▾│ │
│  └─────────────────────────────────────────┘ └────────┘ │
│                                                         │
│  Dropdown:                                              │
│  ┌────────┐                                             │
│  │ Inbox  │ ← default, no project                       │
│  │ ema    │                                             │
│  │ vault  │                                             │
│  │ ...    │ ← all active projects                       │
│  └────────┘                                             │
└─────────────────────────────────────────────────────────┘
```

### 18.2 Updated Actions

Per brain dump item, the action row becomes:
- **→ Task** — creates task (if project selected, auto-assigns to that project; otherwise asks)
- **→ Seed** — converts to a one-shot proposal seed (project-scoped if selected)
- **→ Note** — existing behavior
- **→ Journal** — existing behavior
- **Archive** — existing behavior
- **✕ Delete** — existing behavior

### 18.3 Elixir Schema Update

```elixir
# Add to inbox_items
field :project_id, :string  # FK to projects, nullable
belongs_to :project, Ema.Projects.Project
```

---

## 19. Second Brain — Built-in Knowledge Vault

### 19.1 What It Is

Second Brain is EMA's built-in knowledge system. A graph-connected vault of markdown files organized into spaces. Not a clone of Obsidian — it's purpose-built for EMA's workflow. Every note is a node in a bidirectional graph. Every link is an edge. The system knows what connects to what, and the proposal engine, projects, and tasks all read from and write to it.

**Data location:** `~/.local/share/ema/vault/`

### 19.2 Spaces

Spaces are top-level organizational separations. Each space is a directory with its own purpose and behavior.

```
~/.local/share/ema/vault/
├── research-ingestion/        # Raw material: articles, links, clippings, AI outputs
│   ├── _index.md
│   ├── articles/
│   ├── clippings/
│   ├── references/
│   └── raw/                   # unprocessed dumps
│
├── projects/                  # Per-project knowledge
│   ├── _index.md
│   ├── ema/                   # EMA itself — all specs, plans, ADRs live here
│   │   ├── _index.md
│   │   ├── specs/             # design specs (this document lives here)
│   │   ├── plans/             # implementation plans
│   │   ├── adrs/              # architecture decision records
│   │   ├── sessions/          # imported claude session summaries
│   │   └── notes/             # freeform project notes
│   └── <other-projects>/      # auto-created when a Project is created in the system
│       └── ...
│
├── user-preferences/          # About you: how you work, what you like, settings rationale
│   ├── _index.md
│   ├── workflows.md           # preferred workflows, shortcuts, patterns
│   ├── conventions.md         # coding standards, naming, style
│   ├── tools.md               # tool preferences, configs, why you chose them
│   └── decisions.md           # personal decision log (why you chose X over Y)
│
└── _graph.json                # bidirectional link index (rebuilt by daemon)
```

### 19.3 Notes

Every file is a markdown note with YAML frontmatter:

```markdown
---
id: "note_2026-03-30_001"
title: "EMA Engine Design Spec"
space: projects/ema/specs
tags: [spec, proposal-engine, projects, tasks]
links: []              # auto-populated by graph builder
backlinks: []          # auto-populated by graph builder
created: 2026-03-30T14:00:00Z
modified: 2026-03-30T14:00:00Z
source: manual         # manual | proposal | session | ingestion | brain-dump
source_id: null        # links to originating entity if auto-created
---

# EMA Engine Design Spec

Content here. Link to other notes with [[wikilinks]].
Reference a project with [[projects/ema/_index]].
```

**Wikilink resolution:** `[[note-title]]` resolves by searching titles across all spaces. `[[space/path/note]]` resolves by path. Ambiguous links prompt for disambiguation.

### 19.4 The Graph

The bidirectional graph is the core differentiator. Every `[[wikilink]]` creates two edges: forward link and backlink. The daemon maintains this in two places:

1. **`_graph.json`** — serialized adjacency list, rebuilt on file changes. Used for fast graph queries.
2. **`vault_graph` table** — relational representation for SQL queries (find all notes linked to X, shortest path between A and B, cluster detection).

```elixir
defmodule Ema.SecondBrain.Note do
  schema "vault_notes" do
    field :file_path, :string            # relative to vault root
    field :title, :string
    field :space, :string                # research-ingestion | projects | user-preferences
    field :content_hash, :string         # for change detection
    field :source_type, :string          # manual | proposal | session | ingestion | brain-dump
    field :source_id, :string
    field :tags, {:array, :string}
    field :word_count, :integer
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project  # for notes in projects/ space

    has_many :outgoing_links, Ema.SecondBrain.Link, foreign_key: :source_note_id
    has_many :incoming_links, Ema.SecondBrain.Link, foreign_key: :target_note_id

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.SecondBrain.Link do
  schema "vault_links" do
    field :link_text, :string            # the [[text]] as written
    field :link_type, :string            # wikilink | tag | embed | reference
    field :context, :string              # surrounding sentence for preview

    belongs_to :source_note, Ema.SecondBrain.Note
    belongs_to :target_note, Ema.SecondBrain.Note  # nil if unresolved (broken link)

    timestamps(type: :utc_datetime)
  end
end
```

### 19.5 Graph Operations

The daemon provides graph queries that power the UI and feed the proposal engine:

```elixir
defmodule Ema.SecondBrain.Graph do
  @doc "All notes directly linked to/from this note"
  def neighbors(note_id), do: ...

  @doc "All notes within N hops"
  def neighborhood(note_id, depth \\ 2), do: ...

  @doc "Detect clusters of densely connected notes"
  def clusters, do: ...

  @doc "Find orphan notes (no incoming or outgoing links)"
  def orphans, do: ...

  @doc "Find notes with most connections (hub nodes)"
  def hubs(limit \\ 10), do: ...

  @doc "Shortest path between two notes"
  def path(from_id, to_id), do: ...

  @doc "Notes related by shared links (neighbors of neighbors)"
  def related(note_id, limit \\ 10), do: ...

  @doc "Full graph for visualization (nodes + edges)"
  def full_graph(opts \\ []), do: ...

  @doc "Subgraph filtered by space, tags, or project"
  def subgraph(filters), do: ...
end
```

### 19.6 Space Behaviors

Each space has distinct behavior:

**Research & Ingestion:**
- Accepts raw content: paste URLs (auto-fetched and converted to markdown), paste text, paste images (stored as attachments)
- "Ingest" action: takes raw material and creates a structured note with summary, key points, and auto-generated tags
- The VaultHarvester watches this space for unprocessed material → generates proposal seeds like "this research suggests we could..."
- Notes here often get linked to project notes as references

**Projects:**
- Auto-creates a subdirectory when a new Project is created in the system
- Project's context.md is actually a vault note (dual-homed — exists in vault and serves as the project context doc)
- Claude session summaries auto-create notes here
- Approved proposals auto-create spec notes here
- Implementation plans auto-create notes here
- This is where institutional knowledge about each project accumulates

**User & Preferences:**
- Manually curated — this is about you, not about projects
- The ContextManager reads from this space to inject personal preferences into Claude calls
- Proposal engine reads this to understand what kind of work you prefer, your style, your conventions
- "How I like to work" feeds into proposal quality — the engine knows not to propose things that conflict with your preferences

### 19.7 Project Space — EMA Bootstrap

On first run, EMA bootstraps its own project space with all existing documentation:

```
vault/projects/ema/
├── _index.md                          # EMA project overview
├── specs/
│   ├── 2026-03-29-ema-design.md       # original design spec (imported from docs/)
│   ├── 2026-03-29-ema-multiwindow.md  # multiwindow spec
│   └── 2026-03-30-ema-engine.md       # this document
├── plans/
│   ├── 2026-03-29-implementation.md   # original implementation plan
│   └── 2026-03-29-multiwindow.md      # multiwindow plan
├── adrs/
│   └── 001-elixir-otp-backbone.md     # why Elixir is the backbone
├── sessions/                           # auto-populated by SessionWatcher
└── notes/
    └── openclaw-lessons.md            # what we learned from the openclaw attempt
```

All cross-references between these files use `[[wikilinks]]`, building a rich graph of EMA's own knowledge about itself. The proposal engine generating ideas for EMA has full access to this — it knows what was designed, what was built, what was tried, what was decided.

### 19.8 Two-Way Integration with Everything

**Second Brain → Proposal Engine:**
- VaultHarvester watches for orphans, clusters, stale notes → generates seeds
- Project notes provide context for project-scoped proposal generation
- Research notes feed the generator with domain knowledge
- User preference notes shape how proposals are written

**Proposal Engine → Second Brain:**
- Approved proposals auto-create spec notes in the project space
- Killed proposals optionally create "rejected ideas" notes (learnings)
- Cross-pollination results create synthesis notes

**Second Brain → Tasks:**
- Notes can contain `- [ ] task items` that sync to the task system
- Task descriptions can reference vault notes via `[[wikilinks]]`
- Task completion can trigger note updates

**Second Brain → Claude Sessions:**
- Session summaries auto-create notes in the project space
- Session intelligence (friction points, decisions) creates linked notes
- The ContextManager can pull relevant vault notes into Claude CLI prompts

**Second Brain → Brain Dump:**
- "→ Note" action on brain dump items creates a vault note (with space selection)
- Research clippings captured via brain dump route to research-ingestion space

**Second Brain → Responsibilities:**
- Responsibility descriptions can link to vault notes explaining the why
- Check-in notes create vault entries for history

### 19.9 Frontend — Second Brain App

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  ░░ Ambient Strip ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
├───────────┬─────────────────────────────────────────────────┤
│           │  ┌─────────────────────────────────────────┐    │
│  Sidebar  │  │ [Files] [Graph] [Search]    [+ Note ▾]  │    │
│           │  └─────────────────────────────────────────┘    │
│           │                                                 │
│           │  ┌─ Split View ───────────────────────────┐    │
│           │  │                                         │    │
│           │  │  ┌─ File Tree ──┐ ┌─ Editor ─────────┐ │    │
│           │  │  │              │ │                    │ │    │
│           │  │  │ ▼ research   │ │  # Note Title     │ │    │
│           │  │  │   articles/  │ │                    │ │    │
│           │  │  │   clippings/ │ │  Content with      │ │    │
│           │  │  │ ▼ projects   │ │  [[wikilinks]]    │ │    │
│           │  │  │   ▼ ema      │ │  that highlight   │ │    │
│           │  │  │     specs/   │ │  and are           │ │    │
│           │  │  │     plans/   │ │  clickable.       │ │    │
│           │  │  │   other-proj │ │                    │ │    │
│           │  │  │ ▼ user-prefs │ │  ── Backlinks ──  │ │    │
│           │  │  │   workflows  │ │  [[note-a]]       │ │    │
│           │  │  │   tools      │ │  [[note-b]]       │ │    │
│           │  │  └──────────────┘ └────────────────────┘ │    │
│           │  │                                         │    │
│           │  └─────────────────────────────────────────┘    │
├───────────┴─────────────────────────────────────────────────┤
│  ░░ Command Bar ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────────────────────────────┘
```

**Three views:**

**Files view:**
- Split panel: file tree on left, editor on right
- File tree shows spaces as top-level collapsible sections
- Click a file to open in editor
- Editor: markdown with live preview, wikilink autocomplete, tag autocomplete
- Below editor: backlinks panel showing all notes that link to this one, with context snippets
- Right-click context menu: rename, move, delete, copy link, open in graph

**Graph view:**
- Interactive force-directed graph visualization
- Nodes = notes, sized by connection count
- Edges = links, colored by type (wikilink, tag, embed)
- Colored by space: research (blue), projects (teal), user-prefs (amber)
- Click a node to open the note
- Hover for preview tooltip
- Filter controls: by space, by tag, by project, by date range
- Zoom into a subgraph by selecting a note and choosing "Show neighborhood (N hops)"
- Cluster highlighting: densely connected groups get a subtle background color
- Orphan nodes shown in a separate "disconnected" area

**Search view:**
- Full-text search across all vault content
- Filter by space, tags, date range
- Results show title, matching content snippet, backlink count, tags
- Sort by relevance, date modified, connection count

**+ Note dropdown:**
- Quick create with space selection
- Templates per space (research has "article summary" template, projects has "decision record" template)
- "Import from clipboard" — paste and auto-detect format (URL → fetch, text → note, markdown → as-is)

### 19.10 OTP Architecture

```
Ema.SecondBrain.Supervisor (Supervisor)
  ├── VaultWatcher (GenServer, FileSystem watcher on vault directory)
  │     └── detects file changes, triggers re-index and graph rebuild
  ├── GraphBuilder (GenServer)
  │     └── parses wikilinks from all notes, builds adjacency list
  │     └── writes _graph.json and updates vault_links table
  │     └── debounced rebuild on file changes (2s)
  ├── Indexer (GenServer)
  │     └── maintains vault_notes table from file system state
  │     └── full-text search index (SQLite FTS5)
  ├── Ingester (GenServer)
  │     └── processes raw content: URL fetching, markdown conversion, summarization
  │     └── uses Claude CLI for summarization when content is substantial
  └── Bootstrap (Task, runs once on first start)
        └── creates space directories, imports existing docs, builds initial graph
```

### 19.11 Phoenix Channel

```elixir
channel "vault:*", EmaWeb.VaultChannel
# vault:files — file tree updates, create/rename/delete
# vault:graph — graph structure updates
# vault:note:<id> — live editing (future: collaborative)
```

### 19.12 REST API

```elixir
# Second Brain / Vault
get "/vault/tree", VaultController, :tree
get "/vault/note", VaultController, :show            # ?path=research/foo.md
put "/vault/note", VaultController, :update           # create or update by path
delete "/vault/note", VaultController, :delete
post "/vault/note/move", VaultController, :move
get "/vault/search", VaultController, :search         # ?q=keyword&space=projects
get "/vault/graph", VaultController, :graph            # full or filtered graph
get "/vault/graph/neighbors/:id", VaultController, :neighbors
get "/vault/graph/orphans", VaultController, :orphans
get "/vault/graph/clusters", VaultController, :clusters
post "/vault/ingest", VaultController, :ingest         # URL or raw content
```

### 19.13 Migrations

New tables:
- `vault_notes` — note metadata and index
- `vault_links` — bidirectional link edges
- `vault_notes_fts` — FTS5 virtual table for full-text search

Drop existing `vault_index` table (was a scaffold for read-only Obsidian indexing, replaced by this richer system).

### 19.14 Relationship to Obsidian Vault

The Second Brain is **separate** from your Obsidian vault at `~/Documents/obsidian_first_stuff/twj1/`. It's EMA's own knowledge store. However:

- The VaultHarvester can optionally watch your Obsidian vault as a read-only source for seed generation
- A future "Import from Obsidian" action can copy specific notes into the Second Brain
- The two systems coexist — Obsidian for your broader PKM, Second Brain for EMA-specific working knowledge
- If you want to bridge them, the `research-ingestion` space can ingest from Obsidian paths

### 19.15 System Brain — EMA's Self-Awareness

A fourth space: `system/`. This is where EMA stores its own state as structured markdown — a living, queryable, linkable representation of everything happening in the app. The proposal engine reads this space to understand the full picture.

```
vault/system/
├── _index.md                          # system state overview (auto-generated)
├── state/
│   ├── projects.md                    # auto-synced list of all projects + statuses
│   ├── tasks.md                       # active tasks across all projects
│   ├── proposals.md                   # current queue snapshot
│   ├── responsibilities.md            # all responsibilities + health scores
│   ├── seeds.md                       # active seeds + schedules
│   ├── sessions.md                    # recent claude sessions
│   └── engine.md                      # pipeline status, throughput, patterns
├── history/
│   ├── decisions/                     # auto-logged: every green/yellow/red action
│   │   └── 2026-03-30-approved-vault-sync.md
│   ├── transitions/                   # auto-logged: project/task status changes
│   └── digests/                       # daily auto-generated system digest
│       └── 2026-03-30.md
├── patterns/
│   ├── kill-patterns.md               # what gets killed, why, trends
│   ├── approval-patterns.md           # what gets approved, common traits
│   ├── redirect-patterns.md           # how redirects evolve, user preferences
│   └── productivity-patterns.md       # task completion rates, active hours, focus areas
└── meta/
    ├── schema.md                      # current database schema as readable doc
    ├── otp-tree.md                    # current supervision tree state
    └── config.md                      # daemon configuration as readable doc
```

**Auto-sync behavior:** A `SystemBrain` GenServer subscribes to all PubSub events and maintains these files:

```elixir
defmodule Ema.SecondBrain.SystemBrain do
  use GenServer

  @doc """
  Listens to all EMA events and maintains the system/ space
  as a living markdown representation of app state.
  """

  # On any project change → rebuild projects.md
  def handle_info({:project_updated, _}, state), do: rebuild(:projects, state)

  # On any task change → rebuild tasks.md
  def handle_info({:task_updated, _}, state), do: rebuild(:tasks, state)

  # On any proposal action → rebuild proposals.md + log decision
  def handle_info({:proposal_acted, action, proposal}, state) do
    rebuild(:proposals, state)
    log_decision(action, proposal)
    update_patterns(action, proposal)
    {:noreply, state}
  end

  # Daily digest → summarize the day's activity
  def handle_info(:daily_digest, state), do: generate_digest(state)

  # All state files use [[wikilinks]] to cross-reference:
  # projects.md links to vault/projects/<slug>/_index.md
  # tasks.md links to the project they belong to
  # decisions link to the proposal they acted on
  # Everything is graph-connected
end
```

**Why this matters:** The system brain means:
1. The proposal engine has a structured, linkable view of everything — not just raw DB queries, but narrative context about what's happening, what patterns are emerging, what's been decided
2. The graph connects system state to project knowledge to research to user preferences — a Claude call can traverse from "this task is blocked" → "because this project depends on X" → "which was researched in this note" → "which the user prefers to approach this way"
3. Daily digests become vault notes that the SessionHarvester and VaultHarvester can mine for patterns over time
4. Decision history is queryable: "show me all proposals I killed that were tagged enhancement:tasks" — because they're notes with links and tags
5. You can open the graph view and literally see how your system state connects to your knowledge

**Updated space list:**
- `research-ingestion/` — raw material, articles, references
- `projects/` — per-project knowledge, specs, plans, sessions
- `user-preferences/` — how you work, conventions, tool choices
- `system/` — EMA's live state, decisions, patterns, digests

### 19.16 Updated OTP

```
Ema.SecondBrain.Supervisor (Supervisor)
  ├── VaultWatcher (GenServer, FileSystem)
  ├── GraphBuilder (GenServer)
  ├── Indexer (GenServer, FTS5)
  ├── Ingester (GenServer)
  ├── SystemBrain (GenServer, PubSub subscriber → maintains system/ space)
  ├── DigestGenerator (GenServer, daily cron → generates system/history/digests/)
  └── Bootstrap (Task, one-shot)
```

### 19.17 Updated Interconnections Map

```
                        Responsibilities
                        (generate tasks on cadence)
                              │
                              ▼
Seeds ──► Proposals ──green──► Tasks ◄──── Brain Dump (→ Task)
  ▲          │                  │               │
  │          │ redirect         │               │ → Seed / → Note
  │          ▼                  ▼               ▼
  │       3 new seeds      Project ◄──── Proposal Seeds
  │                           │
  │                           ▼
  │                      Context Doc (is a vault note)
  │                           │
  │                           ▼
  │                    ┌─────────────────┐
  │                    │  SECOND BRAIN   │
  │                    │                 │
  │                    │  research/      │◄── URL ingestion, clippings
  │                    │  projects/      │◄── auto: specs, plans, sessions
  │                    │  user-prefs/    │◄── manual: how you work
  │                    │  system/        │◄── auto: live state, decisions, patterns
  │                    │                 │
  │                    │  [[graph]]      │──► everything links to everything
  │                    └────────┬────────┘
  │                             │
  │                             ▼
  │                    ContextManager reads vault
  │                    to enrich ALL Claude calls
  │                             │
  └── Harvesters ◄──────────────┘
        │                       ▲
        ├── GitHarvester        │
        ├── SessionHarvester ◄──┤ Claude Sessions (auto-create vault notes)
        ├── VaultHarvester ◄────┘ (watches vault for orphans, gaps, patterns)
        ├── UsageHarvester
        └── BrainDumpHarvester
```

**The vault is the connective tissue.** Everything writes to it. Everything reads from it. The graph makes implicit connections explicit. The proposal engine doesn't just query a database — it navigates a knowledge graph.

---

## 20. Pipes — Visual Workflow Automation

### 20.1 What Pipes Is

Pipes is EMA's visual automation system. It lets you wire triggers to actions across all apps using a node-based canvas editor. Crucially, **every stock behavior in EMA is already a pipe** — the proposal pipeline, responsibility→task generation, session harvesting, brain dump routing — all of them are default pipes that you can inspect, modify, disable, or extend.

Pipes execute on the **Elixir daemon**, not in the browser. The frontend is a visual editor for defining and monitoring them. The daemon's PubSub system is the execution bus.

### 20.2 Ported From place.org

The visual editor (canvas, nodes, wires, side panel) is ported from place.org's pipes app with these differences:

| place.org | EMA |
|-----------|-----|
| Client-side event bus (JS) | Elixir PubSub (daemon-side) |
| localStorage persistence | SQLite via Ecto |
| Browser-only execution | Daemon execution (survives app close) |
| Simple trigger→action | Multi-step pipelines with conditions, transforms, delays |
| No defaults | All stock behaviors are modifiable default pipes |

### 20.3 Core Concepts

**Trigger:** An event emitted by any EMA subsystem. Declared by contexts.

**Action:** A callable operation on any EMA subsystem. Declared by contexts.

**Transform:** An intermediate node that modifies data flowing through the pipe. Can be a simple mapping, a filter condition, or a Claude CLI call for intelligent transformation.

**Pipe:** A saved workflow: one or more triggers → optional transforms → one or more actions. Has a name, active/inactive state, and belongs to a project (or global).

### 20.4 Trigger & Action Registry

Every Elixir context registers its triggers and actions. This is the EMA equivalent of place.org's `app-registry.ts` triggers/actions, but server-side:

```elixir
defmodule Ema.Pipes.Registry do
  @moduledoc "Central registry of all triggers and actions across EMA contexts"

  defmodule Trigger do
    defstruct [:id, :context, :event_type, :label, :schema, :description]
  end

  defmodule Action do
    defstruct [:id, :context, :action_id, :label, :schema, :description, :execute]
  end

  defmodule Transform do
    defstruct [:id, :label, :type, :config]
    # types: :filter, :map, :delay, :claude, :conditional
  end

  # All registered triggers and actions
  def triggers, do: ...
  def actions, do: ...
  def transforms, do: ...
end
```

### 20.5 Stock Triggers (all EMA events)

Every significant event in EMA is a trigger:

**Brain Dump:**
- `brain_dump:item_created` — new capture added
- `brain_dump:item_processed` — item routed (→Task, →Seed, →Note, →Journal)
- `brain_dump:item_archived` — item archived

**Proposals:**
- `proposals:seed_fired` — a seed was triggered (cron or manual)
- `proposals:generated` — raw proposal created by generator
- `proposals:refined` — proposal passed through refiner
- `proposals:debated` — proposal passed through debater
- `proposals:queued` — proposal arrived in queue
- `proposals:approved` — user green-lit a proposal
- `proposals:redirected` — user yellow-lit (redirected) a proposal
- `proposals:killed` — user red-lit a proposal
- `proposals:cross_pollinated` — combiner created a synthesis

**Projects:**
- `projects:created` — new project
- `projects:status_changed` — lifecycle transition
- `projects:context_rebuilt` — context doc regenerated

**Tasks:**
- `tasks:created` — new task (from any source)
- `tasks:status_changed` — status transition (todo→in_progress, etc.)
- `tasks:completed` — task done
- `tasks:blocked` — task became blocked
- `tasks:decomposed` — task broken into subtasks

**Responsibilities:**
- `responsibilities:task_generated` — recurring task auto-created
- `responsibilities:health_changed` — health score crossed threshold
- `responsibilities:check_in` — manual check-in recorded

**Claude Sessions:**
- `sessions:detected` — new session file found
- `sessions:active` — live Claude process detected
- `sessions:completed` — session ended
- `sessions:linked` — session auto-linked to project
- `sessions:friction_detected` — harvester found friction signal

**Second Brain:**
- `vault:note_created` — new note
- `vault:note_updated` — note modified
- `vault:link_created` — new wikilink connection
- `vault:orphan_detected` — orphan note found
- `vault:digest_generated` — daily digest created

**Habits:**
- `habits:completed` — habit checked off
- `habits:streak_milestone` — streak hit 7/30/100
- `habits:missed` — habit missed for the day

**Journal:**
- `journal:entry_created` — new journal entry
- `journal:entry_updated` — entry edited

**System:**
- `system:daemon_started` — daemon boot
- `system:cron_tick` — configurable periodic tick
- `system:daily` — fires once per day (midnight)
- `system:weekly` — fires once per week (Sunday)

### 20.6 Stock Actions (all EMA operations)

**Brain Dump:**
- `brain_dump:create_item` — add a capture `{content, source, project_id?}`
- `brain_dump:process_item` — route an item `{id, action}`

**Proposals:**
- `proposals:create_seed` — create a new seed `{prompt, schedule?, project_id?}`
- `proposals:run_seed` — immediately run a seed `{seed_id}`
- `proposals:accelerate` — boost a seed (3x parallel) `{seed_id}`
- `proposals:approve` — green-light `{proposal_id}`
- `proposals:redirect` — yellow-light `{proposal_id, note}`
- `proposals:kill` — red-light `{proposal_id}`

**Projects:**
- `projects:create` — new project `{name, description?, linked_path?}`
- `projects:transition` — change status `{project_id, status}`
- `projects:rebuild_context` — force context rebuild `{project_id}`

**Tasks:**
- `tasks:create` — new task `{title, project_id, priority?, source_type?, source_id?}`
- `tasks:transition` — change status `{task_id, status}`
- `tasks:decompose` — auto-decompose via Claude `{task_id}`
- `tasks:add_comment` — add comment `{task_id, body, source}`

**Responsibilities:**
- `responsibilities:create` — new responsibility `{title, role, cadence}`
- `responsibilities:check_in` — record check-in `{responsibility_id, status, note?}`

**Claude:**
- `claude:run_prompt` — execute Claude CLI `{prompt, project_id?, model?}` → returns output
- `claude:start_session` — start tracked session `{prompt, project_id?}`

**Second Brain:**
- `vault:create_note` — create note `{title, content, space, tags?}`
- `vault:update_note` — update note `{path, content}`
- `vault:ingest` — ingest raw content `{url_or_content, space}`

**Notifications:**
- `notify:desktop` — send desktop notification `{title, body}`
- `notify:log` — write to system log `{message, level}`

### 20.7 Default Pipes — Stock Behaviors as Editable Workflows

Every built-in behavior is a pipe that ships pre-configured. Users can see exactly what's happening, disable individual pipes, modify them, or create alternatives.

```elixir
# These are the default pipes created on first boot
# Each one represents a stock EMA behavior

# --- Proposal Pipeline ---
%Pipe{
  name: "Proposal Pipeline: Generate",
  system: true,    # marks as stock pipe (can be modified but not deleted)
  trigger: "proposals:seed_fired",
  actions: [
    %{action: "claude:run_prompt", config: %{stage: "generator"}},
  ],
  active: true
}

%Pipe{
  name: "Proposal Pipeline: Refine",
  system: true,
  trigger: "proposals:generated",
  actions: [
    %{action: "claude:run_prompt", config: %{stage: "refiner"}},
  ],
  active: true
}

%Pipe{
  name: "Proposal Pipeline: Debate",
  system: true,
  trigger: "proposals:refined",
  actions: [
    %{action: "claude:run_prompt", config: %{stage: "debater"}},
  ],
  active: true
}

%Pipe{
  name: "Proposal Pipeline: Tag & Queue",
  system: true,
  trigger: "proposals:debated",
  actions: [
    %{action: "claude:run_prompt", config: %{stage: "tagger"}},
    %{action: "proposals:enqueue"},
  ],
  active: true
}

# --- Approval Consequences ---
%Pipe{
  name: "Approved Proposal → Task",
  system: true,
  trigger: "proposals:approved",
  actions: [
    %{action: "tasks:create", config: %{from_proposal: true}},
    %{action: "vault:create_note", config: %{space: "projects", type: "spec"}},
  ],
  active: true
}

%Pipe{
  name: "Approved Proposal → Dependency Seeds",
  system: true,
  trigger: "proposals:approved",
  actions: [
    %{action: "proposals:create_seed", config: %{type: "dependency"}},
  ],
  active: true
}

# --- Redirect Consequences ---
%Pipe{
  name: "Redirected Proposal → 3 Forks",
  system: true,
  trigger: "proposals:redirected",
  actions: [
    %{action: "proposals:create_seed", config: %{count: 3, divergent: true}},
  ],
  active: true
}

# --- Kill Consequences ---
%Pipe{
  name: "Killed Proposal → Learn Pattern",
  system: true,
  trigger: "proposals:killed",
  actions: [
    %{action: "proposals:record_kill_pattern"},
  ],
  active: true
}

# --- Cross-Pollination ---
%Pipe{
  name: "Hourly Cross-Pollination Scan",
  system: true,
  trigger: "system:cron_tick",
  transforms: [%{type: :filter, config: %{interval: "hourly"}}],
  actions: [
    %{action: "proposals:run_combiner"},
  ],
  active: true
}

# --- Responsibility → Tasks ---
%Pipe{
  name: "Responsibility Task Generation",
  system: true,
  trigger: "system:daily",
  actions: [
    %{action: "responsibilities:generate_due_tasks"},
  ],
  active: true
}

%Pipe{
  name: "Responsibility Health Recalculation",
  system: true,
  trigger: "tasks:completed",
  actions: [
    %{action: "responsibilities:recalculate_health"},
  ],
  active: true
}

# --- Session Import ---
%Pipe{
  name: "Auto-Import Claude Sessions",
  system: true,
  trigger: "sessions:detected",
  actions: [
    %{action: "sessions:parse"},
    %{action: "sessions:link_project"},
    %{action: "vault:create_note", config: %{space: "projects", type: "session"}},
  ],
  active: true
}

%Pipe{
  name: "Session Friction → Proposal Seed",
  system: true,
  trigger: "sessions:friction_detected",
  actions: [
    %{action: "proposals:create_seed", config: %{type: "session_friction"}},
  ],
  active: true
}

# --- Second Brain Auto-Sync ---
%Pipe{
  name: "System State → Vault Sync",
  system: true,
  trigger: "system:cron_tick",
  transforms: [%{type: :filter, config: %{interval: "5min"}}],
  actions: [
    %{action: "vault:sync_system_brain"},
  ],
  active: true
}

%Pipe{
  name: "Daily Digest Generation",
  system: true,
  trigger: "system:daily",
  actions: [
    %{action: "vault:generate_digest"},
  ],
  active: true
}

# --- Brain Dump Defaults ---
%Pipe{
  name: "Brain Dump → Harvest Patterns",
  system: true,
  trigger: "brain_dump:item_created",
  transforms: [%{type: :filter, config: %{accumulate: 5}}],  # after 5 items
  actions: [
    %{action: "proposals:create_seed", config: %{type: "brain_dump_cluster"}},
  ],
  active: true
}

# --- Habits ---
%Pipe{
  name: "Habit Streak Celebration",
  system: true,
  trigger: "habits:streak_milestone",
  actions: [
    %{action: "notify:desktop", config: %{template: "streak"}},
    %{action: "vault:create_note", config: %{space: "system", type: "milestone"}},
  ],
  active: true
}

# --- Project Lifecycle ---
%Pipe{
  name: "Project Context Auto-Rebuild",
  system: true,
  trigger: "tasks:status_changed",
  transforms: [%{type: :delay, config: %{ms: 5000}}],  # debounce 5s
  actions: [
    %{action: "projects:rebuild_context"},
  ],
  active: true
}

%Pipe{
  name: "New Project → Bootstrap Vault Space",
  system: true,
  trigger: "projects:created",
  actions: [
    %{action: "vault:create_project_space"},
  ],
  active: true
}
```

**Why this matters:** You can literally open the Pipes app and see "Proposal Pipeline: Refine" as a pipe. Don't want the refiner? Toggle it off. Want to add a notification when proposals are queued? Add a wire from `proposals:queued` to `notify:desktop`. Want to change the debater to use opus instead of sonnet? Edit the pipe's config. The entire system is transparent and modifiable.

### 20.8 Elixir Schema

```elixir
defmodule Ema.Pipes.Pipe do
  schema "pipes" do
    field :name, :string
    field :system, :boolean, default: false   # stock pipe (modifiable but not deletable)
    field :active, :boolean, default: true
    field :trigger_pattern, :string           # e.g., "proposals:approved"
    field :description, :string
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project  # nil = global

    has_many :pipe_actions, Ema.Pipes.PipeAction
    has_many :pipe_transforms, Ema.Pipes.PipeTransform

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.Pipes.PipeAction do
  schema "pipe_actions" do
    field :action_id, :string                # e.g., "tasks:create"
    field :config, :map, default: %{}        # action-specific configuration
    field :sort_order, :integer

    belongs_to :pipe, Ema.Pipes.Pipe

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.Pipes.PipeTransform do
  schema "pipe_transforms" do
    field :transform_type, :string           # filter | map | delay | claude | conditional
    field :config, :map, default: %{}
    field :sort_order, :integer

    belongs_to :pipe, Ema.Pipes.Pipe

    timestamps(type: :utc_datetime)
  end
end
```

### 20.9 OTP — Pipe Executor

```
Ema.Pipes.Supervisor (Supervisor)
  ├── Ema.Pipes.Registry (GenServer)
  │     └── maintains trigger/action/transform catalog from all contexts
  ├── Ema.Pipes.Executor (GenServer)
  │     └── subscribes to PubSub for all active pipe trigger patterns
  │     └── on event: finds matching pipes, executes transforms → actions
  │     └── handles error isolation (one pipe failing doesn't kill others)
  ├── Ema.Pipes.Loader (GenServer)
  │     └── loads pipes from DB on boot, seeds defaults on first run
  │     └── watches for pipe changes (create/update/toggle) and reconfigures Executor
  └── Ema.Pipes.Monitor (GenServer)
        └── tracks execution history: which pipes fired, when, success/failure
        └── exposes via channel for UI monitoring
```

**Execution flow:**
1. PubSub event arrives (e.g., `{:proposals, :approved, payload}`)
2. Executor pattern-matches against all active pipes
3. For each matching pipe: run transforms in order (filter? pass/drop. delay? schedule. claude? call CLI.)
4. If transforms pass, execute actions in order
5. Log execution to pipe_runs table
6. Broadcast execution status via `pipes:monitor` channel

### 20.10 Transform Types

**Filter:** `%{type: :filter, config: %{field: "priority", op: "gte", value: 2}}` — only pass events where payload matches condition.

**Map:** `%{type: :map, config: %{rename: %{"content" => "title"}, add: %{"source" => "pipe"}}}` — reshape payload before passing to actions.

**Delay:** `%{type: :delay, config: %{ms: 5000}}` — debounce. Accumulates events, fires once after quiet period.

**Conditional:** `%{type: :conditional, config: %{if: "payload.scope in ['l', 'xl']", then: "continue", else: "skip"}}` — branch logic.

**Claude:** `%{type: :claude, config: %{prompt: "Summarize this: {{payload}}", model: "haiku"}}` — run Claude CLI as a transform, output becomes new payload.

### 20.11 Frontend — Pipes App

Ported from place.org with enhancements:

**Layout:** Same structure — SidePanel (triggers/actions/transforms catalog) + Canvas (node editor) + TopBar (pipe name + saved pipes) + BottomBar (save/clear).

**Enhancements over place.org:**

1. **Transform nodes** — a third node type between triggers and actions. Drag from transforms section in side panel. Visual: rounded rectangle with dashed border.

2. **System pipes tab** — view all stock default pipes. Each shows as a read-only mini-canvas diagram. Click "Edit" to fork into an editable copy (original stays as reference). Toggle to disable without editing.

3. **Execution monitor** — live feed of pipe executions. Each entry shows: pipe name, trigger event, transforms applied, actions executed, success/failure, timestamp. Click to expand and see full payload at each stage.

4. **Multi-step wiring** — trigger → transform → transform → action chains. Wires can go trigger→transform, transform→transform, transform→action (not just trigger→action).

5. **Config panels** — click a node to open an inline config panel. For actions: shows the action's schema fields as a form. For transforms: shows type-specific config. For claude transforms: shows a prompt editor.

6. **Pipe templates** — pre-built templates for common patterns: "On X notify me", "When proposal approved do Y", "Every N hours run Z". One-click create from template.

7. **Project scoping** — pipes can be scoped to a project. Project-scoped pipes only fire for events within that project's context.

### 20.12 Phoenix Channel

```elixir
channel "pipes:editor", EmaWeb.PipesEditorChannel   # canvas state sync
channel "pipes:monitor", EmaWeb.PipesMonitorChannel  # live execution feed
```

### 20.13 REST API

```elixir
# Pipes
resources "/pipes", PipeController, except: [:new, :edit]
post "/pipes/:id/toggle", PipeController, :toggle
get "/pipes/system", PipeController, :system_pipes     # list stock defaults
post "/pipes/:id/fork", PipeController, :fork           # fork system pipe for editing
get "/pipes/catalog", PipeController, :catalog           # all registered triggers/actions/transforms
get "/pipes/history", PipeController, :execution_history
get "/pipes/templates", PipeController, :templates
```

### 20.14 Migrations

New tables:
- `pipes` — pipe definitions
- `pipe_actions` — ordered actions per pipe
- `pipe_transforms` — ordered transforms per pipe
- `pipe_runs` — execution history log

### 20.15 How This Changes the Architecture

With pipes as the execution layer, the dedicated OTP workers for specific behaviors become simpler. The `ResponsibilityScheduler` doesn't need custom logic for "generate tasks on cadence" — that's a pipe. The `SessionHarvester` doesn't need custom logic for "friction → seed" — that's a pipe. The proposal pipeline stages don't need hardcoded sequencing — each stage transition is a pipe.

The OTP tree simplifies:
- **Contexts** own data and declare triggers/actions
- **Pipes.Executor** owns all workflow logic
- **Harvesters** still exist as event sources (they watch filesystems, processes, etc.) but their *responses* to what they find are pipes, not hardcoded

This means:
1. You can see every automation in one place (the Pipes app)
2. You can disable any behavior without touching code
3. You can create new behaviors without writing Elixir — just wire triggers to actions
4. The system is self-documenting: the pipes *are* the documentation of what EMA does

---

## 21. Agents — Conversational AI Management

### 21.1 What Agents Is

Agents is EMA's system for creating, configuring, and deploying conversational AI agents. Each agent has a personality, a script (system prompt + tools), and can be bound to one or more channels (Discord, Telegram, webchat, or internal EMA chat). Agents are managed through a dedicated app and execute via the Elixir daemon's supervision tree.

This replaces and expands the scaffolded `Ema.Agents` context. The existing `agent_templates` and `agent_runs` schemas become part of a richer system.

### 21.2 Agent Anatomy

An agent is:
- **Identity:** name, avatar, description, personality summary
- **Script:** the system prompt that defines behavior, tone, knowledge boundaries, and goals. Markdown, editable in-app. Can reference vault notes for dynamic context injection.
- **Model:** which Claude model to use (opus, sonnet, haiku) + temperature + max tokens
- **Tools:** which EMA actions the agent can invoke (from the Pipes registry). An agent might be able to create tasks, write vault notes, create brain dump items, etc.
- **Channels:** where this agent is reachable — Discord bot, Telegram bot, EMA's built-in webchat, or API endpoint
- **Project scope:** optional — agent operates within a project's context (gets project context.md injected)
- **Memory:** per-agent conversation history, stored in the vault under `system/agents/<slug>/`

### 21.3 Agent Scripts

Scripts are structured system prompts with sections:

```markdown
---
agent: research-assistant
model: sonnet
temperature: 0.7
max_tokens: 4096
tools:
  - vault:create_note
  - vault:search
  - brain_dump:create_item
  - proposals:create_seed
context:
  - vault://user-preferences/workflows.md
  - vault://projects/ema/_index.md
---

# Research Assistant

You are a research assistant for Trajan's projects. Your job is to:
- Find and summarize information when asked
- Create vault notes with research findings
- Suggest proposal seeds when you discover relevant opportunities
- Route interesting findings to the brain dump

## Personality
Direct, concise, no fluff. Present findings with sources.
Proactively flag connections to existing projects.

## Boundaries
- Never modify existing vault notes, only create new ones
- Always tag research notes with source URLs
- Ask for clarification rather than guessing intent
```

Scripts are stored as vault notes under `system/agents/<slug>/script.md` — which means they're graph-connected, searchable, and versionable.

### 21.4 Channels

Each channel binding connects an agent to an external messaging surface:

**Discord:**
- Agent binds to a Discord bot token + guild + channel(s)
- The daemon runs a Discord gateway connection via a GenServer
- Messages in bound channels are forwarded to the agent
- Agent responses are sent back to Discord
- Supports slash commands mapped to agent tools

**Telegram:**
- Agent binds to a Telegram bot token
- Daemon runs Telegram long-polling or webhook receiver
- Messages forwarded to agent, responses sent back
- Supports inline keyboards for structured responses

**EMA Webchat (built-in):**
- A chat interface inside EMA itself
- No external dependencies
- Direct message bus to agent GenServer
- Shows agent status, typing indicators, tool usage in real-time

**API Endpoint:**
- Each agent gets a REST endpoint: `POST /api/agents/:slug/chat`
- Request: `{message, conversation_id?}`
- Response: `{reply, tool_calls[], conversation_id}`
- For programmatic integration with other tools

### 21.5 Agent Conversations

Every agent maintains conversation history:

```elixir
defmodule Ema.Agents.Conversation do
  schema "agent_conversations" do
    field :channel_type, :string          # discord | telegram | webchat | api
    field :channel_id, :string            # discord channel ID, telegram chat ID, etc.
    field :external_user_id, :string      # who's talking to the agent
    field :status, :string, default: "active"  # active | archived
    field :metadata, :map, default: %{}

    belongs_to :agent, Ema.Agents.Agent

    has_many :messages, Ema.Agents.Message

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.Agents.Message do
  schema "agent_messages" do
    field :role, :string                  # user | assistant | system | tool
    field :content, :string
    field :tool_calls, {:array, :map}     # [{tool, input, output}]
    field :token_count, :integer
    field :metadata, :map, default: %{}

    belongs_to :conversation, Ema.Agents.Conversation

    timestamps(type: :utc_datetime)
  end
end
```

### 21.6 Elixir Schemas (replacing existing scaffolds)

```elixir
defmodule Ema.Agents.Agent do
  schema "agents" do
    field :slug, :string
    field :name, :string
    field :description, :string
    field :avatar, :string               # path to avatar image or emoji
    field :status, :string, default: "inactive"  # inactive | active | error
    field :model, :string, default: "sonnet"
    field :temperature, :float, default: 0.7
    field :max_tokens, :integer, default: 4096
    field :script_path, :string          # vault path to script.md
    field :tools, {:array, :string}      # list of action IDs from Pipes registry
    field :settings, :map, default: %{}

    belongs_to :project, Ema.Projects.Project  # nil = global

    has_many :channels, Ema.Agents.Channel
    has_many :conversations, Ema.Agents.Conversation
    has_many :runs, Ema.Agents.Run        # keeps existing run tracking

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.Agents.Channel do
  schema "agent_channels" do
    field :channel_type, :string          # discord | telegram | webchat | api
    field :active, :boolean, default: true
    field :config, :map, default: %{}     # type-specific: bot_token, guild_id, channel_ids, etc.
    field :status, :string, default: "disconnected"  # connected | disconnected | error
    field :last_connected_at, :utc_datetime
    field :error_message, :string

    belongs_to :agent, Ema.Agents.Agent

    timestamps(type: :utc_datetime)
  end
end
```

### 21.7 OTP Architecture

```
Ema.Agents.Supervisor (DynamicSupervisor)
  └── per active agent:
      AgentSupervisor (Supervisor, one_for_one)
        ├── AgentWorker (GenServer)
        │     └── holds agent state, script, conversation context
        │     └── routes incoming messages to Claude CLI
        │     └── executes tool calls against Pipes action registry
        │     └── maintains conversation history
        ├── ChannelSupervisor (DynamicSupervisor)
        │     ├── DiscordChannel (GenServer, Discord gateway WS)
        │     ├── TelegramChannel (GenServer, polling/webhook)
        │     └── WebchatChannel (GenServer, Phoenix channel bridge)
        └── AgentMemory (GenServer)
              └── manages agent's vault notes (conversation summaries, learnings)
              └── periodically summarizes long conversations to manage context
```

Each agent gets its own supervision subtree. If a Discord connection drops, only that channel restarts — the agent and its other channels stay alive.

**Message flow:**
1. Channel receives message (Discord WS, Telegram poll, webchat Phoenix channel, API request)
2. Channel GenServer forwards to AgentWorker: `{:message, conversation_id, content, metadata}`
3. AgentWorker builds prompt: script + conversation history + project context (if scoped) + vault context references
4. AgentWorker calls Claude CLI: `claude --print -p "<full_prompt>" --model <model>`
5. Parse response. If tool calls: execute against Pipes action registry, append results, re-call Claude.
6. Send response back through the originating channel
7. Store message + response in conversation history
8. If conversation gets long: AgentMemory summarizes older messages to compress context

### 21.8 Agent Tool Execution

Agents can invoke any action from the Pipes registry. This is the same action catalog that Pipes uses — `tasks:create`, `vault:create_note`, `brain_dump:create_item`, `proposals:create_seed`, etc.

The tool interface presented to Claude:

```json
{
  "tools": [
    {
      "name": "create_task",
      "description": "Create a new task in a project",
      "input_schema": {
        "type": "object",
        "properties": {
          "title": {"type": "string"},
          "project_id": {"type": "string"},
          "priority": {"type": "integer", "minimum": 1, "maximum": 5}
        },
        "required": ["title"]
      }
    },
    {
      "name": "search_vault",
      "description": "Search the Second Brain knowledge vault",
      "input_schema": {
        "type": "object",
        "properties": {
          "query": {"type": "string"},
          "space": {"type": "string", "enum": ["research-ingestion", "projects", "user-preferences", "system"]}
        },
        "required": ["query"]
      }
    }
  ]
}
```

### 21.9 Pipe Integration

Agents emit triggers and expose actions:

**Triggers:**
- `agents:message_received` — incoming message to any agent
- `agents:response_sent` — agent sent a reply
- `agents:tool_executed` — agent used a tool
- `agents:error` — agent failed to respond
- `agents:channel_connected` — channel came online
- `agents:channel_disconnected` — channel went offline

**Actions:**
- `agents:send_message` — send a message as an agent `{agent_slug, channel_type, channel_id, content}`
- `agents:create_agent` — create new agent `{name, script, model}`
- `agents:toggle_channel` — enable/disable a channel binding

This means you can create pipes like:
- "When a proposal is approved, have research-bot post a summary to Discord"
- "When a brain dump item mentions 'bug', have engineering-bot create a task"
- "Every morning, have daily-bot post today's responsibilities to Telegram"

### 21.10 Frontend — Agents App

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  ░░ Ambient Strip ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
├───────────┬─────────────────────────────────────────────────┤
│           │  [Agents] [Conversations] [Scripts]  [+ New]    │
│  Sidebar  │                                                 │
│           │  ┌─ Agent Grid ───────────────────────────┐    │
│           │  │                                         │    │
│           │  │  ┌─ Agent Card ──────┐ ┌─ Agent Card ─┐│    │
│           │  │  │ 🤖 Research Bot   │ │ 🛠 Eng Bot   ││    │
│           │  │  │ sonnet │ active   │ │ opus │ active ││    │
│           │  │  │ ● Discord ● Web   │ │ ● Webchat    ││    │
│           │  │  │ 47 conversations  │ │ 12 convos    ││    │
│           │  │  └───────────────────┘ └──────────────┘│    │
│           │  │                                         │    │
│           │  └─────────────────────────────────────────┘    │
│           │                                                 │
│           │  ┌─ Agent Detail (click into) ─────────────┐   │
│           │  │  Header: name, status, model, channels   │   │
│           │  │  Tabs:                                    │   │
│           │  │  [Chat] [Script] [Channels] [History]     │   │
│           │  │  [Tools] [Settings]                       │   │
│           │  └──────────────────────────────────────────┘   │
├───────────┴─────────────────────────────────────────────────┤
│  ░░ Command Bar ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────────────────────────────┘
```

**Agent Detail Tabs:**

**Chat:** Built-in webchat to this agent. Message input, conversation history, tool call visualization (shows what the agent did and why). Switch between conversations.

**Script:** Full markdown editor for the agent's script. Live preview. Vault note path shown. Syntax highlighting for the YAML frontmatter (model, tools, context references). "Test" button to send a test message with current script.

**Channels:** List of channel bindings with status indicators (connected/disconnected/error). Add channel dialog: select type → fill config (bot token, guild ID, etc.) → test connection → save. Per-channel toggle and error log.

**History:** Searchable conversation archive. Filter by channel, date range, whether tools were used. Click to expand full conversation.

**Tools:** Checkboxes of all available Pipes actions. Check = agent can use this tool. Shows the tool's schema and description. Drag to reorder (affects tool presentation order to Claude).

**Settings:** Model selection, temperature slider, max tokens, project scope, memory settings (auto-summarize after N messages, context window budget).

### 21.11 Phoenix Channels

```elixir
channel "agents:lobby", EmaWeb.AgentLobbyChannel       # agent list + status updates
channel "agents:chat:*", EmaWeb.AgentChatChannel         # webchat per agent
channel "agents:monitor:*", EmaWeb.AgentMonitorChannel   # per-agent activity feed
```

### 21.12 REST API

```elixir
# Agents
resources "/agents", AgentController, except: [:new, :edit]
post "/agents/:slug/chat", AgentController, :chat        # API chat endpoint
get "/agents/:slug/conversations", AgentController, :conversations
get "/agents/:slug/conversations/:id", AgentController, :conversation_detail
post "/agents/:slug/channels", AgentChannelController, :create
put "/agents/:slug/channels/:id", AgentChannelController, :update
delete "/agents/:slug/channels/:id", AgentChannelController, :delete
post "/agents/:slug/channels/:id/test", AgentChannelController, :test_connection
```

### 21.13 Migrations

New tables:
- `agents` — replaces existing `agent_templates` with richer schema
- `agent_channels` — channel bindings per agent
- `agent_conversations` — conversation sessions
- `agent_messages` — message history

Existing `agent_runs` table gets `agent_id` FK added (replacing `template_id`).

---

## 22. Canvas — Visual Workspace with Charting

### 22.1 What Canvas Is

Canvas is EMA's freeform visual workspace. It combines a drawing canvas (ported from place.org) with data visualization — charts, graphs, diagrams, and dashboards that can pull live data from EMA's systems.

Two modes: **Freeform** (draw, write, arrange) and **Data** (charts, graphs, live widgets).

### 22.2 Ported from place.org

The base canvas from place.org gives us:
- Element types: rectangle, ellipse, line, arrow, text, freehand, sticky, image, group
- Tools: select, draw shapes, text, freehand, eraser, hand (pan)
- Properties panel: fill, stroke, opacity, font, corner radius
- Viewport: pan, zoom, grid, snap-to-grid
- Undo/redo history
- PNG export

### 22.3 New: Data Visualization Elements

EMA extends the canvas with data-aware element types:

**Chart elements:**
- `bar_chart` — bar/column chart
- `line_chart` — line/area chart
- `pie_chart` — pie/donut chart
- `sparkline` — compact inline chart
- `scatter` — scatter plot
- `heatmap` — calendar heatmap (like GitHub contributions)
- `gauge` — radial gauge/meter
- `number_card` — big number with label and trend indicator

**Data sources** (each chart element binds to a source):
- `tasks:by_status` — task counts grouped by status
- `tasks:by_project` — task counts per project
- `tasks:completed_over_time` — completion trend
- `proposals:by_confidence` — proposal distribution
- `proposals:approval_rate` — approval/kill/redirect rates over time
- `proposals:pipeline_throughput` — proposals through each stage per day
- `habits:completion_rate` — habit completion over time
- `habits:streaks` — current streak lengths
- `responsibilities:health` — health scores across responsibilities
- `sessions:token_usage` — Claude token consumption over time
- `sessions:by_project` — session counts per project
- `vault:notes_by_space` — note distribution across spaces
- `vault:link_density` — graph connectivity metrics
- `engine:throughput` — proposal engine pipeline metrics
- `pipes:execution_count` — pipe execution frequency
- `agents:message_volume` — agent conversation volume
- `custom:query` — custom SQL query against EMA's SQLite DB

**Graph/diagram elements:**
- `dependency_graph` — DAG of task dependencies (auto-layout)
- `project_map` — visual map of projects and their relationships
- `proposal_tree` — proposal evolution/lineage tree
- `vault_graph` — subgraph of Second Brain connections (mini version of the full graph view)
- `pipe_flow` — visual representation of a pipe's trigger→transform→action chain

### 22.4 Canvas Types

Users can create multiple canvases, each serving a different purpose:

- **Dashboard canvas:** live data widgets arranged as a personal command center. Could replace or supplement the built-in dashboard.
- **Planning canvas:** spatial arrangement of tasks, dependencies, notes — think visual project planning.
- **Research canvas:** arrange research notes, clippings, connections — spatial thinking aid.
- **Presentation canvas:** arrange content for presenting/sharing.
- **Monitoring canvas:** live charts for system health, agent activity, pipeline throughput.

### 22.5 Elixir Schema

```elixir
defmodule Ema.Canvas.Canvas do
  schema "canvases" do
    field :name, :string
    field :description, :string
    field :canvas_type, :string, default: "freeform"  # freeform | dashboard | planning | research | monitoring
    field :viewport, :map, default: %{x: 0, y: 0, zoom: 1}
    field :settings, :map, default: %{grid: true, snap: true}

    belongs_to :project, Ema.Projects.Project  # nil = global

    has_many :elements, Ema.Canvas.Element

    timestamps(type: :utc_datetime)
  end
end

defmodule Ema.Canvas.Element do
  schema "canvas_elements" do
    field :element_type, :string           # rectangle | ellipse | ... | bar_chart | line_chart | dependency_graph | ...
    field :x, :float
    field :y, :float
    field :width, :float
    field :height, :float
    field :rotation, :float, default: 0.0
    field :z_index, :integer
    field :locked, :boolean, default: false

    # Visual properties
    field :style, :map, default: %{}       # fill, stroke, strokeWidth, opacity, cornerRadius, fontSize, fontFamily

    # Content (type-dependent)
    field :text, :string                   # for text/sticky elements
    field :points, {:array, :map}          # for line/freehand elements
    field :image_path, :string             # for image elements

    # Data binding (for chart/graph elements)
    field :data_source, :string            # e.g., "tasks:by_status", "custom:query"
    field :data_config, :map, default: %{} # source-specific: query, filters, project_id, time_range
    field :chart_config, :map, default: %{} # chart-specific: colors, labels, legend, axis config
    field :refresh_interval, :integer       # seconds, nil = manual refresh only

    # Grouping
    field :group_id, :string

    belongs_to :canvas, Ema.Canvas.Canvas

    timestamps(type: :utc_datetime)
  end
end
```

### 22.6 Data Pipeline

Chart elements need live data. The daemon provides this through a `DataSource` system:

```elixir
defmodule Ema.Canvas.DataSource do
  @doc "Resolve a data source identifier to actual data"
  def fetch(source_id, config \\ %{})

  def fetch("tasks:by_status", config) do
    project_id = Map.get(config, "project_id")
    Ema.Tasks.count_by_status(project_id)
    # Returns: %{"proposed" => 3, "todo" => 8, "in_progress" => 4, ...}
  end

  def fetch("proposals:approval_rate", config) do
    days = Map.get(config, "days", 30)
    Ema.Proposals.approval_rate_over_time(days)
    # Returns: [%{date: "2026-03-28", approved: 3, killed: 1, redirected: 2}, ...]
  end

  def fetch("habits:completion_rate", config) do
    days = Map.get(config, "days", 30)
    Ema.Habits.completion_rate_over_time(days)
  end

  def fetch("custom:query", config) do
    query = Map.get(config, "query", "")
    # Sanitized read-only SQL execution against EMA's SQLite
    Ema.Repo.query(query)
  end

  # ... all other sources
end
```

Chart elements with a `refresh_interval` auto-update via Phoenix channel pushes. The daemon runs a `DataRefresher` GenServer that polls data sources for subscribed canvas elements and pushes deltas.

### 22.7 OTP

```
Ema.Canvas.Supervisor (Supervisor)
  ├── Ema.Canvas.DataRefresher (GenServer)
  │     └── tracks which canvas elements need live data
  │     └── polls data sources on their refresh intervals
  │     └── pushes updates via PubSub → Phoenix channels
  └── Ema.Canvas.Renderer (GenServer)
        └── server-side PNG/SVG export for sharing
```

### 22.8 Frontend — Canvas App

**Toolbar extends place.org's with:**

```
[Select] [Rect] [Ellipse] [Line] [Arrow] [Text] [Freehand] [Sticky]
──── separator ────
[📊 Bar] [📈 Line] [🍩 Pie] [🔢 Number] [🔥 Heatmap] [⚡ Sparkline]
──── separator ────
[🔗 Dep Graph] [🌐 Vault Graph] [🌳 Proposal Tree]
──── separator ────
[Eraser] [Hand] [Grid] [Snap]
```

**Data element workflow:**
1. Select a chart tool (e.g., Bar Chart)
2. Draw the element area on canvas
3. Properties panel shows: **Data** tab alongside Style tab
4. Data tab: select source from dropdown, configure filters (project, time range), set refresh interval
5. Chart renders live inside the canvas element
6. Resize the element to resize the chart
7. Click to select, drag to move, properties panel to configure

**Chart rendering:** Client-side using a lightweight charting library (e.g., Chart.js via canvas 2D, or a custom SVG renderer). Data arrives via Phoenix channel, chart re-renders reactively.

**Graph/diagram elements:** Use force-directed layout (d3-force or similar). Auto-layout on data change. Interactive: click a node in a dependency graph to navigate to that task.

### 22.9 Pipe Integration

**Triggers:**
- `canvas:element_created` — new element added
- `canvas:data_refreshed` — chart data updated
- `canvas:exported` — canvas exported as image

**Actions:**
- `canvas:create_element` — programmatically add an element `{canvas_id, type, config}`
- `canvas:refresh_data` — force refresh all data elements on a canvas
- `canvas:export` — export canvas as PNG/SVG

Example pipe: "Every morning, refresh all dashboard canvases and export to vault as daily snapshot"

### 22.10 Phoenix Channel

```elixir
channel "canvas:*", EmaWeb.CanvasChannel
# canvas:<id> — element CRUD, viewport sync, data pushes
```

### 22.11 REST API

```elixir
# Canvases
resources "/canvases", CanvasController, except: [:new, :edit]
get "/canvases/:id/export", CanvasController, :export     # PNG/SVG export
get "/canvases/:id/data/:element_id", CanvasController, :element_data  # fetch data for chart element
post "/canvases/:id/data/:element_id/refresh", CanvasController, :refresh_data

# Data sources
get "/data-sources", DataSourceController, :index          # list all available sources
get "/data-sources/:id/preview", DataSourceController, :preview  # preview data for a source
```

### 22.12 Migrations

New tables:
- `canvases` — canvas definitions
- `canvas_elements` — elements with data binding support
