# Workspace & Executive Planes Design

**Date:** 2026-04-06
**Status:** Approved (brainstorm complete, pending implementation plan)

## Summary

Two differently-structured executive management systems (human + agent) operating on the same shared entity graph within a unified org/space/project hierarchy. Every space, project, and task is a work container with its own brain dumps, tags, per-actor data, and config. Agent workspaces use organic phase-based cadence (simulated weeks). CLI/TUI are extensible — agents can register their own commands and build out their own EM over time.

## Hierarchy

```
Organization (optional grouping — nullable)
└── Space (isolation boundary, owns schema partition)
    ├── Work Container: brain dumps, tags, entity_data, config
    ├── Actors[] (human + agents, each with own executive state)
    │   ├── Human: energy-aware scheduling, focus, priorities
    │   └── Agent(s): organic phase cadence, sprint backlog, velocity
    └── Projects[] (scoped to space)
        ├── Work Container: brain dumps, tags, entity_data, config
        └── Tasks[]
            └── Work Container: brain dumps, tags, entity_data, config
```

### Rules

- A **personal space** exists without an org (`org_id` is nullable).
- An **org** groups spaces. You can create an org, create org spaces, and export them (`portable` flag).
- A **project** lives in a space and carries its own scoped data.
- A **task** lives in a project and carries its own scoped data.
- **Actors** (human, agents) are registered per space and operate on all entities within it.
- Both actors have **full mutual visibility** — either can read/write the other's data.
- Both are **programmatically manipulable** via the same REST API and CLI.

## Schema Changes

### Modifications to Existing Tables

```sql
-- spaces: make org_id nullable for personal spaces
-- (current schema has org_id NOT NULL — must change)
ALTER TABLE spaces ALTER COLUMN org_id DROP NOT NULL;

-- spaces: add portability flag
ALTER TABLE spaces ADD COLUMN portable BOOLEAN DEFAULT false NOT NULL;

-- projects: scope to space
ALTER TABLE projects ADD COLUMN space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE;
CREATE INDEX idx_projects_space ON projects(space_id);

-- tasks: scope to space, track owning actor
ALTER TABLE tasks ADD COLUMN space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN actor_id TEXT DEFAULT 'human';
CREATE INDEX idx_tasks_space ON tasks(space_id);
CREATE INDEX idx_tasks_actor ON tasks(actor_id);

-- goals: scope to space
ALTER TABLE goals ADD COLUMN space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE;
CREATE INDEX idx_goals_space ON goals(space_id);

-- inbox_items (brain dumps): replace project_id with generic container scoping
ALTER TABLE inbox_items ADD COLUMN container_type TEXT; -- 'space' | 'project' | 'task'
ALTER TABLE inbox_items ADD COLUMN container_id TEXT;
-- actor_id already planned, add if not present:
ALTER TABLE inbox_items ADD COLUMN actor_id TEXT DEFAULT 'human';
CREATE INDEX idx_inbox_container ON inbox_items(container_type, container_id);
CREATE INDEX idx_inbox_actor ON inbox_items(actor_id);
-- Migration: UPDATE inbox_items SET container_type='project', container_id=project_id WHERE project_id IS NOT NULL;

-- executions: scope to space, track owning actor
ALTER TABLE executions ADD COLUMN space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE;
ALTER TABLE executions ADD COLUMN actor_id TEXT DEFAULT 'human';
CREATE INDEX idx_executions_space ON executions(space_id);
CREATE INDEX idx_executions_actor ON executions(actor_id);

-- proposals: scope to space
ALTER TABLE proposals ADD COLUMN space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE;
CREATE INDEX idx_proposals_space ON proposals(space_id);
```

### New Tables

