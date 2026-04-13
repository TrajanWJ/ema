---
id: INT-INTENTIONS-SCHEMATIC-ENGINE
type: intent
layer: intents
title: "Intentions Schematic Engine — hierarchical intent graph with contradiction queue, aspirations stack, and ABCD-response request feeds"
status: preliminary
kind: new-work
phase: discover
priority: high
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/intentions-schematic-engine-full-vision-hierarchical-inte/"
recovered_at: 2026-04-12
original_author: human
exit_condition: "Intentions Schematic Engine exists as a daemon subsystem with: hierarchical intent graph per space/project/subproject/task, CLI+TUI natural-language query interface, manual UI fallback, global enable/disable toggle for intent modification, contradiction queue with conversational resolution, aspirations stack, and two on-request feeds (assumption blockers + deferred questions) with ABCD123 response structure."
connections:
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: depends_on }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
tags: [intent, new-work, intentions, schematic, hierarchical, adhd, recovered, preliminary]
---

# INT-INTENTIONS-SCHEMATIC-ENGINE

> **Recovery status:** Preliminary. Verbatim recovery from the old build's `.superman/intents/intentions-schematic-engine-full-vision-hierarchical-inte/intent.md`. This is the design spec for what the canon CATALOG calls "#18 Blueprint / Schematic Planner" — the meta-vApp for system design. The old intent has more operational detail than the catalog entry.

## Original intent text (verbatim)

> INTENTIONS SCHEMATIC ENGINE — full vision: Hierarchical intent graph per space/project/subproject/task. CLI+TUI: target an intent folder, query it with natural language 'intentions update' string. Manual UI option also. EMA can have intent modification enabled/disabled at different times (toggle). Engine includes: (1) Queue of contradictions/logical errors resolved conversationally with intent revision. (2) Stack of aspirations - future overarching idealistic intents. (3) Two delivered-on-request feeds: 'intention clarifications - assumption blocker' with ABCD responses each having 1/2/3 variants (12 options, pick one/several/all), and 'deferred questions - hard answers' same structure. (4) For each feed item: follow up into chat from ABCD123 selection, OR chat directly if none fit, OR delete. The wiki schematic side delivers these flows on request. This becomes the brain of EMA's planning layer.

## Unpacked components

### 1. Hierarchical intent graph

Per space / project / subproject / task. Builds on [[canon/decisions/DEC-007-unified-intents-schema]] 6-level hierarchy. This engine is the **traversal and modification layer** on top of the schema.

### 2. CLI+TUI query interface

Target an intent folder, issue a natural-language `intentions update "..."` command. The engine parses intent, finds relevant nodes, proposes modifications. Manual UI option exists for when NL doesn't fit.

### 3. Global toggle for intent modification

EMA can enable/disable intent modification at different times. When disabled, queries still work but writes are blocked. Prevents the engine from "thinking out loud" and corrupting the graph during brainstorming sessions.

### 4. Contradiction queue

Detects logical errors and contradictions in the intent graph (e.g., conflicting priorities, impossible dependencies, goals that mutually exclude). Resolution is **conversational** — EMA surfaces the contradiction, user picks a revision path, the graph updates.

### 5. Aspirations stack

Future overarching idealistic intents. These are **above** the normal intent hierarchy — they influence but don't block execution. Mapped to vApp CATALOG "Aspirations Log" component of #18.

### 6. Two on-request feeds (the ABCD123 pattern)

This is the distinctive operational surface:

- **Feed A: Assumption blockers** — "intention clarifications." Each item has ABCD responses, each response has 1/2/3 variants. 12 total options. User can pick one, several, or all. Follow-up paths: (a) chat into ABCD123 selection, (b) chat directly if none fit, (c) delete.
- **Feed B: Deferred questions** — same ABCD123 structure. For decisions explicitly punted and now being revisited.

Both feeds are **delivered on request**, not pushed. Wiki schematic side (the knowledge layer) delivers the flows when the user asks for them.

## Why this matters

This is the **planning brain**. [[canon/decisions/DEC-007-unified-intents-schema]] gives you the storage model for intents. This engine gives you the **operational interface** — how you actually use the intent graph day-to-day. Without it, the Three Truths semantic domain is a database you can read from but not think with.

The ABCD123 pattern is unusual and worth preserving verbatim — it's an explicit "reduce decision fatigue by pre-computing the options" commitment that matches the ADHD-first design stance of the project. Compare with the One Thing card pattern in [[research/frontend-patterns/launchpad-one-thing-card]] — same principle, different surface.

## Gaps / open questions

- **What detects contradictions?** LLM-based reasoning? Rule-based? Graph traversal looking for cycles or conflicts?
- **How is the ABCD123 structure generated?** Is it hand-authored per item, or auto-generated by an LLM at feed-assembly time? The original doesn't say.
- **What's the wire between the CLI `intentions update` and the engine?** Probably MCP tool or direct daemon API. Needs a spec.
- **How does the toggle work?** Global flag, per-session flag, per-space flag?
- **Relation to canon CATALOG #18 Blueprint Planner:** are they the same thing, or is the schematic engine the backend and Blueprint Planner the vApp frontend? Likely the latter.

## Related

- [[canon/decisions/DEC-007-unified-intents-schema]] — the data model this engine operates on
- [[vapps/CATALOG]] #18 Blueprint / Schematic Planner — the frontend vApp
- [[canon/specs/BLUEPRINT-PLANNER]] — existing canon spec for the vApp (may need updating with engine details)

#intent #new-work #intentions #schematic #hierarchical #recovered #preliminary
