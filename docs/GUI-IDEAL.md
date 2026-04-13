# EMA Ideal GUI / Product Spec

Date: 2026-04-13
Status: product-design pass, grounded in current repo reality

## Purpose

This document defines the full ideal EMA product as if implementation effort
were effectively free, while still mapping that product back to the repo that
exists today.

It is intentionally opinionated:

- the pluralized runtime is the first implementation target
- the singular loop layer is the deeper orchestration core
- imported history is not a side feature; it is a primary substrate
- the UI must expose one coherent system, not a pile of vApps and stores

## Product Thesis

EMA is one merged product with five jobs:

1. capture work and context as it happens
2. consolidate raw human, agent, and system history into one durable place
3. turn that raw material into reviewable candidate structure
4. promote reviewed structure into intents, proposals, canon, and executions
5. run ongoing human + agent work against that structure

The product is not "a desktop shell with many random apps." It is:

- a collaborative workspace
- a project execution environment
- a memory consolidation system
- a review-and-promotion machine
- a traceable operating history of what happened and why

## Core Model

EMA has four layers that must be obvious in the product:

1. Capture and Arrival
   - brain dumps, imported sessions, CLI traces, shell history, browser captures,
     IDE logs, tool output, uploaded files
   - these land in `Chronicle`

2. Review and Structuring
   - extraction, linking, dedupe, confidence scoring, promotion suggestions
   - this happens in `Review`

3. Durable Work and Knowledge
   - intents, proposals, executions, canon, research, memory links, project
     attachments
   - these are the structured EMA objects

4. Runtime Operation
   - agents, queues, spaces, traces, activity streams, system health
   - this is the live operational layer over the structured system

## Global Product Structure

### Primary navigation

The ideal shell has seven primary destinations:

1. `HQ`
   - top-level command center
   - daily state, active work, review pressure, agent activity, important changes

2. `Work`
   - projects, intents, proposals, executions, tasks, spaces

3. `Chronicle`
   - the durable landing zone for imported/raw history and traces

4. `Review`
   - the queue where raw and inferred material becomes structured EMA objects

5. `Knowledge`
   - canon, decisions, docs, research, feeds, memory graph

6. `Trace`
   - unified timeline, search, recall, audit, provenance, system events

7. `System`
   - agents, connectors, ingestion, vault, settings, runtime health

`Launchpad` remains useful, but only as an app-switcher and quick-open surface.
It must not be the canonical product map.

### Workspace hierarchy

The ideal hierarchy is:

- `Workspace`
  - the whole EMA installation for one operator or household/team
- `Space`
  - durable context boundary such as personal, EMA core, client work, research
- `Project`
  - an execution container with artifacts, chronology, intents, and outcomes
- `Work object`
  - intent, proposal, execution, task, decision, note, review item
- `Evidence`
  - chronicle entries, artifacts, traces, files, conversations, links

Rules:

- spaces are the primary context partition
- projects live inside spaces
- chronicle items may exist before they belong to a project
- promotion is what moves a raw chronicle item into project/canon/work structures

### Global command surfaces

The ideal product has four global command surfaces:

1. `Command Bar`
   - universal create/open/jump/action bar
   - search objects, run commands, create intent, open review item, link source

2. `Quick Capture`
   - always-available capture surface
   - text, URL, file, screenshot, clipboard, shell output, prompt fragment

3. `Promotion Palette`
   - context-sensitive actions on any object
   - "promote to intent", "attach to execution", "draft proposal", "write canon
     decision", "mark as evidence", "merge with existing"

4. `Trace Search`
   - global query for timeline and provenance
   - ask "where did this come from", "what changed yesterday", "which session
     created this idea", "which execution touched this file"

### Cross-cutting panels / drawers / overlays

The ideal shell exposes the following everywhere:

- `Context Dock`
  - current space, project, active intent, related canon, open review items,
    recent chronicle evidence

- `Inspector`
  - right-side detail panel for any selected object
  - shows provenance, links, lifecycle, candidate promotions, recent changes

- `Review Tray`
  - pinned access to pending extractions, low-confidence inferences, merge
    conflicts, unresolved review items

- `Activity Drawer`
  - live recent events from executions, agents, imports, approvals, system traces

- `Omnibox Breadcrumb`
  - the current object path, for example:
    `Space > Project > Intent > Proposal > Execution > Artifact`

