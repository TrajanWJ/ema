# Feature: Intent-Driven Analysis

## What It Does

Maps high-level intent ("we need multi-tenancy") to actual code, visualizes feature implementation as swimlane diagrams, and enables intent-driven search across codebases.

## Why It Matters

Codebases grow. The gap between "what we want" and "what the code does" widens. Intent-driven analysis bridges that gap — you can ask "show me the authentication flow" and get the actual files, functions, and data flows that implement it.

## How It Works (Technical)

### Intent-to-Code Mapping

Bidirectional links between IntentMap nodes and Superman codebase indices:
- IntentMap: Product → Flow → Action → System → Implementation (5 levels)
- Superman: repos → files → functions → dependencies → call graphs
- Mapping: each IntentNode at the Implementation level links to specific files/functions

### Flow-to-Code Swimlanes

For any Flow-level intent, generate a swimlane diagram showing:
- Lanes = system components (frontend, API, database, external services)
- Steps = actions in order (user clicks → API call → DB query → response)
- Each step links to implementing code

### Intent-Driven Search

Natural language queries mapped to code:
- "show me multi-tenancy code" → org_controller.ex, org.ex, org_store.ts, etc.
- "how does brain dump processing work" → brain_dump.ex, BrainDumpApp.tsx, pipes config
- Uses IntentMap + Superman index + embedding similarity

## Current Status

- ✅ IntentMap with 5-level hierarchy — working
- ✅ Superman client for codebase indexing — working
- ✅ IntentNode CRUD + tree views — working
- ✅ Intent controller + API — working
- ❌ Intent-to-code bidirectional mapping — not implemented
- ❌ Swimlane generation — not implemented
- ❌ Intent-driven search — not implemented

## Implementation Steps

1. Create `Ema.Intelligence.IntentCodeMap` — link IntentNodes to Superman file/function indices
2. Create `Ema.Intelligence.Swimlane` — generate swimlane data from Flow-level IntentNodes
3. Create `Ema.Intelligence.IntentSearch` — natural language → code search
4. Create `EmaWeb.IntentSearchController` — API for intent-driven queries
5. Build `SwimlaneDiagram.tsx` — React visualization component
6. Extend IntentMap UI with code links + search

## Data Structures

### IntentCodeLink (Planned)
| Field | Type | Description |
|---|---|---|
| intent_node_id | string | IntentMap node |
| file_path | string | Source file |
| function_name | string | Specific function (nullable) |
| line_range | string | Line range (e.g., "45-120") |
| confidence | float | How confident is the mapping (0-1) |
| auto_detected | boolean | Auto-detected vs manually linked |

### SwimlaneData (Planned)
| Field | Type | Description |
|---|---|---|
| flow_id | string | Flow-level IntentNode |
| lanes | list | System components involved |
| steps | list | Ordered steps with lane assignment |
| code_links | list | Per-step file/function links |

## API Surface

| Endpoint | Method | Description |
|---|---|---|
| `/api/intent/nodes` | GET | List intent nodes (existing) |
| `/api/intent/tree/:project_id` | GET | Tree view (existing) |
| `/api/intent/search` | POST | Intent-driven code search (NEW) |
| `/api/intent/swimlane/:flow_id` | GET | Swimlane for a flow (NEW) |
| `/api/intent/code-links/:node_id` | GET | Code links for an intent node (NEW) |

## Next Steps

1. Build IntentCodeMap using Superman indices
2. Build intent search (start with keyword matching, upgrade to embedding)
3. Build swimlane generator
4. Build swimlane React visualization
