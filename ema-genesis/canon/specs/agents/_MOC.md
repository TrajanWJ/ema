---
id: SPEC-AGENTS-MOC
type: moc
layer: canon
title: "Agent Prompts — Map of Content"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/priv/agent_prompts/"
recovered_at: 2026-04-12
connections:
  - { target: "[[canon/specs/EMA-CORE-PROMPT]]", relation: parent }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
tags: [canon, moc, agents, prompts, recovered, preliminary]
---

# Agent Prompts — Map of Content

> Canonical role-specific prompts for EMA-authored agents, recovered from the old Elixir build at `IGNORE_OLD_TAURI_BUILD/daemon/priv/agent_prompts/`. All prompts ported verbatim. Status preliminary until full canon review.

## Inheritance model

All role-specific agent prompts inherit from [[canon/specs/EMA-CORE-PROMPT]] (the "soul"). An agent receives the soul prompt first (identity + anti-sycophancy stance + four core principles), then its role prompt second. Role prompts do not replace the soul — they layer on top.

## Recovered agents

| Agent | File | Primary function | Word-count budget |
|---|---|---|---|
| Archivist | [[canon/specs/agents/AGENT-ARCHIVIST]] | Knowledge consolidation — extracts and writes vault notes from completed work | No explicit limit |
| Strategist | [[canon/specs/agents/AGENT-STRATEGIST]] | Goal decomposition, tradeoff analysis, risk identification, decision frameworks | 400 words default |
| Coach | [[canon/specs/agents/AGENT-COACH]] | Reflective practice partner — surfaces blockers, reframes problems, tracks patterns | 200 words default |

## Prompts not yet recovered

The old build mentioned 17 bootstrapped agents but only 3 active (per finding F.15 in [[_meta/SELF-POLLINATION-FINDINGS]]). Only these 3 had prompt files at `daemon/priv/agent_prompts/`. The other 14 had schemas but no prompt text — they were decorative.

Potential future agents (from the old build's decorative fleet): Implementer, Reviewer, Researcher, Planner, Debugger, Integrator, Tester, Deployer, Monitor, Analyst, Writer, Librarian, Curator, Dispatcher.

Whether any of those should be ported is a design decision for a future intent — none have content worth recovering now.

## Phase cadence

Per [[_meta/SELF-POLLINATION-FINDINGS]] §A, actors (both humans and agents) cycle through five phases: `idle → plan → execute → review → retro`. Role prompts should be compatible with whichever phase the agent is currently in. None of the recovered prompts mention phase cadence explicitly — that's an integration concern.

## Open questions

- Should role prompts be merged with the soul prompt at injection time, or sent as two separate system messages?
- Does the 400-word / 200-word budget apply to all responses or just "default" responses (with depth requested overriding)?
- Are there new agents the rebuild needs that didn't exist in the old build? (Intent Schematic Engine might need a "Blueprinter" agent, for example.)

## Related

- [[canon/specs/EMA-CORE-PROMPT]] — parent identity prompt
- [[_meta/SELF-POLLINATION-FINDINGS]] — §B.5 agent spec recovery note
- [[canon/specs/EMA-V1-SPEC]] — §6 human/agent workspace separation

#canon #moc #agents #prompts #recovered #preliminary