## Major Product Surfaces

| Surface | What it is for | Core questions it answers | Primary objects | Primary actions | Feeds / outputs |
|---|---|---|---|---|---|
| `HQ` | Top-level operating dashboard | What matters now? What is blocked? What needs review? | spaces, projects, active executions, pending review items, active agents | jump, assign focus, triage review, resume work | routes into every other surface |
| `Launchpad` | Fast app and workflow switcher | Where do I go next? | vApps, pinned workflows, recent objects | open, pin, quick-launch, continue last task | opens surfaces, not a truth source |
| `Spaces` | Context partition manager | Which context am I in? What belongs together? | spaces, pinned projects, shared prompts, scope rules | create space, switch context, set defaults, link sources | scopes projects, chronicle, feeds, search |
| `Projects` | Operational project container | What is this project? What is active? What evidence exists? | projects, intents, executions, attached chronicle items, artifacts | create/update project, attach sources, start work, inspect lineage | feeds intents, executions, chronicle linkage |
| `Intents` | Durable statement of desired work | What should happen? Why does it matter? What sources justify it? | intents, links, source evidence, successors | create, split, link evidence, prioritize, mark ready for proposal | feeds proposals, review, canon, projects |
| `Proposals` | Human-approval boundary | What is the proposed action? What are the tradeoffs? What should run next? | proposals, lineage, scores, approval state, related intents | generate, revise, compare, approve, reject, merge | feeds executions and canon updates |
| `Executions` | Runtime ledger of work performed | What ran? What happened? What changed? Was it successful? | executions, artifacts, step journals, result summaries | start, monitor, checkpoint, complete, attach artifacts | feeds timeline, projects, canon writeback |
| `Chronicle` | Landing zone for raw/imported history | What arrived? From where? About what? Is it linked yet? | sessions, traces, messages, artifacts, source bundles | import, normalize, group, filter, link, compare, extract | feeds Review, Trace, Projects, Search |
| `Review` | Promotion and structuring layer | What should become an intent, proposal, decision, or evidence node? | review items, candidate extractions, dedupe matches, confidence scores | approve, reject, merge, defer, promote, annotate | feeds intents, proposals, canon, research, memory |
| `Canon` | Durable design and operating truth | What is decided? What is policy? What is canonical? | canon docs, decisions, specs, standing docs | read, propose edit, write decision, link evidence | feeds review, trace, project context |
| `Research / Feeds` | Ongoing source discovery and synthesis | What signals are worth attention? What should be pulled into work? | feed items, views, source rankings, research nodes | save, hide, promote, queue research/build, start chat | feeds Chronicle, Review, Projects |
| `Agent Workspace` | View and operate agent activity | Which agents are active? On what scope? With what output? | actors, sessions, executions, runtime traces | spawn, inspect, pause, handoff, compare output | feeds executions, Chronicle, Trace |
| `Human Workspace` | Personal working view | What am I doing now? What should I capture? | one-thing focus, notes, captures, current project, open review items | capture, link, jot, prioritize, assign to project | feeds Chronicle, Intents, Projects |
| `Timeline / Activity` | Unified historical record | What happened when, by whom, and to what? | events, imports, promotions, approvals, execution changes | filter, scrub, diff, trace lineage | feeds audit, search, recall |
| `Memory / Context Graph` | Cross-object semantic linking | How are these ideas, sessions, decisions, and projects connected? | entities, links, claims, references, summaries | connect, inspect cluster, merge duplicates, pin context | feeds HQ, Review, Search, Canon |
| `Search / Recall / Trace` | Universal retrieval surface | Have we seen this before? Which session said this? What file or decision is related? | every indexed object plus provenance edges | search, open, compare, pivot to source | feeds every other surface |
| `System / Connectors` | Runtime plumbing and ingestion control | Which connectors exist? What is healthy? What is deferred? | ingestion sources, vault status, connector accounts, service status | scan, connect, re-import, inspect failures, configure policies | feeds Chronicle and runtime health |

## Operator Workflows

### 1. Brain dump -> intent

1. Human captures text, voice, or file into Quick Capture.
2. Item lands in `Chronicle` as a raw entry with source metadata.
3. Review suggests candidate intent title, scope, and related project links.
4. Human approves promotion.
5. Intent is created with provenance back to the capture.

