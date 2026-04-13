---
id: RES-esther
type: research
layer: research
category: life-os-adhd
title: "vortext/esther — Clojure diary with GBNF grammar-constrained extraction"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-e
source:
  url: https://github.com/vortext/esther
  stars: 47
  verified: 2026-04-12
  last_activity: 2023-08 (initial)
signal_tier: A
tags: [research, life-os-adhd, signal-A, esther, gbnf, constrained-extraction]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[research/life-os-adhd/_aspiration-detection-verdict]]", relation: references }
  - { target: "[[DEC-003]]", relation: references }
---

# vortext/esther

> Clojure diary app embedding a local LLM with **constrained-output extraction (keywords, emoji, inner state) via GBNF grammars**. Extraction tech worth stealing for EMA's aspiration detector.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/vortext/esther> |
| Stars | 47 (verified 2026-04-12) |
| Last activity | 2023-08 creation, 537 commits |
| Signal tier | **A** |

## What to steal

### 1. GBNF grammar-constrained JSON extraction

Every diary entry produces **validated structured output** via a GBNF (BNF for grammar-constrained generation) grammar. The LLM cannot return malformed JSON because the grammar enforces it at decode time.

```
schema → "{" pair (',' pair)* "}"
pair   → key ":" value
key    → '"keywords"' | '"emoji"' | '"inner_state"' | ...
value  → string | array | object
```

EMA's aspiration detector should use the same approach: GBNF grammar that constrains the LLM's output to:
```json
[
  {
    "text": "...",
    "confidence": 0.85,
    "source_excerpt": "...",
    "suggested_intent_kind": "..."
  }
]
```

### 2. Reusable for proposal generation

EMA's proposal engine could borrow GBNF for schema-locked Claude responses on proposal generation. Stops the "LLM returned malformed JSON, retry" failure mode.

## Changes canon

| Doc | Change |
|---|---|
| `daemon/.../claude/runner` (TS port) | Consider grammar-constrained output for proposal extraction reliability |
| `[[DEC-003]]` aspiration detection | GBNF as the extraction primitive |

## Gaps surfaced

- Constrained extraction exists; extracting aspirations is a prompt choice, not a tech limitation. **The niche is empty because nobody chose that prompt.**

## Notes

- Clojure stack — read for the grammar files, port the approach.
- The tech enabler for EMA's aspiration detector. Combine with `[[research/life-os-adhd/ErnieAtLYD-retrospect-ai]]`'s UX.

## Connections

- `[[DEC-003]]`
- `[[research/life-os-adhd/_aspiration-detection-verdict]]`

#research #life-os-adhd #signal-A #esther #gbnf #constrained-extraction
