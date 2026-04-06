# Intent Actor Session Contract

Date: 2026-04-06

## Purpose

This document defines the canonical contract between semantic intent state, operational runtime state, and the agents or humans acting inside EMA.

This is the contract the following surfaces should share:

- canonical context modules
- REST controllers
- websocket channels
- native CLI
- MCP stdio server
- MCP HTTP bridge

The goal is to make EMA safe and legible for multiple actors, not just to add more intent features.

## Core Decision

EMA has four adjacent domains:

- semantic truth: intents and lineage
- runtime truth: executions and execution events
- participant truth: actors
- session truth: claude sessions, AI sessions, and execution agent sessions

The contract is:

- `intent` is the semantic unit of work or meaning
- `execution` is the canonical runtime unit for work happening against an intent
- `actor` is the canonical participant identity
- `session` is a runtime communication container, not semantic truth
- `intent_links` is the canonical bridge between semantic truth and the other domains

This means EMA should reason as:

`actor -> session -> execution -> intent`

not as:

`session == intent`

## Canonical Entities

### Intent

Canonical semantic record:

- source: [intents.ex](/home/trajan/Projects/ema/daemon/lib/ema/intents/intents.ex)
- schema: [intent.ex](/home/trajan/Projects/ema/daemon/lib/ema/intents/intent.ex)

Intent owns:

- title
- slug
- hierarchy
- semantic status
- semantic lineage
- semantic links to adjacent domains

Intent does not own:

- live process state
- terminal output
- raw agent transcripts
- ephemeral execution details

### Execution

Canonical runtime record:

- source: [executions.ex](/home/trajan/Projects/ema/daemon/lib/ema/executions/executions.ex)
- schema: [execution.ex](/home/trajan/Projects/ema/daemon/lib/ema/executions/execution.ex)

Execution owns:

- runtime mode
- runtime status
- proposal/task/session references
- result path
- actor assignment
- execution events

Execution is the main operational object that advances an intent through work.

### Actor

Canonical participant record:

- source: [actors.ex](/home/trajan/Projects/ema/daemon/lib/ema/actors/actors.ex)
- schema: [actor.ex](/home/trajan/Projects/ema/daemon/lib/ema/actors/actor.ex)

Actor owns:

- identity
- type
- capabilities
- phase
- active status

Actor answers who is acting, not what is being worked on.

### Sessions

EMA currently has multiple session records:

- detected Claude Code sessions: [claude_session.ex](/home/trajan/Projects/ema/daemon/lib/ema/claude_sessions/claude_session.ex)
- AI conversation sessions: [ai_session.ex](/home/trajan/Projects/ema/daemon/lib/ema/claude/ai_session.ex)
- execution-scoped agent sessions: [agent_session.ex](/home/trajan/Projects/ema/daemon/lib/ema/executions/agent_session.ex)
- orchestrator runtime surface: [orchestrator.ex](/home/trajan/Projects/ema/daemon/lib/ema/sessions/orchestrator.ex)

Contractually:

- sessions are operational containers
- sessions can attach to executions
- sessions can attach to intents through `intent_links`
- sessions should not become the canonical owner of semantic progress

## Canonical Link Model

The canonical bridge table is:

- [intent_link.ex](/home/trajan/Projects/ema/daemon/lib/ema/intents/intent_link.ex)

`intent_links` should be treated as the shared attachment spine for:

- actors
- executions
- claude sessions
- AI sessions
- execution agent sessions
- proposals
- tasks
- goals
- brain dump items
- imported docs and vault notes

## Allowed Link Types

Current contract-approved `linkable_type` values:

- `execution`
- `actor`
- `claude_session`
- `ai_session`
- `agent_session`
- `proposal`
- `task`
- `goal`
- `brain_dump`
- `vault_note`
- `doc`
- `harvest`

Compatibility-only:

- `session`

`session` is too ambiguous long-term. New code should prefer the specific session types above.

## Allowed Link Roles

These roles are canonical:

- `origin`
- `evidence`
- `derived`
- `context`
- `related`
- `superseded`
- `owner`
- `assignee`
- `operator`
- `runtime`

Role meanings:

- `origin`: source object that caused the intent to exist
- `evidence`: supporting artifact or corroborating source
- `derived`: downstream object inferred from the intent
- `context`: artifact included for context assembly
- `owner`: durable responsible party
- `assignee`: current assigned party
- `operator`: human or supervising actor
- `runtime`: execution/session object currently carrying the work

## Provenance Classes For Links

Canonical provenance values:

- `manual`
- `approved`
- `execution`
- `session`
- `harvest`
- `cluster`
- `import`
- `inferred`
- `system`

Rule:

- semantic importance is expressed by `role`
- trust source is expressed by `provenance`

## Canonical Runtime Chain

For any active work, EMA should be able to answer:

1. which intent is being worked
2. which execution is carrying that work
3. which actor owns or operates that work
4. which sessions are participating
5. which artifacts or docs are context vs evidence

Minimum canonical chain for active work:

- one `intent`
- zero or more `owner` or `assignee` links to `actor`
- zero or more `runtime` links to `execution`
- zero or more `runtime` links from that intent to `claude_session`, `ai_session`, or `agent_session`

Execution should also retain its native fields such as:

- `actor_id`
- `session_id`
- `task_id`
- `proposal_id`

Those fields remain operational truth. They are not replaced by `intent_links`. `intent_links` makes them queryable from the semantic side.

## Ownership Rules

### Intent owns semantic progress

Intent status represents semantic progress:

- planned
- active
- researched
- outlined
- complete
- blocked

Intent status should answer: what is true about the work itself?

### Execution owns runtime progress

Execution status represents runtime progress:

