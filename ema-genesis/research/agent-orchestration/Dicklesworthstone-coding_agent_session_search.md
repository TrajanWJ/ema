---
id: RES-CASS
type: research
layer: research
category: agent-orchestration
title: "Dicklesworthstone/coding_agent_session_search — 11-provider session indexer (CASS)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/Dicklesworthstone/coding_agent_session_search
  stars: 658
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, agent-orchestration, signal-S, session-search, multi-provider, cass]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-ntm]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# Dicklesworthstone/coding_agent_session_search (CASS)

> Unified TUI/CLI indexing 11+ coding agent session formats into one searchable BM25 + semantic index. EMA's `Ema.ClaudeSessions.SessionWatcher` is single-provider — CASS is the multi-provider replacement.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/Dicklesworthstone/coding_agent_session_search> |
| Stars | 658 (verified 2026-04-12) |
| Last activity | 2026-04-12 (active) |
| Signal tier | **S** |

## What to steal

### 1. The 11-provider discovery table

```
~/.codex/sessions/                                  # OpenAI Codex
~/.claude/projects/                                 # Claude Code
~/Library/Application Support/Cursor/User/History/  # Cursor (macOS)
~/.config/Cursor/User/History/                      # Cursor (Linux)
~/.aider/                                           # Aider
~/.gemini/conversations/                            # Gemini
~/.cline/sessions/                                  # Cline
~/.amp-cli/                                         # Amp
... (11 total)
```

EMA's old `Ema.ClaudeSessions.SessionWatcher` only handles `~/.claude/projects/`. The moment you add Codex or Cursor as a second runtime, you have no index. **Port this discovery table directly** as the first thing EMA's session ingest layer does.

### 2. Normalized Conversation → Message → Snippet schema

```typescript
Conversation {
  id, provider, started_at, ended_at, project_path, token_count
  messages: Message[]
}
Message {
  role, content, tool_calls, files_touched, timestamp
  snippets: Snippet[]
}
Snippet {
  type: 'code' | 'file_diff' | 'command' | 'plan'
  language, content
}
```

Cross-provider unified shape. EMA's `ClaudeSession` schema becomes `AgentSession` with the same fields plus a `provider` discriminator.

### 3. Hybrid BM25 + MiniLM with RRF fusion

Tantivy for BM25 lexical search + MiniLM embeddings for semantic search. Reciprocal Rank Fusion combines them. This is the right architecture for EMA's "search your own agent history" feature.

### 4. Bundle as binary or copy the discovery table

CASS is small enough that EMA could either ship the binary as a sidecar or just port the discovery paths. Pick based on whether you want to inherit improvements automatically.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Add "Session Ingest" section with the 11-provider discovery paths. Net-new section. |
| `[[_meta/SELF-POLLINATION-FINDINGS]]` | `Ema.ClaudeSessions.SessionWatcher` REPLACE entry — point at CASS as the bundled binary or copy-target |

## Gaps surfaced

- EMA only watches Claude. Adding any other agent breaks the index.
- No hybrid retrieval (BM25 + embeddings).

## Notes

- 658 stars, 18 updates today. Dependency candidate — EMA could ship CASS as a bundled binary and stop reinventing session indexing.

## Connections

- `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]` — sibling
- `[[research/agent-orchestration/Dicklesworthstone-ntm]]` — sibling
- `[[canon/specs/AGENT-RUNTIME]]`
- `[[_meta/SELF-POLLINATION-FINDINGS]]`

#research #agent-orchestration #signal-S #cass #session-search #multi-provider
