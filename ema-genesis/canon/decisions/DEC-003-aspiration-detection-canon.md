---
id: DEC-003
type: canon
subtype: decision
layer: canon
title: "Aspiration-detection from freeform text — empty niche, EMA stakes the claim"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-e
decided_by: human
connections:
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
  - { target: "[[research/life-os-adhd/_aspiration-detection-verdict]]", relation: derived_from }
tags: [decision, canon, aspiration-detection, empty-niche, locked, blueprint, novelty]
---

# DEC-003 — Aspiration Detection Canon Claim

> **Status:** Locked 2026-04-12 after Round 2-E verified the niche is empty.

## The Decision

EMA's Blueprint Planner Aspirations Log — automatic detection of goal-like statements ("Eventually X…", "I wish Y…", "Long-term I want to…") from freeform user writing, surfaced with confidence scores for user confirm/convert — **is genuinely novel**. No GitHub repo and no published-with-code research as of 2026-04-12 implements this pattern. EMA stakes the claim and ships it as a first-class feature.

## Verification

Round 2-E ran 16 targeted searches and directly fetched 10 candidate repos:

| Repo | Stars | Why it doesn't match |
|---|---|---|
| `nashsu/llm_wiki` | 884 | Manual goal filing — user files entries into wiki/goals/ themselves |
| `cielecki/life-navigator` | 32 | Goals are user-authored input context, not AI-extracted output |
| `ErnieAtLYD/retrospect-ai` | 4 | Confidence-scored pattern detection on **moods/behavior**, not aspirations |
| `JerryZLiu/Dayflow` | 5,900 | Templated "morning intentions" prompts, not freeform extraction |
| `vortext/esther` | 47 | GBNF-constrained extraction for diary keywords/emotion, not aspirations |
| `khoj-ai/khoj` | 34,000 | Chat + RAG, no aspiration mining |
| `Journal-Tree/Journal-Tree` | 11 | Mood tracking only |
| `tripathiarpan20/self-improvement-4all` | 17 | Reflect paradigm delegates goal understanding to LLM with no dedicated extraction |
| `chris-lovejoy/personal-ai-coach` | 7 | Manual context refresh |
| `MLLANN01/BrainDump` | 5 | Extracts existing TODOs, doesn't mine for aspirations |

Search terms tried with null results:
- `"aspiration extraction" llm`
- `"wishful thinking" detection NLP github LLM`
- `"goal extraction" freeform text LLM confidence score`
- `"I want to" "I wish" "I hope" detect LLM extract future intent`
- `"long-term goals" journal notion AI detect surface propose`
- `"smart goals" extraction freeform writing LLM conversion`
- `"values clarification" CBT AI journaling extraction llm`
- `"aspiration" AI app automatically detect propose confirm`

## Why the niche exists (and why it has stayed empty)

Three structural reasons nobody has built this:

### 1. Aspiration is category-less in NLP

"Goal extraction" in NLP literature means slot-filling in task-oriented dialogue (`reset_password`, `book_flight`) or corporate OKR parsing. The personal life-aspiration category has **no benchmark dataset**, so academic researchers don't touch it and commercial apps don't ship it.

### 2. The productivity market prefers templates over inference

Notion AI, Reflect, Mem.ai, Heptabase, Dayflow — they all ship prompts ("What's your intention today?") rather than mining freeform writing. **Templates are deterministic; extraction is fuzzy. Fuzzy-output products are harder to sell.** Dayflow has 5,900 stars doing the templated version — proving market exists without anyone extending it to auto-detection.

### 3. The tech is trivial; the product insight isn't

Every technical building block exists:
- Esther already does GBNF grammar-constrained JSON extraction
- LangMem does pattern reflection
- Retrospect AI does confidence-scored pattern detection on moods

No one has composed them into "aspiration detector" because nobody conceptualized aspirations as a **first-class extractable entity separate from tasks/mood/themes**. EMA's framing — aspirations as a distinct inbox class between fleeting thought and committed intent — is the novel product idea, not the implementation.

## Pieces to borrow from near-misses

EMA shouldn't claim it's inventing the technical primitives. The pieces:

| From | What to borrow |
|---|---|
| `ErnieAtLYD/retrospect-ai` | **Confidence-threshold UX**: "Pattern (Confidence: 0.85)" display idiom + adjustable slider. The visual treatment is the right template; just point it at aspirations instead of moods. |
| `vortext/esther` | **GBNF grammar-constrained JSON extraction** for reliable structured output. Every diary entry produces validated structured output. EMA's aspiration extractor uses the same constraint pattern. |
| `nashsu/llm_wiki` | **Incremental wiki consolidation** pattern for SecondBrain — not aspiration-specific but the right shape for "the LLM maintains the knowledge base over time." |
| `JerryZLiu/Dayflow` | **Local-first privacy posture + passive-signal-to-structured-memory compression**. Aspiration detection runs locally, never sends journal text to a cloud LLM. |
| `Significant-Gravitas/AutoGPT` | **`PendingHumanReview` schema** (from `[[research/life-os-adhd/Significant-Gravitas-AutoGPT]]` Round 2-D find) — `{payload, instructions, editable, status, wasEdited}`. Aspirations enter this queue, user taps Confirm/Dismiss/Edit, accepted aspirations become Intents. |
| `langchain-ai/langgraph` | **`interrupt({message, options, context})` payload shape** for pause-and-ask. Same primitive applied to non-code domain. |

