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