- created
- proposed
- awaiting_approval
- approved
- delegated
- running
- harvesting
- completed
- failed
- cancelled

Execution status should answer: what is happening in the running workflow?

### Sessions own transcript and transport state

Sessions own:

- prompts
- token usage
- transcript location
- project path
- active/completed/error process state

Sessions should not be used as the sole source of semantic status.

### Actors own participant identity

Actors own:

- name
- slug
- actor type
- capabilities
- phase

Actors should not own semantic hierarchy or execution lineage.

## Canonical Verbs By Surface

These verbs should mean the same thing across CLI, HTTP, MCP, and channels.

### Intent verbs

- `list intents`
- `show intent`
- `search intents`
- `create intent`
- `update intent`
- `show intent tree`
- `show intent status`
- `show intent lineage`
- `link intent`

### Runtime verbs

- `create execution for intent`
- `attach actor to intent`
- `attach execution to intent`
- `attach session to intent`
- `show active runtime for intent`
- `report execution outcome`

### Context verbs

- `get intent context`
- `get operator context for intent`
- `get runtime context for intent`
- `show provenance for context bundle`

## Surface Requirements

### Native CLI

Canonical surface:

- [cli.ex](/home/trajan/Projects/ema/daemon/lib/ema/cli/cli.ex)
- [intent.ex](/home/trajan/Projects/ema/daemon/lib/ema/cli/commands/intent.ex)

Required behavior:

- direct and HTTP transport must expose the same verbs
- intent commands must be the canonical operator path
- actor/session/execution attachment commands should land here first

### Legacy CLI

Compatibility-only surface:

- [cli.ex](/home/trajan/Projects/ema/daemon/lib/ema_cli/cli.ex)
- [intent.ex](/home/trajan/Projects/ema/daemon/lib/ema_cli/intent.ex)

Rule:

- no new contract features should be invented only here
- either route through canonical handlers or keep as thin HTTP wrapper

### HTTP API

Canonical HTTP projection:

- [intents_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/intents_controller.ex)
- [session_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/session_controller.ex)
- [ai_session_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/ai_session_controller.ex)
- [actor_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/actor_controller.ex)

Required additions next:

- intent-centric runtime attachment endpoints
- one endpoint to inspect `intent + actor + session + execution` together

### MCP

Canonical agent surface:

- [server.ex](/home/trajan/Projects/ema/daemon/lib/ema/mcp/server.ex)
- [tools.ex](/home/trajan/Projects/ema/daemon/lib/ema/mcp/tools.ex)
- [session_tools.ex](/home/trajan/Projects/ema/daemon/lib/ema/mcp/session_tools.ex)
- [mcp_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/mcp_controller.ex)

Contract rule:

- stdio MCP and HTTP MCP must dispatch the same tool semantics
- intent tools are semantic tools
- session tools are orchestration tools
- future actor/execution attachment tools should be explicit, not overloaded into generic session tools

### Realtime Channels

Canonical realtime surface:

- [intents_channel.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/channels/intents_channel.ex)

Required additions next:

- broadcast link creation
- broadcast lineage additions
- broadcast active runtime changes for an intent

## Multi-Actor Rules

EMA must support more than one actor participating in the same intent.

Contract rules:

- an intent may have multiple actor links
- exactly zero or one actor should be marked `owner`
- zero or more actors may be marked `assignee`
- a human supervisory actor may be marked `operator`
- multiple sessions may attach to the same intent
- multiple executions may attach to the same intent over time
- executions represent attempts or runs, not permanent identity

This means historical and concurrent work are both representable without mutating the core semantic identity of the intent.

## Compatibility Rules

### Existing execution fields stay valid

Existing runtime fields in `executions` remain authoritative for execution-local logic:

- `actor_id`
- `session_id`
- `task_id`
- `proposal_id`
- `brain_dump_item_id`
- `intent_slug`

They should not be removed during this phase.

### Intent links add semantic navigation

When an execution or session is attached to an intent:

- native runtime fields remain in their home tables
- an `intent_link` is added so semantic-side queries can see the relationship

### Ambiguous `session` links are legacy

If older data uses `linkable_type = session`, keep it readable.

New writes should use:

- `claude_session`
- `ai_session`
- `agent_session`

## Context Assembly Rules

Intent-centered context assembly should prefer:

- the intent itself
- linked actors with `owner`, `assignee`, or `operator`
- linked runtime objects with role `runtime`
- linked evidence and context artifacts
- project-local docs and vault notes

Intent context should not blindly include:

- every session in the project
- every vault note referencing a term
- every historical execution

The contract for context assembly is:

- intent is the anchor
- links determine relevance
- provenance determines trust
- runtime recency determines what is live

## Immediate Implementation Implications

These are the next concrete code moves implied by this contract:

1. add explicit attachment helpers in `Ema.Intents` for actor, execution, and session link creation
2. add intent-centric runtime inspection endpoint
3. add MCP tools for:
   - attach actor to intent
   - attach execution to intent
   - attach session to intent
   - get intent runtime bundle
4. broadcast link and lineage updates over `IntentsChannel`
5. keep native CLI as the canonical surface for these verbs

## What Not To Do

Do not:

- make sessions the source of semantic progress
- collapse all session types into one undifferentiated `session`
- remove execution-local foreign keys yet
- let legacy CLI semantics drift away from canonical intent behavior
- build UI-heavy surfaces before the link contract is stable

## Done When

This contract is considered implemented when:

- every active intent can show its owner actor, active execution, and participating sessions
- CLI, HTTP, MCP, and channel surfaces use the same attachment vocabulary
- semantic inspection of an intent can reconstruct its operational chain
- multi-actor participation is visible without inventing new shadow models