```sql
-- Actors: human and agents registered per space
CREATE TABLE actors (
  id TEXT PRIMARY KEY,              -- 'human', 'agent:alpha', 'agent:researcher'
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,         -- 'human' | 'agent'
  name TEXT NOT NULL,
  config TEXT DEFAULT '{}',         -- JSON: scheduling rules, phase definitions, priority weights
  capabilities TEXT DEFAULT '[]',   -- JSON: what this actor can do
  status TEXT DEFAULT 'active',     -- 'active' | 'paused' | 'archived'
  inserted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(space_id, id)
);
CREATE INDEX idx_actors_space ON actors(space_id);
CREATE INDEX idx_actors_type ON actors(actor_type);

-- Universal tags: any actor can tag any entity at any level
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,        -- 'space' | 'project' | 'task' | 'execution' | 'proposal' | 'goal' | 'brain_dump'
  entity_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  actor_id TEXT NOT NULL,           -- who tagged it
  namespace TEXT DEFAULT 'default', -- grouping: 'priority' | 'domain' | 'phase' | 'status' | 'custom'
  inserted_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id, tag, actor_id)
);
CREATE INDEX idx_tags_entity ON tags(entity_type, entity_id);
CREATE INDEX idx_tags_actor ON tags(actor_id);
CREATE INDEX idx_tags_tag ON tags(tag);
CREATE INDEX idx_tags_namespace ON tags(namespace);

-- Per-entity actor data: each actor's metadata on any entity
CREATE TABLE entity_data (
  entity_type TEXT NOT NULL,        -- 'space' | 'project' | 'task' | 'execution' | 'goal'
  entity_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  key TEXT NOT NULL,                -- freeform: 'priority', 'phase', 'energy_cost', 'sprint_week', etc.
  value TEXT,                       -- JSON value
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id, actor_id, key)
);
CREATE INDEX idx_entity_data_actor ON entity_data(actor_id);
CREATE INDEX idx_entity_data_entity ON entity_data(entity_type, entity_id);

-- Phase transitions: append-only log per actor (velocity, retro, history)
CREATE TABLE phase_transitions (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  space_id TEXT REFERENCES spaces(id),
  project_id TEXT REFERENCES projects(id),  -- nullable: phase can be space-wide or project-scoped
  from_phase TEXT,
  to_phase TEXT NOT NULL,
  week_number INTEGER,
  reason TEXT,                      -- 'work_complete' | 'manual' | 'blocked' | 'retro_done'
  summary TEXT,                     -- what was accomplished in the phase
  metadata TEXT DEFAULT '{}',       -- JSON: metrics, token counts, entity refs
  transitioned_at TEXT NOT NULL
);
CREATE INDEX idx_phase_actor ON phase_transitions(actor_id);
CREATE INDEX idx_phase_space ON phase_transitions(space_id);
CREATE INDEX idx_phase_project ON phase_transitions(project_id);
CREATE INDEX idx_phase_time ON phase_transitions(transitioned_at);

-- Work container config: per-container settings (not actor-specific)
CREATE TABLE container_config (
  container_type TEXT NOT NULL,     -- 'space' | 'project' | 'task'
  container_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,                       -- JSON
  updated_at TEXT NOT NULL,
  PRIMARY KEY (container_type, container_id, key)
);

-- Actor commands: registered CLI/TUI extensions per actor
CREATE TABLE actor_commands (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,             -- 'sprint status', 'phase advance', 'velocity'
  description TEXT,
  handler TEXT NOT NULL,             -- API route or module reference
  args_schema TEXT DEFAULT '{}',    -- JSON schema for arguments
  inserted_at TEXT NOT NULL,
  UNIQUE(actor_id, command)
);
CREATE INDEX idx_actor_commands_actor ON actor_commands(actor_id);
```

## Executive Management Systems

### Human EM

Uses existing EMA subsystems, now scoped to space:

| Concern | Mechanism | Data |
|---------|-----------|------|
| Scheduling | TemporalRhythm (energy-aware, circadian) | `temporal_rhythms`, `temporal_energy_logs` |
| Focus | Focus sessions (Pomodoro-style) | `focus_sessions`, `focus_blocks` (add `space_id`) |
| Priorities | entity_data per task/project | `entity_data WHERE actor_id='human' AND key='priority'` |
| Inbox | Brain dumps + agent completion events | `inbox_items WHERE actor_id='human'` |
| Phases | Optional: `focus → review → plan → rest` | `phase_transitions WHERE actor_id='human'` |

Human EM is stable — changes rarely. Controlled via existing CLI commands with `--actor=human` default.

### Agent EM

Organic phase-based cadence on the same entities:

| Concern | Mechanism | Data |
|---------|-----------|------|
| Scheduling | Organic cadence (advances when work completes) | `phase_transitions`, `entity_data` |
| Phases | `plan → execute → review → retro` = 1 "week" | `phase_transitions WHERE actor_id='agent:...'` |
| Sprint backlog | Tasks assigned to current week | `entity_data WHERE key='sprint_week' AND value=current_week` |
| Velocity | Weeks completed, phase durations | `COUNT(phase_transitions) GROUP BY week_number` |
| Priorities | Dependency order + token estimation | `entity_data WHERE key IN ('dependency_order', 'estimated_tokens')` |
| Self-extension | Registers new commands, evolves config | `actor_commands`, `actors.config` |

