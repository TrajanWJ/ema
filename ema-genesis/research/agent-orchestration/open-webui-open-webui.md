---
id: RES-open-webui
type: research
layer: research
category: agent-orchestration
title: "open-webui/open-webui — three-mode tool-call approval (Allow Once / Always / Decline)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-d
source:
  url: https://github.com/open-webui/open-webui
  stars: 131439
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, agent-orchestration, signal-S, open-webui, approval-ux, three-mode]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]", relation: references }
  - { target: "[[research/agent-orchestration/langchain-ai-langgraph]]", relation: references }
---

# open-webui/open-webui

> 131k stars. ChatGPT-clone UI for local LLMs with an in-development tool-call approval modal (Discussion #16701). The **three-mode approval system** is the right shape for EMA.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/open-webui/open-webui> |
| Stars | 131,439 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **S** |

## What to steal

### 1. Three-mode approval, not two

```
[Allow Once]    # default — per-call approval
[Allow Always]  # session-scoped auto-approve for trusted tools
[Decline]       # block but continue conversation
```

NOT just "approve / reject." Three modes captures:
- The conservative default (Allow Once)
- The trust escalation (Allow Always for trusted patterns)
- The graceful refusal (Decline + continue)

EMA's canon §3 Approval Pattern should adopt this exact set.

### 2. Reload-restores-pending

Session state persisted backend-side so a browser crash mid-approval restores the pending modal on reload. **Pending approvals must survive client disconnect.**

### 3. WebSocket event channel

Approval requests pushed from backend to frontend via WebSocket. Same shape as EMA's old Phoenix channels.

### 4. The novelty timing window

The feature is a Discussion-stage proposal — not yet merged. **EMA can ship first** for its specific domain and plausibly claim primacy in the "life OS approval gate" niche.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md GAC` | Add the "Allow Always this session" mode alongside approve/reject/revise |
| `EMA-GENESIS-PROMPT.md §3` | Pending suggestions must survive client disconnect |

## Gaps surfaced

- EMA's current stores use `loadViaRest()` + channel subscribe but no explicit "rehydrate pending proposal modal" flow on reconnect.

## Notes

- License is NOASSERTION (Open-WebUI license, BSD-adjacent with branding constraints). Verify before lifting code.
- 131k stars makes it the dominant local-LLM frontend.

## Connections

- `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]` — schema cousin
- `[[research/agent-orchestration/langchain-ai-langgraph]]` — primitive cousin
- `[[research/agent-orchestration/_MOC]]`

#research #agent-orchestration #signal-S #open-webui #three-mode-approval
