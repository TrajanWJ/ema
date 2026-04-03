# Feature: Decision Memory

## What It Does

Mines decisions from vault notes and Discord, links them to outcomes, and surfaces precedent when similar decisions arise. Your institutional memory for "we tried this before."

## Why It Matters

Without decision memory, you re-litigate the same choices. "Should we use SQLite or Postgres?" gets decided, forgotten, redecided. Decision Memory captures the fork, the reasoning, the outcome — so next time, the system says "we chose SQLite 3 months ago because X, and the outcome was Y."

## How It Works (Technical)

### Decision Mining
Parse vault notes and Discord transcripts for decision patterns:
- "We decided to..." / "The decision is..." / "Going with..."
- "Pros/cons" lists
- Architecture Decision Records (ADRs)
- Forum threads with votes or conclusions

### Decision → Outcome Linking
After a decision is mined:
- Track what changed (git commits, PRs, config changes)
- Measure outcome (did it work? test results, performance, user feedback)
- Score: 1.0 = great outcome, 0.0 = disaster

### Precedent Search
When a new decision is encountered:
- Generate embedding for the decision context
- Search for similar past decisions (cosine similarity)
- Present: "Similar decision X was made N months ago. Outcome: Y. Reasoning was: Z."

## Current Status

- ✅ Decision schema exists (`Ema.Decisions`) with basic CRUD
- ✅ DecisionController with REST API
- ❌ Decision mining from vault/Discord — not implemented
- ❌ Outcome linking — not implemented
- ❌ Precedent search — not implemented
- ❌ Embedding-based similarity — not implemented

## Implementation Steps

1. Create `Ema.Intelligence.DecisionMiner` — parse vault notes for decision patterns (regex + LLM classification)
2. Create `Ema.Intelligence.DecisionArchaeology` — deeper analysis of historical decisions
3. Create `Ema.Intelligence.PrecedentSearch` — embedding-based similarity search
4. Add outcome fields to decision schema (migration)
5. Create decision → outcome linking (manual + automatic via git/PR correlation)
6. Build Decision Timeline UI component

## Data Structures

### Decision (Existing + Extensions)
| Field | Type | Description |
|---|---|---|
| id | string | Unique ID |
| title | string | Decision summary |
| context | text | What was the situation? |
| options | json | What options were considered? |
| chosen | string | What was decided? |
| reasoning | text | Why this choice? |
| source | string | vault_note, discord, manual |
| source_path | string | File path or message ID |
| outcome_score | float | 0-1, how well did it work? (NEW) |
| outcome_notes | text | What happened after? (NEW) |
| project_id | string | Related project |
| embedding | vector | For similarity search (NEW) |

## API Surface

| Endpoint | Method | Description |
|---|---|---|
| `/api/decisions` | GET | List decisions (existing) |
| `/api/decisions/:id` | GET | Decision detail (existing) |
| `/api/decisions/mine` | POST | Trigger decision mining from vault/Discord |
| `/api/decisions/:id/outcome` | PUT | Record outcome for a decision |
| `/api/decisions/precedent` | POST | Search for similar past decisions |

## Next Steps

1. Build decision miner (vault notes first — they're structured)
2. Add embedding generation to existing decisions
3. Build precedent search
4. Build Decision Timeline UI
