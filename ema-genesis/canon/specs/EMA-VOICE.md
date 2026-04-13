---
id: CANON-EMA-VOICE
type: spec
layer: canon
title: "EMA Voice — CLI register, error copy, distinctive naming, semantic slugs"
status: active
created: 2026-04-12
updated: 2026-04-12
author: recovery-wave-1
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: derived_from }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
tags: [spec, canon, voice, attitude, copy, naming]
---

# EMA Voice

> Codifies the personality recovered from the old Elixir + Tauri build (`[[_meta/SELF-POLLINATION-FINDINGS]]` Appendix A.11) so future agents writing user-facing copy, CLI output, error messages, and module names stay in register.

## Prime directives

1. **No apologies.** EMA does not say "sorry", "oops", or "unfortunately." Errors are directive: state the condition, then the next action.
2. **No exclamation marks.** The voice is calm, technical, adult. Excitement is conveyed by precision, not punctuation.
3. **No filler phrases.** Never "Great!", "Absolutely!", "I'd be happy to!". Do the work.
4. **Action-first over explanation-first.** `Retry now` beats `You can retry by clicking here`.
5. **Distinctive names over generic nouns.** See §Names.

## CLI printer register

From Appendix A.11 of the findings doc:

```
error:   \e[31mError: <condition>\e[0m
success: \e[32m<what happened>\e[0m
warn:    \e[33m<concern>\e[0m
info:    plain text, no color
```

**Error example (good):**
```
Error: daemon not running on :4488
Start it: pnpm -w dev
```

**Error example (bad):**
```
❌ Oops! Something went wrong trying to reach the daemon. Please make sure it's running.
```

**Success example (good):**
```
Created pipe brain-dump-to-tasks (id: pipe-41)
```

**Success example (bad):**
```
✅ Successfully created your new pipe! 🎉
```

## Status and progress copy

When the system is working, say so in one word. Not a sentence.

| Condition | Copy |
|---|---|
| Thinking | `Thinking...` |
| Searching | `Searching...` |
| Retrying | `Retrying...` |
| Connecting | `Connecting to daemon...` |
| Retry attempt N | `Waiting for daemon on :4488... (attempt N)` |

No progress emojis. No spinners as copy. No "Please wait while we..."

## Empty-state copy

Short. Factual. No apology. Hint at the next action only if the action is non-obvious.

| Scope | Good | Bad |
|---|---|---|
| Task list | `No tasks` | `You don't have any tasks yet! Create one to get started.` |
| Session list | `No completed sessions yet` | `Looks like you haven't completed any sessions. Start one to see them here!` |
| Command palette | `Search across tasks, intents, wiki, proposals, and brain dumps` | `Type something to search!` |
| Search results | `No results for "<query>"` | `We couldn't find anything matching your search. Try different keywords!` |

## Names

EMA uses distinctive, specific character names for subsystems that would otherwise be generic. These are not cosmetic — they make module boundaries memorable, they give humans a hook for recall, and they give agents a vocabulary that distinguishes "the Combiner did this" from "the generic cross-reference service did this."

| Name | What it is | Why this name |
|---|---|---|
| **Parliament** | Multi-voice debate system (steelman / red-team / synthesis) | It's literally a debating chamber. Keep. |
| **Combiner** | Cross-pollination seed synthesizer, creates proposals from overlapping tags | It combines. |
| **SuperMan** | Intelligence layer CLI (`ema superman ask/context/health/index/gaps/flows`). Prints `Thinking...` | User's prior reference. Keep — it's their term of art. |
| **Composer** | InkOS-pattern wrapper that writes inspectable artifacts to disk before every LLM call | It composes the artifact before the spend. |
| **Babysitter** | Visibility hub monitoring active topics and state changes | It watches everything. |
| **KillMemory** | Proposal rejection lineage tracker | It remembers what got killed. |
| **Genealogy** | Proposal ancestry viewer (multi-generation lineage) | Literal. |
| **Intention Farmer** | Multi-source intent harvester (vault, git commits, channels) | Harvests intents like crops. |
| **Vault Seeder** | Scans markdown for TODOs / unchecked items → auto-seeds proposals | Seeds the pipeline. |
| **Blueprint Planner** | The meta-vApp that runs the GAC queue | The tool that designs all other tools. |

**Rule:** when adding a new subsystem, prefer a distinctive one-word name over a generic compound noun. `Reflexion` over `ExecutionHistoryInjector`. `Composer` over `LLMArtifactWrapper`. If a name is already taken in a well-known tool, don't steal it — pick something adjacent.

## Identifier formats

### Semantic kebab slugs for intents, GAC cards, and proposals

Intent slug format (from Appendix A.6):

```
calendar-april-2026-this-week-daily-5-minute-ritual-mo
```

Long, human-readable, not opaque IDs. This is intentional. The slug is how humans find the folder in `.superman/intents/` without a lookup table. Slugs:

- lowercase, hyphens only
- no abbreviations unless universally known
- may be long — clarity beats brevity
- immutable once assigned

### Numeric IDs for canon decisions and research

`DEC-NNN`, `INT-NNN`, `GAC-NNN`, `BLOCK-NNN`, `ASP-NNN`, `EXE-NNN` — three-digit zero-padded, assigned monotonically.

## Copy voice for vApps

vApps inherit this voice. When adding a new vApp, its empty-state, error copy, and button labels must pass the voice tests above. Examples of voice-compliant labels recovered from the old build:

- Buttons: `Retry now`, `Open`, `Close`, `Kill`, `Approve`, `Reject`, `Defer`
- Headers: `Session History` (uppercase tracking-wider), `No completed sessions yet`
- Help hints: `Make sure the daemon is running: cd daemon && mix phx.server` (adapt path for new build)

## What This Enforces

- Future LLM agents writing user-facing strings reference this doc before producing copy.
- PR review for user-facing copy checks: no emojis, no exclamation marks, no apologies, no filler, no generic names where a distinctive one would do.
- Distinctive subsystem names are a first-class design concern, not an afterthought.

## Connections

- `[[_meta/SELF-POLLINATION-FINDINGS]]` Appendix A.11 — voice source material
- `[[canon/specs/BLUEPRINT-PLANNER]]` — meta-vApp that uses this voice
- `[[canon/specs/EMA-V1-SPEC]]` — v1 scope these conventions apply to
- `[[intents/INT-RECOVERY-WAVE-1/README]]` — recovery wave that locked this

#spec #canon #voice #attitude #copy #naming #recovery-wave-1
