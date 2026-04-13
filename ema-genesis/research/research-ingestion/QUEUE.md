---
id: RES-research-queue
type: research
layer: research
category: research-ingestion
title: "Research Queue — clone targets and query backlog"
status: active
created: 2026-04-12
updated: 2026-04-13
author: system
signal_tier: A
tags:
  - research
  - queue
  - ingestion
  - backlog
connections:
  - { target: "[[research/research-ingestion/_MOC]]", relation: references }
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
  - { target: "[[research/_clones/INDEX]]", relation: references }
queue:
  - id: RQ-001
    status: queued
    kind: domain
    query: "Open-source research ingestion stack for RSS/Atom + AI-assisted triage."
    topics: [rss, feeds, curation]
    depth: 2
    queued_at: 2026-04-12
    title: "Research ingestion landscape pass"
    domain: research-ingestion
    notes: "Turn the placeholder category into a real research round with concrete repos, queue state, and extraction targets."
    requested_by: human
  - id: RQ-002
    status: queued
    kind: repo
    query: "Assess Miniflux as EMA's feed collector base."
    topics: [rss, aggregator, self-hosted]
    depth: 3
    queued_at: 2026-04-12
    title: "miniflux/miniflux clone + extraction"
    domain: research-ingestion
    source_url: https://github.com/miniflux/v2
    notes: "Likely source of a pragmatic RSS foundation. Read docs, clone shallow, inspect API and filtering model."
    requested_by: human
  - id: RQ-003
    status: queued
    kind: topic
    query: "Incremental wiki and graph-building patterns across repeated ingestions."
    topics: [wiki, graph-builder, synthesis]
    depth: 2
    queued_at: 2026-04-12
    title: "Incremental knowledge graph synthesis"
    domain: knowledge-graphs
    notes: "Cross-cutting topic that connects llm_wiki, iwe, palinode, and future ingestion passes."
    requested_by: human
  - id: RQ-004
    status: extracted
    kind: repo
    query: "Assess Arcforge as a graph-first backend IDE and architecture-design donor."
    topics: [ide, graph, architecture, plugin-runtime, forge]
    depth: 3
    queued_at: 2026-04-13
    title: "ysz7/Arcforge clone + extraction"
    domain: vapp-plugin
    source_url: https://github.com/ysz7/Arcforge
    notes: "Cloned shallow, read core Electron/plugin/forge code, and promoted into a durable research node plus extraction note."
    requested_by: human
  - id: RQ-005
    status: queued
    kind: repo
    query: "Assess CodeBoarding as an architecture-diagram and code-graph donor for EMA."
    topics: [architecture, code-graph, diagrams, llm]
    depth: 3
    queued_at: 2026-04-13
    title: "CodeBoarding/CodeBoarding architecture pass"
    domain: knowledge-graphs
    source_url: https://github.com/CodeBoarding/CodeBoarding
    notes: "Strong candidate for graph-to-explanation and interactive architecture surfaces."
    requested_by: human
  - id: RQ-006
    status: queued
    kind: repo
    query: "Assess qodo-ai/open-aware as a deep code research agent and MCP donor."
    topics: [agents, mcp, code-research, cross-repo]
    depth: 2
    queued_at: 2026-04-13
    title: "qodo-ai/open-aware MCP research"
    domain: agent-orchestration
    source_url: https://github.com/qodo-ai/open-aware
    notes: "Interesting for deep architectural questioning across repos rather than in-editor codegen."
    requested_by: human
  - id: RQ-007
    status: queued
    kind: repo
    query: "Assess CodeCompass as a codebase-analysis and context-assembly donor."
    topics: [analysis, context, codebase, developer-tools]
    depth: 2
    queued_at: 2026-04-13
    title: "alvinveroy/CodeCompass pass"
    domain: knowledge-graphs
    source_url: https://github.com/alvinveroy/CodeCompass
    notes: "Candidate for codebase-orientation surfaces and agent context assembly."
    requested_by: human
  - id: RQ-008
    status: queued
    kind: repo
    query: "Assess GitVizz for graph-first repository understanding and LLM-friendly summaries."
    topics: [graph, repo-analysis, summaries, dependencies]
    depth: 2
    queued_at: 2026-04-13
    title: "adithya-s-k/GitVizz pass"
    domain: knowledge-graphs
    source_url: https://github.com/adithya-s-k/GitVizz
    notes: "Likely useful for dependency and structure views that serve both humans and agents."
    requested_by: human
  - id: RQ-009
    status: queued
    kind: repo
    query: "Assess deepwiki-rs as a repo-to-architecture-doc generator for agent-ready context."
    topics: [docs, architecture, context, repo-wiki]
    depth: 2
    queued_at: 2026-04-13
    title: "sopaco/deepwiki-rs pass"
    domain: knowledge-graphs
    source_url: https://github.com/sopaco/deepwiki-rs
    notes: "Interesting for turning code into durable architectural memory and AI-readable context bundles."
    requested_by: human
  - id: RQ-010
    status: queued
    kind: repo
    query: "Assess TypeSpec as a blueprint/spec layer for system design and code generation boundaries."
    topics: [spec, blueprint, api-design, schema]
    depth: 2
    queued_at: 2026-04-13
    title: "microsoft/typespec blueprint pass"
    domain: self-building
    source_url: https://github.com/microsoft/typespec
    notes: "Likely donor for typed blueprint contracts rather than free-form prose intents."
    requested_by: human
  - id: RQ-011
    status: queued
    kind: repo
    query: "Assess Cline as an in-IDE agent surface with explicit human approval."
    topics: [ide, agent, approvals, mcp, tool-use]
    depth: 2
    queued_at: 2026-04-13
    title: "cline/cline agent-surface pass"
    domain: agent-orchestration
    source_url: https://github.com/cline/cline
    notes: "Useful contrast to EMA's shell-first agent lane: GUI approvals, terminal/browser tools, MCP extension."
    requested_by: human
  - id: RQ-012
    status: queued
    kind: repo
    query: "Assess OpenHands as a longer-horizon coding-agent runtime."
    topics: [agent-runtime, coding, autonomy, tasks]
    depth: 2
    queued_at: 2026-04-13
    title: "OpenHands/OpenHands runtime pass"
    domain: agent-orchestration
    source_url: https://github.com/OpenHands/OpenHands
    notes: "Good benchmark for what a fuller AI-driven development runtime looks like beyond an editor extension."
    requested_by: human
  - id: RQ-013
    status: queued
    kind: repo
    query: "Assess Continue's current open-source direction as an assistant and CI policy layer."
    topics: [assistant, ide, ci, policy]
    depth: 2
    queued_at: 2026-04-13
    title: "continuedev/continue direction pass"
    domain: agent-orchestration
    source_url: https://github.com/continuedev/continue
    notes: "Worth tracking because it spans editor assist and source-controlled AI checks rather than only chat-in-editor."
    requested_by: human
---

# Research Queue

> Queue-backed backlog for future clone, extraction, and domain research work.
> This is the operational intake surface for the research graph: agents add
> candidates here first, then promote completed work into durable research nodes
> under `research/<category>/` and optional extraction docs under
> `research/_extractions/`.

## Workflow

1. Add a queue item when a repo, topic, query, or domain deserves follow-up.
2. Set `depth` to the expected research intensity:
   - `1` = quick landscape scan
   - `2` = focused docs / README pass
   - `3` = clone + targeted source extraction
   - `4+` = run, trace, compare, synthesize
3. When the work lands as a real research node or extraction, move the queue
   item to `extracted` or `done`.

## Queue Semantics

- `kind: repo` = concrete repository or project target
- `kind: query` = plain-language question to answer
- `kind: topic` = recurring theme or pattern cluster
- `kind: domain` = broad landscape pass across a whole area

## Agent Usage

Agents should prefer:
- `ema research queue list --json` for planning the next pass
- `ema research queue add ...` when new follow-up work surfaces
- `ema research search ...` once a queue item has been promoted into the graph

#research #queue #ingestion #workflow
