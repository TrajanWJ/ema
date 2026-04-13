---
id: MOC-research-ingestion
type: moc
layer: research
title: "Research Ingestion — Map of Content (placeholder)"
status: draft
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, research-ingestion, placeholder]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
---

# Research Ingestion — Map of Content

> **Placeholder.** Round 1 + 2 + 3 did not include a dedicated agent for research ingestion (RSS aggregators, AI-curated feeds, content harvesting). EMA's Feeds vApp + research layer ingestion pipeline needs its own research round.

## Status

**Empty.** No nodes yet.

## Suggested Round 4 queries (if pursued)

- RSS / Atom aggregators with AI curation: Miniflux, FreshRSS, Tiny Tiny RSS, Newsblur
- Read-it-later with extraction: Wallabag, Omnivore, Readwise Reader (closed)
- YouTube ingestion: yt-dlp + metadata pipelines
- Reddit / HN ingestion: praw, hn-search, gum
- arxiv / Semantic Scholar / Connected Papers
- Anthropic Computer Use harvesting patterns
- Web scraping with semantic dedup
- Personal RAG over downloaded documents (PrivateGPT, Khoj — already cross-listed in context-memory)

## What this MOC will eventually cover

Per `[[canon/specs/EMA-GENESIS-PROMPT]]` §6 Research Ingestion:
- Sources: YouTube, Reddit, arxiv, GitHub, RSS, HN, Twitter/X, custom
- Scheduling: cron + on-demand + agent-triggered
- Storage: ingested into context graph engine
- Access: CLI, GUI, MCP for external agents

## Connections

- [[research/_moc/RESEARCH-MOC]]
- [[canon/specs/EMA-GENESIS-PROMPT]] §6
- [[research/context-memory/_MOC]] — adjacent (Khoj, second-brain repos)

#moc #research #research-ingestion #placeholder
