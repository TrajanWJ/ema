---
id: CANON-BLUEPRINT-SPEC
type: spec
layer: canon
title: "Blueprint Planner vApp — Full Specification"
status: active
created: 2026-04-11
updated: 2026-04-11
connections:
  - { target: INT-005, relation: references }
tags: [vapp, blueprint, planning, spec, deep-dive]
---

# Blueprint Planner vApp — Full Specification

> Deep-dive spec for the most important vApp in EMA. This document supplements
> §8 in the genesis prompt with data models, user flows, and layout descriptions.

## Overview

The Blueprint Planner is a **system design and planning tool** that formalizes
the process of asking questions, identifying gaps, capturing decisions, deferring
blockers, and extracting aspirations. It is the meta-app — the tool that designs
all other tools, including itself.

The genesis brainstorming session (2026-04-11) was the Blueprint Planner
operated manually through a Claude.ai conversation.

---

## Data Models

### GAC Card (Graph Node)

```yaml
id: GAC-<NNN>
type: gac_card
layer: intents
title: "<short question summary>"
status: <pending|answered|deferred|promoted>
created: <iso8601>
updated: <iso8601>
author: <agent or system>
category: <gap|assumption|clarification>
priority: <critical|high|medium|low>

question: "<the full question text>"

options:
  - label: "A"
    text: "<option A description>"
    implications: "<what choosing this means>"
  - label: "B"
    text: "<option B description>"
    implications: "<what choosing this means>"
  - label: "C"
    text: "<option C description>"
    implications: "<what choosing this means>"
  - label: "D"
    text: "<option D description>"
    implications: "<what choosing this means>"
  - label: "1"
    text: "<numeric option 1>"
    implications: "<what choosing this means>"
  - label: "2"
    text: "<numeric option 2>"
    implications: "<what choosing this means>"

answer:
  selected: <label or null>
  freeform: "<optional freeform response>"
  answered_by: <human id>
  answered_at: <iso8601>

result_action:
  type: <create_canon|create_intent|update_node|defer_to_blocker>
  target: <node_id of created/updated node>

connections:
  - { target: <intent_id>, relation: references }
  - { target: <canon_id>, relation: derived_from }

context:
  related_nodes: [<node_ids that informed this question>]
  section: "<which genesis/spec section this relates to>"
```

### Blocker Card (Graph Node)

```yaml
id: BLOCK-<NNN>
type: blocker
layer: intents
title: "<blocker summary>"
status: <open|resolved|promoted>
created: <iso8601>
updated: <iso8601>
category: <tricky_question|deferred_decision|blocking_dependency>
priority: <critical|high|medium|low>

description: "<full description of the blocker>"
reason_deferred: "<why this can't be decided now>"
resolve_by: "<phase or condition that should trigger resolution>"

promoted_from: <GAC card id, if promoted from GAC queue>
resolved_to: <node_id if resolved>

connections:
  - { target: <intent_id>, relation: blocks }
  - { target: <gac_card_id>, relation: derived_from }
```

### Aspiration Entry (Graph Node)

```yaml
id: ASP-<NNN>
type: aspiration
layer: intents
title: "<aspiration summary>"
status: <captured|converted_to_intent|archived>
created: <iso8601>
updated: <iso8601>

source:
  type: <auto_detected|manual_tag>
  origin_app: "<which vApp the text came from>"
  origin_text: "<the original text that triggered detection>"
  confidence: <0.0-1.0, for auto-detected>

description: "<expanded aspiration description>"
timeframe: <near_term|mid_term|long_term|aspirational>

converted_to: <intent_id, if converted>

connections:
  - { target: <intent_id>, relation: aspiration_of }
```

---

## User Flows

### Flow 1: GAC Queue Review (Primary Loop)

```
1. Human opens Blueprint Planner vApp
2. GAC Queue tab is active by default
3. Top card appears with question + pre-filled options
4. Human reads question and context
5. Human taps option [A] [B] [C] [D] [1] or [2]
   OR types freeform response
   OR taps [Defer →] to move to Blockers Queue
6. On answer:
   a. Decision logged as canon node (if definitive)
   b. Intent created (if answer spawns new work)
   c. Related nodes updated with new connections
7. Next card appears automatically
8. Progress indicator shows: "14 of 23 cards reviewed"
9. Human can pause and resume at any time
```

### Flow 2: Blocker Review

```
1. Human switches to Blockers Queue tab
2. Cards sorted by priority and resolve_by phase
3. Human can:
   a. Resolve a blocker → creates canon decision node
   b. Promote back to GAC → re-enters GAC queue with new context
   c. Add notes/context for future resolution
   d. Link to new external information
4. Resolved blockers remain visible (greyed) for audit trail
```

### Flow 3: Aspiration Capture (Background)

```
1. Human writes in Brain Dumps, Journal, Notes, or any text-input vApp
2. EMA's LLM monitors input (local, not sent externally)
3. LLM detects aspirational/goal statements:
   - "It would be amazing if..."
   - "Long-term I want to..."
   - "The dream is..."
   - "Eventually EMA should..."
   - Any forward-looking goal language
4. Detected aspiration appears in Aspirations Log with:
   - Source text highlighted
   - Confidence score
   - [Confirm] [Dismiss] [Edit] buttons
5. Confirmed aspirations can be:
   a. Left as aspirations (for reference)
   b. Converted to intents (creates INT-xxx node)
   c. Linked to existing intents
```