Agent EM is expected to evolve. Agent modifies its own `actors.config`, registers commands via `actor_commands`, and writes new entity_data keys as it develops its management approach.

### Phase Cadence (Agent)

A "week" is one complete cycle through all phases. Not clock-driven — phases advance when the work is done.

```
Week 1:
  plan    → agent reviews backlog, picks tasks, estimates → advances on: backlog populated
  execute → agent dispatches executions, monitors progress → advances on: all executions complete
  review  → agent evaluates results, tags outcomes → advances on: review written
  retro   → agent logs velocity, lessons, updates config → advances on: retro entry saved

Week 2:
  plan    → ...
```

Phase transitions are recorded in `phase_transitions` with reason, summary, and metadata. This gives:
- `ema em velocity agent:alpha` — weeks/time, phase durations
- `ema em retro agent:alpha --week=3` — what happened, what was learned
- `ema em phases agent:alpha` — full transition log

### Mutual Visibility

Both actors query the same tables. No access barriers.

```bash
# Human checks agent state
ema em status agent:alpha
ema data get project:ema --actor=agent:alpha
ema tag list task:42                           # shows all actors' tags

# Agent checks human state
GET /api/entity-data?entity_type=project&entity_id=proj_ema&actor_id=human
GET /api/phase-transitions?actor_id=human

# Either actor can write to the other's data
ema data set task:42 --actor=agent:alpha sprint_week 4    # human reassigns agent's sprint
POST /api/entity-data {entity_type: "task", entity_id: "42", actor_id: "human", key: "priority", value: "1"}  # agent escalates human priority
```

## Work Containers

Every space, project, and task is a work container with:

| Feature | Table | Scoping |
|---------|-------|---------|
| Brain dumps | `inbox_items` | `container_type` + `container_id` |
| Tags | `tags` | `entity_type` + `entity_id` |
| Actor data | `entity_data` | `entity_type` + `entity_id` + `actor_id` |
| Config | `container_config` | `container_type` + `container_id` |

### Examples

```
Space: "Work" (sp_work)
├── brain_dump: "need to hire help"           (container_type='space', container_id='sp_work')
├── tag: "q2-priority"                        (entity_type='space', entity_id='sp_work')
├── entity_data: human.focus_goal = "ship v1" (entity_type='space', entity_id='sp_work', actor='human')
├── config: brain_dump_routing = {default: "proj_ema"}
│
├── Project: "EMA" (proj_ema)
│   ├── brain_dump: "refactor dispatch"       (container_type='project', container_id='proj_ema')
│   ├── entity_data: agent.current_phase = "execute"
│   ├── config: default_tags = ["elixir", "phoenix"], auto_assign_agent = "agent:alpha"
│   │
│   ├── Task: "Fix dispatch cascade" (task_42)
│   │   ├── brain_dump: "try batch cancel"    (container_type='task', container_id='task_42')
│   │   ├── entity_data: agent.sprint_week = 3, human.energy_cost = "high"
│   │   ├── tag: "critical" (human), "phase:execute" (agent)
│   │   └── config: acceptance_criteria = "no CPU spin, queue drains"
│   │
│   └── Task: "Add focus route" (task_43)
│       └── ...
│
└── Project: "ProSlync" (proj_proslync)
    └── ...
```

## Organization & Space Portability

### Personal Space (no org)

```bash
ema space create "Personal" --type=personal
# Creates: spaces row with org_id=NULL, space_type='personal'
# Auto-creates: actors row for 'human' in this space
```

### Org Space

```bash
ema org create "My Team" --slug=my-team
ema space create "Work" --org=my-team --type=team
# Creates: spaces row with org_id=<org_id>, space_type='team'
```

### Export / Send Out

```bash
ema space export work --portable
# Dumps: space + all projects/tasks/goals/brain_dumps/tags/entity_data/config/phase_transitions
# Output: work-space-2026-04-06.ema (SQLite file + manifest JSON)

# On another machine:
ema space import work-space-2026-04-06.ema
```

The `portable` flag on spaces marks them as designed for sharing. The export includes everything scoped to that space via `space_id` foreign keys.

## CLI

### Built-in Commands

