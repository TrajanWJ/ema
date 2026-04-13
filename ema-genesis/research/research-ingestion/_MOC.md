---
id: MOC-research-ingestion
type: moc
layer: research
title: "Research Ingestion — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, research-ingestion, queue]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
---

# Research Ingestion — Map of Content

> Research ingestion is now queue-backed. The category is still early, but it
> is no longer empty: follow-up work lands first in
> `[[research/research-ingestion/QUEUE]]`, then gets promoted into durable
> research nodes and extraction docs.

## Status

Active intake surface:

- `[[research/research-ingestion/QUEUE]]` — repo, query, topic, and domain backlog

## Suggested Round 4 queries

- RSS / Atom aggregators with AI curation: Miniflux, FreshRSS, Tiny Tiny RSS, Newsblur
- Read-it-later with extraction: Wallabag, Omnivore, Readwise Reader (closed)
- YouTube ingestion: yt-dlp + metadata pipelines
- Reddit / HN ingestion: praw, hn-search, gum
- arxiv / Semantic Scholar / Connected Papers
- Anthropic Computer Use harvesting patterns
- Web scraping with semantic dedup
- Personal RAG over downloaded documents (PrivateGPT, Khoj — already cross-listed in context-memory)

These should be added to the queue with explicit `kind`, `domain`, `topic`,
and `depth` metadata rather than living as a static wish list.

## What this MOC will eventually cover

Per `[[canon/specs/EMA-GENESIS-PROMPT]]` §6 Research Ingestion:
- Sources: YouTube, Reddit, arxiv, GitHub, RSS, HN, Twitter/X, custom
- Scheduling: cron + on-demand + agent-triggered
- Storage: ingested into context graph engine
- Access: CLI, GUI, MCP for external agents

## Connections

- [[research/_moc/RESEARCH-MOC]]
- [[research/research-ingestion/QUEUE]]
- [[canon/specs/EMA-GENESIS-PROMPT]] §6
- [[research/context-memory/_MOC]] — adjacent (Khoj, second-brain repos)

#moc #research #research-ingestion #queue
