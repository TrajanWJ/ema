---
id: RES-aspiration-detection-verdict
type: research
layer: research
category: life-os-adhd
title: "Aspiration detection — empty niche verdict (Round 2-E)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-e
signal_tier: S
tags: [research, life-os-adhd, aspiration-detection, empty-niche, verdict, round-2]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[DEC-003]]", relation: derived_from }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
---

# Aspiration Detection — Empty Niche Verdict

> Round 2-E ran 16 targeted searches and directly fetched 10 candidate repos. Verdict: **EMPTY NICHE confirmed.** EMA's Blueprint Aspirations Log is novel as of 2026-04-12.

## What was searched

The target pattern: **automatic detection of goal-like statements ("Eventually X…", "I wish Y…") from freeform user writing, surfaced with confidence scores for user confirm/convert.**

This is what EMA's Blueprint Planner Aspirations Log describes in `[[canon/specs/BLUEPRINT-PLANNER]]`.

## Search terms tried (all null results)

- `"aspiration extraction" llm`
- `"wishful thinking" detection NLP github LLM`
- `"goal extraction" freeform text LLM confidence score`
- `"I want to" "I wish" "I hope" detect LLM extract future intent`
- `"long-term goals" journal notion AI detect surface propose`
- `"smart goals" extraction freeform writing LLM conversion`
- `"values clarification" CBT AI journaling extraction llm`
- `"aspiration" AI app automatically detect propose confirm`

GitHub topics surveyed: `goal-tracking`, `journal`, `personal-development`, `nlp`, `life-os`, `second-brain`.

## Repos that came close but missed

| Repo | Stars | Why it missed |
|---|---|---|
| `[[research/life-os-adhd/nashsu-llm_wiki]]` | 884 | Manual goal filing (user files entries into wiki/goals/ themselves) |
| `[[research/life-os-adhd/cielecki-life-navigator]]` | 32 | Goals are user-authored input context, not AI-extracted output |
| `[[research/life-os-adhd/ErnieAtLYD-retrospect-ai]]` | 4 | Confidence-scored pattern detection on **moods/behavior**, not aspirations. **UX template worth stealing.** |
| `[[research/life-os-adhd/JerryZLiu-Dayflow]]` | 5,900 | Templated "morning intentions" prompts, not freeform extraction |
| `[[research/life-os-adhd/vortext-esther]]` | 47 | GBNF-constrained extraction for diary keywords/emotion. **Extraction tech worth stealing.** |
| `[[research/context-memory/khoj-ai-khoj]]` | 34,000 | Chat + RAG, no aspiration mining |
| `Journal-Tree/Journal-Tree` | 11 | Mood tracking only |
| `tripathiarpan20/self-improvement-4all` | 17 | Reflect paradigm delegates goal understanding to LLM, no dedicated extraction |
| `chris-lovejoy/personal-ai-coach` | 7 | Manual context refresh |
| `MLLANN01/BrainDump` | 5 | Extracts existing TODOs, doesn't mine for aspirations |

Plus null results for: rashadphz/brain-dump-ai, superS007/localllmjournal, NileshArnaiya/LLM-Thematic-Analysis-Tool, LLMCode, LLM-in-the-loop, Mozzo1000/daily-reflection, LangMem, MindScape, DiaryMate.

## Why this whitespace exists

Three structural reasons:

### 1. Aspiration is category-less in NLP

"Goal extraction" in NLP literature means slot-filling in task-oriented dialogue (`reset_password`, `book_flight`) or corporate OKR parsing. The personal life-aspiration category has **no benchmark dataset**, so academic researchers don't touch it and commercial apps don't ship it.

### 2. The productivity market prefers templates over inference

Notion AI, Reflect, Mem.ai, Heptabase, Dayflow — all ship prompts ("What's your intention today?") rather than mining freeform writing. Templates are deterministic; extraction is fuzzy. **Fuzzy-output products are harder to sell.** Dayflow's 5,900 stars on the templated version proves market exists without anyone extending to auto-detection.

### 3. The tech is trivial; the product insight isn't

Every technical building block exists:
- **Esther** does GBNF grammar-constrained JSON extraction
- **LangMem** does pattern reflection
- **Retrospect AI** does confidence-scored pattern detection on moods

No one has **composed** them into "aspiration detector" because nobody conceptualized aspirations as a first-class extractable entity separate from tasks/mood/themes. EMA's framing — aspirations as a distinct inbox class between fleeting thought and committed intent — is the novel product idea, not the implementation.

## Pieces to borrow from near-misses

| From | What to borrow |
|---|---|
| `[[research/life-os-adhd/ErnieAtLYD-retrospect-ai]]` | **Confidence-threshold UX**: "Pattern (Confidence: 0.85)" display idiom + adjustable slider |
| `[[research/life-os-adhd/vortext-esther]]` | **GBNF grammar-constrained JSON extraction** for reliable structured output |
| `[[research/life-os-adhd/nashsu-llm_wiki]]` | **Incremental wiki consolidation** pattern for SecondBrain |
| `[[research/life-os-adhd/JerryZLiu-Dayflow]]` | **Local-first privacy posture** + passive-signal-to-structured-memory compression |
| `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]` | **`PendingHumanReview` schema** for the confirmation queue |
| `[[research/agent-orchestration/langchain-ai-langgraph]]` | **`interrupt({message, options, context})` payload shape** |

## Strategic note

This is **low-defensibility whitespace**. Anyone with a Claude prompt can ship an aspiration detector. EMA's moat will be:

1. The **actor/intent graph context** the detector runs against — aspirations don't surface in isolation; they're scored against what the user is already working on
2. The **dispatch-to-intent conversion pipeline** — confirmed aspirations become Intents, which enter the proposal pipeline, which become Executions
3. The **privacy posture** — local LLM, journal text never leaves the machine
4. The **unified personal life-OS scope** — same detection running across journal + brain dumps + canvas comments + agent chat, not just one app

## Verdict

**EMPTY NICHE confirmed.** No GitHub repo and no published-with-code research as of 2026-04-12 implements automatic aspiration detection from freeform writing with confidence scoring.

EMA stakes the claim. See `[[DEC-003]]` for the canon decision and `[[canon/specs/BLUEPRINT-PLANNER]]` for the spec.

## Connections

- `[[research/life-os-adhd/_MOC]]`
- `[[DEC-003]]` — canon decision staking the claim
- `[[canon/specs/BLUEPRINT-PLANNER]]` — Aspirations Log spec
- `[[research/life-os-adhd/ErnieAtLYD-retrospect-ai]]` — confidence UX template
- `[[research/life-os-adhd/vortext-esther]]` — GBNF extraction template
- `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]` — PendingHumanReview schema
- `[[research/agent-orchestration/langchain-ai-langgraph]]` — interrupt primitive

#research #life-os-adhd #signal-S #empty-niche #verdict #aspiration-detection
