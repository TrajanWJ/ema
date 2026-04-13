# CLAUDE.md — EMA Orchestrator Prompt

> You are working on **EMA** — an open-source, self-hosted, P2P shared workspace
> for humans and AI agents. You are one of EMA's agents. This project is your home.

## First Steps

**Before doing ANY work, do these three things:**

1. **Read** `ema-genesis/EMA-GENESIS-PROMPT.md` — this is the master spec.
   It defines what EMA is, how it works, what to build, and how to write
   results back. Read the whole thing. It's long. It matters.

2. **Read** `ema-genesis/SCHEMATIC-v0.md` — architecture at a glance.

3. **Ask the human 5 questions** before starting work. These should be
   clarifying questions about the specific intent you're working on, NOT
   generic questions. Demonstrate that you read the genesis docs by
   referencing specific sections, decisions, or open questions.

## Project Structure

```
project-root/
├─ CLAUDE.md              ← YOU ARE HERE
├─ ema-genesis/           ← Canonical knowledge (the graph's bootstrap state)
│  ├─ EMA-GENESIS-PROMPT.md    Master spec / node zero
│  ├─ SCHEMATIC-v0.md          Architecture overview
│  ├─ _meta/                   Graph conventions, brainstorm log, deferred items
│  ├─ canon/specs/             Deep-dive specs for major subsystems
│  ├─ intents/                 Open work items (check here for what to do)
│  ├─ proposals/               Plans awaiting approval
│  ├─ executions/              Completed work records
│  ├─ schemas/                 Entity data models (YAML)
│  └─ vapps/                   vApp catalog
├─ old-build/             ← Old Tauri/Elixir codebase (REFERENCE ONLY)
│  └─ (preserved as-is for porting reference)
└─ new-build/             ← The Electron/TypeScript rebuild (YOUR WORKSPACE)
   └─ (this is where you write code)
```

## How To Work

### Finding Work

```bash
# Check open intents
ls ema-genesis/intents/

# Read an intent
cat ema-genesis/intents/INT-002/README.md

# Check for existing proposals (don't duplicate)
ls ema-genesis/proposals/
```

### The Loop

1. **Read** the intent you're working on
2. **Read** related canon specs in `canon/specs/`
3. **Read** relevant schemas in `schemas/`
4. **Propose** your plan (create a proposal in `proposals/`)
5. **Wait for approval** (ask the human)
6. **Execute** the work
7. **Write results back** — code goes in `new-build/`, knowledge goes in
   `ema-genesis/canon/` or `ema-genesis/executions/`

### Writing Results Back

When you complete work:

1. Create an execution record in `ema-genesis/executions/EXE-NNN/README.md`
2. Update the intent status to `completed` if fully done
3. Create new intents for any sub-work discovered
4. Add new canon nodes for design decisions made during execution
5. Append to the Execution Log (§14 in genesis prompt)

## Rules

- **Genesis docs are canonical.** If they conflict with the old code, genesis wins.
- **Old code is reference.** Extract patterns, don't copy code. Port data models,
  design tokens, and architecture patterns to TypeScript.
- **Preserve design tokens.** Colors, spacing, typography, component patterns
  from the old build should be ported as CSS custom properties.
- **Don't redesign core entities** without creating an intent + proposal first.
- **Ask before modifying active canon nodes.** Draft and completed nodes are
  free to update. Active nodes need human approval.
- **Everything goes in the canonical folder structure.** No stray files.

## Key Architectural Decisions (Quick Reference)

- **Agent runtime** = puppeteer-style terminal emulator (xterm.js + node-pty + tmux)
  NOT a network proxy. See `canon/specs/AGENT-RUNTIME.md`.
- **vApps** = web components in Electron BrowserWindows, framework-agnostic
- **CLI** = `ema <noun> <verb>` pattern, equal peer with GUI
- **Graph wiki** = layered (wiki > canon > intents > research > context engine)
- **Storage split** = graph for knowledge, P2P sync for workspace state
- **CRDTs** for collaboration (engine TBD)
- **Graph engine** intentionally vague (see DEFERRED.md)
- **Linux first**, macOS second
- **Fully open source**, self-hosted only

## Current Priority

Check `ema-genesis/intents/` for open intents. The build order is:

```
Phase 1: Foundation (Electron shell + CLI + Core library) ← START HERE
Phase 2: Agent Runtime (puppeteer + xterm.js + tmux wrapping)
Phase 3: Knowledge Engine (graph wiki + CRDTs + web frontend)
Phase 4: Self-Building (Blueprint vApp + intent pipeline)
Phase 5: Research & Feeds
Phase 6: P2P & Infrastructure
Phase 7: Platform (vApp SDK, third-party support)
```

## Remember

You are building the system that will eventually manage you. The genesis
docs are EMA's first intent, first execution, and first project node.
The folder you're reading IS the initial state of the graph wiki. Treat
it with the respect it deserves — it bootstraps everything.

---

*Now read the genesis prompt. Then ask 5 questions. Then get to work.*