### 2. Imported session -> review -> canon / intents / proposals

1. EMA imports a Claude, ChatGPT, Cursor, or shell session into `Chronicle`.
2. The session is normalized into messages, artifacts, files touched, and topic
   clusters.
3. Review generates candidate extractions:
   - draft intents
   - candidate decisions
   - proposal seeds
   - execution evidence
4. Human approves, merges, or defers each extraction.
5. Promotions create durable EMA objects with trace links back to the raw session.

### 3. Proposal -> approval -> execution

1. An intent or review item spawns one or more proposals.
2. Proposal view shows lineage, rationale, score, and evidence.
3. Human approves a proposal.
4. Execution starts and streams runtime activity.
5. Completion writes result artifacts and promotion receipts back into the graph.

### 4. Execution -> result -> writeback

1. Execution runs against an intent/project.
2. Step journal, artifacts, and result summary accumulate in real time.
3. On completion, EMA suggests:
   - intent status changes
   - canon updates
   - follow-up proposals
   - project milestone updates
4. Human confirms the writeback.

### 5. Session trace -> memory extraction -> project linkage

1. Timeline or Chronicle reveals a cluster of sessions around a topic.
2. Review extracts recurring themes, files changed, and decisions implied.
3. Memory Graph links those themes to projects, intents, and canon nodes.
4. Project now has durable background context instead of scattered chat history.

### 6. System logs / CLI traces -> searchable activity timeline

1. CLI runs, shell history, agent runtime output, and worker traces land in
   Chronicle as technical traces.
2. Trace surface groups them by project, execution, agent, and time.
3. Search can answer "when did this break", "which command produced this file",
   and "what happened before the failure".

### 7. Agent output -> review -> structured integration

1. Agent writes notes, code plans, or generated artifacts.
2. Outputs are preserved as Chronicle artifacts and execution evidence.
3. Review suggests what to preserve as canon, what to file under research, and
   what becomes follow-up work.
4. Nothing becomes canon silently; every durable promotion is reviewable.

### 8. Feed item -> research -> project

1. Feeds ranks a source item.
2. User saves or promotes it.
3. The item becomes either:
   - a Chronicle item for later review
   - a research node
   - a project attachment
   - a proposal seed
4. Provenance remains attached throughout.

## vApp Model

vApps are real working surfaces, but they are not the source of product truth.
They are lenses over product domains.

### Core vApps

These should be treated as first-class implementation targets:

- HQ
- Projects
- Intents
- Proposals
- Executions
- Chronicle
- Review
- Canon
- Research / Feeds
- Search / Trace
- Agents
- System / Connectors

### Derived or composite vApps

These are useful but should derive from core domains rather than invent their
own product models:

- Brain Dump
- Tasks
- Decision Log
- Whiteboard / Canvas / Storyboard
- Focus
- Journal
- Voice
- Dashboard cards

### Optional or experimental vApps

These may exist as special-purpose surfaces, but only if they have a clear
domain owner and promotion path:

- Campaigns
- Governance
- Babysitter
- Evolution
- specialized personal-life surfaces

### vApp rules

A vApp is valid only if it has:

1. a primary object model
2. a named owning domain
3. clear inputs
4. clear outputs
5. explicit relationships to Chronicle, Review, or structured work

If a surface is only a system control plane, it belongs under `System`, not as a
peer product ontology.

If a surface is only a visual treatment over existing objects, it is a view
mode, not a first-class vApp.

## Design Decisions

### HQ is the shell, not "just another app"

HQ should be the operator command center. It should aggregate:

- current space and project
- active executions
- pending review pressure
- chronicle arrivals
- open approvals
- system health

It should not be treated as one tile among many.

### Chronicle is a product pillar, not an ingestion utility

Imported history is core product material. If EMA cannot see what the user and
agents have already done, it cannot become a true operating system for work.

### Review is a first-class surface

The review boundary must be visible and explicit. It is the semantic gate
between raw arrival and durable structure.

### Traceability is non-negotiable

Every promoted object should answer:

- what source produced this
- when it was imported
- what inference created it
- who approved it
- what structured object it became

## Product Boundaries

The ideal product does not require every source to be fully normalized on day
one. It does require one stable place where sources can land, be inspected, and
be promoted later.

That is why the first implementation focus should be `Chronicle` plus `Review`,
not another isolated app tile.