### Flow 4: Intent Graph Navigation

```
1. Human switches to Intent Graph View tab
2. Visual node graph shows all intents with:
   - Color by status (green=completed, blue=active, grey=draft)
   - Size by priority
   - Edges showing relationships (blocks, fulfills, derived_from)
3. Clicking a node shows:
   - Intent detail panel (right sidebar)
   - Linked proposals and executions
   - Related GAC cards and blockers
4. Human can create new intent directly from graph view
5. Graph auto-layouts but supports manual arrangement
```

### Flow 5: Auto-Generation of GAC Cards

```
1. Agent (or scheduled job) reads current canon + intents
2. Agent identifies:
   - Missing specs (gaps)
   - Unstated assumptions in existing specs
   - Ambiguous language or conflicting info (clarifications)
3. Agent generates GAC cards with:
   - Contextual question based on the gap/assumption
   - 4-6 pre-filled options informed by graph context
   - Links to relevant canon nodes
4. Cards enter GAC queue sorted by priority
5. Human reviews in next Blueprint session
```

---

## Layout Description

### Main Window (BrowserWindow)

```
┌──────────────────────────────────────────────────────────────────┐
│  BLUEPRINT PLANNER                          [≡ Settings] [? Help]│
├────────┬────────┬──────────┬─────────────────────────────────────┤
│ GAC    │Blockers│Aspirations│ Intent Graph                       │
│ Queue  │ Queue  │   Log    │    View                             │
│ (14)   │  (5)   │   (8)    │                                     │
├────────┴────────┴──────────┴─────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  GAP  •  High Priority                     Card 3 of 14   │  │
│  │                                                            │  │
│  │  How should the graph engine handle real-time              │  │
│  │  subscriptions for live-updating wiki views?               │  │
│  │                                                            │  │
│  │  Context: §5 describes CRDT-based collab but doesn't       │  │
│  │  specify how changes propagate to open wiki views.         │  │
│  │  Related: CANON-WIKI-SPEC, INT-004                         │  │
│  │                                                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │ A. Websocket │  │ B. CRDT     │  │ C. Polling   │       │  │
│  │  │    push      │  │    events   │  │    interval  │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  │  ┌─────────────┐  ┌──────┐  ┌──────┐                     │  │
│  │  │ D. Hybrid    │  │ 1.   │  │ 2.   │                     │  │
│  │  │    approach  │  │Defer │  │Skip  │                     │  │
│  │  └─────────────┘  └──────┘  └──────┘                     │  │
│  │                                                            │  │
│  │  Or type your answer: [____________________________]       │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Recent Decisions ────────────────────────────────────────┐   │
│  │  ✓ CRDT engine: Deferred (BLOCK-002)                      │   │
│  │  ✓ Wiki visibility: Configurable per-space                │   │
│  │  ✓ Agent runtime: Puppeteer terminal emulator             │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Aspirations Log View

```
┌──────────────────────────────────────────────────────────────────┐
│  ASPIRATIONS LOG                                    [+ Manual]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⭐ AUTO-DETECTED  •  from Brain Dumps  •  2 min ago            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  "Eventually EMA should be able to spin up entire dev      │  │
│  │   environments on any machine in the network with one      │  │
│  │   command"                                                 │  │
│  │                                                            │  │
│  │  Timeframe: Long-term    Confidence: 0.92                  │  │
│  │                                                            │  │
│  │  [✓ Confirm]  [✗ Dismiss]  [✏ Edit]  [→ Create Intent]    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ✋ MANUAL TAG  •  from Journal  •  Yesterday                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  "I want the feeds to feel like a personal research         │  │
│  │   assistant that knows exactly what I care about"           │  │
│  │                                                            │  │
│  │  Timeframe: Mid-term    Linked: INT-005, CANON-FEEDS       │  │
│  │                                                            │  │
│  │  [→ Create Intent]  [🔗 Link to Existing]  [Archive]      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

| Connects To | How |
|-------------|-----|
| **Wiki** | GAC cards reference wiki nodes. Decisions become wiki pages. |
| **Graph Visualizer** | Intent Graph View is a specialized graph viz. |
| **Agent Hub** | Agent generates GAC cards. Blueprint can dispatch agents. |
| **Brain Dumps / Journal** | Source for auto-detected aspirations. |
| **All text-input vApps** | Aspiration detection runs across all user text. |
| **Canon layer** | Answered GAC cards create/update canon nodes. |
| **Intents layer** | Aspirations convert to intents. Blockers link to intents. |

---

## Implementation Notes

- Blueprint Planner is a Phase 4 vApp (depends on graph wiki + agent runtime)
- GAC card auto-generation requires a working agent with graph read access
- Aspiration detection requires LLM inference (local or via host peer)
- The intent graph view can be a simplified version of the Graph Visualizer vApp
- The "Recent Decisions" panel provides immediate feedback on design momentum

---

*This spec is a canon node. Updated via the proposal/execution pipeline.*