## What EMA is actually claiming novelty on

The pitch:

> **AutoGPT's `PendingHumanReview` table applied to the aspiration domain that no one has wired it into yet.**

EMA's defensibility is **NOT** the detector itself (anyone with a Claude prompt can ship it). The moat is:

1. **The actor/intent graph context** the detector runs against — aspirations don't surface in isolation; they're scored against what the user is already working on
2. **The dispatch-to-intent conversion pipeline** — confirmed aspirations become Intents, which enter the proposal pipeline, which become Executions. The detector is one input to a system, not a standalone tool.
3. **The privacy posture** — local LLM, journal text never leaves the machine
4. **The unified personal life-OS scope** — same detection running across journal + brain dumps + chat with agents + comments on canvas, not just one app

## Implementation Phases

### Phase 1 (Bootstrap v0.1) — manual

The Aspirations Log doesn't ship in v0.1. Document the canon claim now, ship the implementation later. The current bootstrap is markdown nodes only.

### Phase 2 — naive detector

When the Blueprint vApp ships:
- LLM-based detector with a system prompt targeting aspiration patterns ("Eventually X", "I wish Y", "Long-term I want", "It would be amazing if", "Someday")
- GBNF-constrained output: `[{text, confidence, source_excerpt, suggested_intent_kind}]`
- Confidence score from LLM self-rating, displayed via Retrospect AI-style threshold UX
- Human-in-the-loop queue using AutoGPT's `PendingHumanReview` schema

### Phase 3 — context-aware detector

Once the actor/intent graph is mature:
- Detector runs against the user's existing intents — score each new aspiration for novelty (cosine distance from existing intents)
- Boost score if aspiration aligns with user's stated long-term direction
- Demote score if aspiration is fleeting or repeated weekly without follow-through

### Phase 4 — proactive surfacing

- Detector watches all text input vApps (Journal, Brain Dumps, Notes, Comms, Canvas comments)
- Background extraction with low confidence threshold for queueing
- Daily digest in the Notifications Hub

## What This Replaces in Old Build

Nothing. The old Elixir build never had an aspiration detector. The `Ema.Goals` module was scaffolded with no implementation; it's marked DROP in `[[_meta/SELF-POLLINATION-FINDINGS]]` and absorbed into the Intent system with `kind: aspiration`.

## Open Follow-Ups

1. **GBNF prompt template** — write the actual constrained-output prompt before Phase 2. Reference: `vortext/esther`'s grammar files.
2. **Local LLM model selection** — what runs the detector when the user is offline? Ollama with Llama 3.2 / Phi-3 / Qwen 2.5? Decide before Phase 2.
3. **Confidence threshold defaults** — Round 2-E found Retrospect AI uses 0.75. Start there, allow per-user tuning.
4. **Aspiration → Intent conversion ergonomics** — what fields does the user need to fill in when converting? Title and priority at minimum. Inherit category from the aspiration source vApp.
5. **Rate limiting** — does the detector run on every text save or batch nightly? Phase 2 starts with batch (cheap, low value); Phase 3 moves to event-driven.

## Connections

- `[[_meta/CANON-STATUS]]` — the ruling that says Genesis maximalist canon wins
- `[[canon/specs/BLUEPRINT-PLANNER]]` — Aspirations Log spec (this decision operationalizes its claim of novelty)
- `[[vapps/CATALOG]]` vApp 5 (Brain Dumps), vApp 12 (Journal/Log), vApp 18 (Blueprint Planner)
- `[[research/life-os-adhd/_aspiration-detection-verdict]]` — full Round 2-E verdict and evidence
- `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]` — PendingHumanReview source (Round 2-D)
- `[[research/agent-orchestration/langchain-ai-langgraph]]` — interrupt() primitive source (Round 2-D)
- `[[research/life-os-adhd/ErnieAtLYD-retrospect-ai]]` — confidence UX template
- `[[research/life-os-adhd/vortext-esther]]` — GBNF extraction template
- `[[research/life-os-adhd/JerryZLiu-Dayflow]]` — local-first journal market signal
- `[[research/life-os-adhd/nashsu-llm_wiki]]` — incremental consolidation cousin

#decision #canon #aspiration-detection #empty-niche #blueprint #novelty #locked
