---
id: MOC-self-building
type: moc
layer: research
title: "Self-Building Systems — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, self-building]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
---

# Self-Building Systems — Map of Content

> Repos covering systems where work flows through structured intent → plan → execute → record pipelines, plus decision-as-data and curator/compiler patterns.

## Tier S

| Repo | Pattern |
|---|---|
| [[research/self-building/gsd-build-get-shit-done\|get-shit-done]] | STATE.md + 5-phase Discuss/Plan/Execute/Verify/Ship cycle |
| [[research/self-building/snarktank-ralph\|ralph]] | Fresh context per iteration + 3-file memory |
| [[research/self-building/aden-hive-hive\|hive]] | 3-tier worker/judge/queen hierarchy |
| [[research/self-building/loomio-loomio\|loomio]] | Decisions as first-class queryable entities |

## Tier A

| Repo | Pattern |
|---|---|
| [[research/self-building/NicholasSpisak-second-brain\|second-brain]] | Karpathy LLM Wiki — curator/compiler split |

## Cross-cutting takeaways

1. **STATE.md is the missing governance surface.** EMA has phase_transitions but no persistent decision-and-blockers doc per project.
2. **Fresh context per iteration** (Ralph) is an architectural primitive worth adopting. Combined with `[[research/context-memory/Paul-Kyle-palinode]]`'s 2-phase context, EMA gets a clean memory layer.
3. **Decision is a first-class entity** (Loomio). Killed proposals lose their rationale unless captured.
4. **Hierarchy beats flat** for multi-agent (Hive). Worker/Judge/Queen maps onto EMA's currently-flat 18 actors.
5. **Curator/compiler separation** (second-brain) — human controls input, LLM compiles. EMA conflates these.

## Connections

- [[research/_moc/RESEARCH-MOC]]
- [[research/agent-orchestration/_MOC]] — overlap on hive, ralph
- [[canon/specs/BLUEPRINT-PLANNER]]
- [[canon/specs/EMA-V1-SPEC]]

#moc #research #self-building