```bash
# Executive management
ema em status                              # all actors, current phases
ema em status <actor_id>                   # one actor's state
ema em phases <actor_id>                   # phase transition log
ema em velocity <actor_id>                 # weeks completed, durations
ema em retro <actor_id> --week=N           # retro for a specific week
ema em advance <actor_id>                  # manually advance phase

# Work containers
ema dump "thought" --space=work            # dump to space container
ema dump "idea" --project=ema              # dump to project container
ema dump "finding" --task=task_42          # dump to task container
ema brain-dump list --project=ema          # list project brain dumps
ema brain-dump list --task=task_42         # list task brain dumps

# Tags
ema tag add task:42 "critical"             # tag as current actor (default: human)
ema tag add task:42 "phase:execute" --actor=agent:alpha
ema tag list task:42                       # all tags on entity
ema tag list --namespace=phase             # all phase tags

# Entity data
ema data get project:ema                   # all actors' data on project
ema data get task:42 --actor=human         # human's data on task
ema data set task:42 sprint_week 3 --actor=agent:alpha

# Container config
ema config set project:ema default_tags '["elixir"]'
ema config get task:42

# Spaces & orgs
ema space list
ema space create "Name" [--org=slug] [--type=personal|team|project]
ema space export <slug> --portable
ema space import <file>
ema org create "Name" --slug=slug
ema org list

# Actor management
ema actor list                             # all actors in current space
ema actor create agent:beta --type=agent --name="Beta Agent"
ema actor config agent:alpha               # show actor config
ema actor config agent:alpha --set phases '["plan","execute","review","retro"]'

# Universal --actor flag on existing commands
ema task list --actor=agent:alpha
ema brain-dump list --actor=human
ema execution list --actor=agent:alpha
```

### Agent-Registered Commands

Agents register commands via API. The CLI discovers them from `actor_commands`:

```bash
# Agent registers:
POST /api/actors/agent:alpha/commands
{
  "command": "sprint status",
  "description": "Show current sprint backlog and progress",
  "handler": "/api/executive/agent:alpha/sprint",
  "args_schema": {"week": {"type": "integer", "optional": true}}
}

# User or agent invokes:
ema agent:alpha sprint status
ema agent:alpha sprint status --week=3
```

## Implementation Notes

### Data Migration (Existing Records)

Existing projects, tasks, goals, executions, and proposals have no `space_id`. The migration should:

1. Create a default personal space: `INSERT INTO spaces (id, name, space_type) VALUES ('sp_default', 'Personal', 'personal')`
2. Create a default human actor: `INSERT INTO actors (id, space_id, actor_type, name) VALUES ('human', 'sp_default', 'human', 'Trajan')`
3. Backfill all existing records: `UPDATE projects SET space_id = 'sp_default' WHERE space_id IS NULL` (same for tasks, goals, executions, proposals)
4. Backfill brain dump containers: `UPDATE inbox_items SET container_type = 'project', container_id = project_id WHERE project_id IS NOT NULL`
5. Remaining unscoped brain dumps: `UPDATE inbox_items SET container_type = 'space', container_id = 'sp_default' WHERE container_type IS NULL`

### Ecto Migration Strategy

One migration file covering:
1. Alter `spaces.org_id` to nullable
2. Add `space_id` to projects, tasks, goals, executions, proposals
3. Add `actor_id` to tasks, inbox_items, executions
4. Add `container_type`/`container_id` to inbox_items
5. Create `actors`, `tags`, `entity_data`, `phase_transitions`, `container_config`, `actor_commands`

### Daemon Modules

New contexts:
- `Ema.Executive` — actor CRUD, phase advancement, velocity queries
- `Ema.Tags` — universal tag CRUD
- `Ema.EntityData` — per-actor entity metadata CRUD
- `Ema.ContainerConfig` — work container config CRUD

Modified contexts:
- `Ema.BrainDump` — add container_type/container_id scoping
- `Ema.Tasks` — add actor_id filtering
- `Ema.Executions` — add space_id, actor_id filtering
- `Ema.Spaces` — handle nullable org_id, portable export/import
- `Ema.Projects` — add space_id scoping

### CLI Changes

- Add `em` command group (executive management)
- Add `tag` command group
- Add `data` command group
- Add `config` command group (container config)
- Add `actor` command group
- Add `--actor` global flag
- Add `--space`, `--project`, `--task` container flags to `dump` and `brain-dump`
- Dynamic command discovery from `actor_commands` table

### GUI Changes

- Space selector (replaces/extends org switcher)
- Actor toggle: switch view between human/agent perspectives
- Work container panel: brain dumps + tags + entity_data + config per entity detail view
- Executive dashboard: side-by-side human/agent phase status, velocity charts
- Phase timeline visualization for agent sprints
