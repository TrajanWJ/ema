---
id: META-CANON-STATUS
type: meta
layer: _meta
title: "Canon Status — which docs are authoritative, which are aspirational"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [canon, status, ruling, genesis, v1-spec]
connections:
  - { target: "[[EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[SCHEMATIC-v0]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
---

# Canon Status

> **Ruling issued 2026-04-12** by the human project lead in response to research navigation Q1.

## The Tension

Two sets of documents disagree about what EMA v1 actually is:

| Doc | Position |
|---|---|
| `EMA-V1-SPEC.md` (2026-04-11) | Declares itself successor. Cuts v1 to **CLI + TS library + folder-of-markdown graph + 1 LLM provider + intent loop**. Electron, P2P, vApps, multi-agent all labeled "v2+". |
| `EMA-GENESIS-PROMPT.md` v0.2 | Describes the **maximalist vision**: 35 vApps, P2P mesh, puppeteer terminal runtime, distributed homelab, graph wiki with 4 layers, research ingestion, web wiki. Labeled canonical in §15. |
| `SCHEMATIC-v0.md` | Same maximalist stance as Genesis. Labeled canonical. |
| `vapps/CATALOG.md` | Describes all 35 vApps as if they exist in v1. Labeled canon active. |
| `canon/specs/AGENT-RUNTIME.md` | Deep-dive spec for Electron puppeteer runtime with xterm.js + tmux. Labeled canon active. |
| `canon/specs/BLUEPRINT-PLANNER.md` | Deep-dive vApp spec with full data models and user flows. Labeled canon active. |

## The Ruling

**Q1 answer = B. Genesis wins.**

The maximalist Genesis vision is the canonical target. `EMA-V1-SPEC.md` is **re-labeled as Phase 1 of the Genesis vision**, not a competing reduction.

## What This Changes

| Doc | Before | After |
|---|---|---|
| `EMA-GENESIS-PROMPT.md` | Canonical target. Status: active. | Unchanged. Canonical target. Status: active. |
| `SCHEMATIC-v0.md` | Canonical architecture. | Unchanged. Canonical architecture. |
| `vapps/CATALOG.md` | Canon active. | Unchanged. Canon active — describes the full v-final catalog. |
| `canon/specs/AGENT-RUNTIME.md` | Canon active. | Unchanged. Canon active — describes the Phase 2 runtime target. |
| `canon/specs/BLUEPRINT-PLANNER.md` | Canon active. | Unchanged. Canon active — describes the Phase 4 Blueprint vApp target. |
| `canon/specs/EMA-V1-SPEC.md` | *"supersedes all prior extractions"* | **Re-labeled.** The header claim gets softened. See `[[CANON-DIFFS]]`. V1-SPEC becomes the **Phase 1 contract** inside the Genesis vision. Nothing it says gets thrown away — it is still the minimum viable slice — but it no longer claims to replace Genesis. |

## Scope for Cross-Pollination Research

Because Q1=B, cross-pollination research targets the **full Genesis vision**, not just V1-SPEC scope. Research categories:

- Agent orchestration / multi-agent coordination / parallel dev agents
- P2P networks / local-first sync / CRDTs / Gun.js / Automerge / Yjs / Loro
- Knowledge graphs / Obsidian-like wikis / graph databases / SurrealDB
- CLI frameworks / terminal emulators in Electron / xterm.js / node-pty / tmux wrappers
- vApp / plugin architectures / Electron multi-window management
- Context engines / LLM context assembly / agent memory / session continuity
- Research ingestion / RSS + AI curation / feed aggregators
- Personal life OS / ADHD / executive function tools (already seeded)
- Self-building systems / intent-proposal-execution pipelines

See `[[research/_moc/RESEARCH-MOC]]` for the live research index.

## Related Nodes

- `[[research/_moc/RESEARCH-MOC]]` — Research layer map of content
- `[[intents/GAC-QUEUE-MOC]]` — GAC cards surfaced by research
- `[[_meta/CANON-DIFFS]]` — Proposed updates to the 7 canon docs
- `[[_meta/SELF-POLLINATION-FINDINGS]]` — Patterns worth porting from the old build

#meta #canon-status #ruling #genesis #v1-spec
