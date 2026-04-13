# EMA Schematic — v0.2

> Architecture at a glance. Read `EMA-GENESIS-PROMPT.md` for full context.

---

## Identity

```
Name:        EMA (Executive Management Assistant — working title)
Type:        Open-source, self-hosted, P2P collaborative intelligence environment
Stack:       Electron + TypeScript (target)
Prior:       Elixir + Tauri (source — porting data models, tokens, patterns)
Knowledge:   Graph wiki with 4 layers + context engine
Agent Model: Puppeteer-style terminal emulator wrapping existing CLI agents
Platform:    35+ vApps (web components in BrowserWindows)
P2P:         Self-healing distributed mesh with host/invisible peer roles
Target OS:   Linux first, macOS second
License:     Open source, self-hosted only
```

---

## System Architecture

```
╔═══════════════════════════════════════════════════════════════════════╗
║  HUMAN SURFACE                    AGENT SURFACE                      ║
║  ─────────────                    ─────────────                      ║
║  Electron Launchpad               EMA CLI (ema <noun> <verb>)        ║
║  ├─ 35+ vApp BrowserWindows       ├─ Puppeteer Runtime ◄── THE SPINE║
║  ├─ Web Components                ├─ xterm.js + tmux/pty per agent  ║
║  ├─ Design Token System           ├─ Wraps Claude Code + Codex      ║
║  └─ Full system access            ├─ Terminal automation + inject   ║
║                                   ├─ Cross-machine dispatch          ║
║       can view ◄──────────────►  can view                           ║
║       agent workspace             human workspace                    ║
║       modify: on approval only    modify: on approval only           ║
║                                                                      ║
╠═══════════════════════════════════════════════════════════════════════╣
║                          EMA CORE (TypeScript)                       ║
║  CLI ────┐                                                           ║
║          ├──▶ Graph Wiki │ P2P Sync │ Agent Runtime │ vApp Host      ║
║  GUI ────┘    Research   │ Comms    │ Infra Manager │ Notifications  ║
╠═══════════════════════════════════════════════════════════════════════╣
║  KNOWLEDGE                        STORAGE SPLIT                      ║
║  ──────────                       ─────────────                      ║
║  Wiki (human views, web frontend) Graph → knowledge, intents,        ║
║  Canon (ground truth)                     research, exec history     ║
║  Intents (goals, work)            P2P ──→ workspace state, vApp      ║
║  Research (ingested external)             data, CLI history, machine ║
║  Context Engine (underneath all)          state, org membership      ║
║    └─ embeddings, dedup, LLM health                                  ║
╠═══════════════════════════════════════════════════════════════════════╣
║  P2P MESH                                                            ║
║  ────────                                                            ║
║  Peers: regular │ host (more resources, routes AI) │ invisible       ║
║  Spaces: org > team > project (nesting)                              ║
║  Services: auto-redistribute on failure, self-healing                ║
║  Dispatch: any agent → any tool → any machine in network             ║
║  Auth: invite codes / shared secrets (for now)                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## Layer Stack

```
         ┌─────────────────────────────────────┐
         │            WIKI                      │  ◄── human views, web frontend
         ├─────────────────────────────────────┤
         │         CANON LAYER                  │  ◄── ground truth
         ├─────────────────────────────────────┤
         │        INTENTS LAYER                 │  ◄── goals, work
         ├─────────────────────────────────────┤
         │       RESEARCH LAYER                 │  ◄── ingested content
         ├─────────────────────────────────────┤
         │     CONTEXT GRAPH ENGINE             │  ◄── stores all efficiently
         │  embeddings │ dedup │ LLM health     │      auto-charts, compaction
         └─────────────────────────────────────┘
```

---

## Agent Runtime Flow

```
Electron BrowserWindow (Agent Live View)
└─ xterm.js terminal emulator
   └─ tmux session (one per agent)
      └─ Claude Code / Codex running inside
         └─ EMA puppeteer controller
            ├─ Reads terminal output
            ├─ Injects context / commands
            ├─ Records session (replay + logs)
            ├─ Enforces approval gates
            └─ Has full sudo access

Wrapping:
  1. Detect installed CLI agents
  2. Ingest config dirs (.claude/, .cursor/, .superpowers/)
  3. Launch in tmux sessions inside xterm.js
  4. Control via puppeteer-style terminal automation
  5. Dispatch via EMA virtual CLI
```

---

## Blueprint vApp (Planning Engine)

```
┌─────────────────────────────────────────────┐
│  GAC QUEUE                                   │
│  Auto-generated cards:                       │
│  Gaps │ Assumptions │ Clarifications         │
│  Pre-filled answers: [A][B][C][D] + [1][2]  │
├─────────────────────────────────────────────┤
│  BLOCKERS QUEUE                              │
│  Tricky questions │ Deferred │ Dependencies  │
├─────────────────────────────────────────────┤
│  ASPIRATIONS LOG                             │
│  LLM auto-detect + manual tag                │
│  Feeds back into intent generation           │
├─────────────────────────────────────────────┤
│  INTENT GRAPH VIEW                           │
│  Visual map of all intents + connections     │
└─────────────────────────────────────────────┘
```

---

## Self-Building Loop

```
READ (canon + intents) → IDENTIFY (gaps, GAC queue) → PROPOSE (agent)
  ▲                                                        │
  │                                                        ▼
  └── WRITE BACK (results → canon) ◄── EXECUTE ◄── APPROVE (human)
                                         │
                              aspirations extracted → new intents
```

---

## Build Order

```
Phase   Focus                    Key Outputs
─────   ─────                    ───────────
  0     Genesis ✓                This document, schemas, folder structure
  1     Foundation               Electron shell, CLI router, Core library, design tokens
  2     Agent Runtime            Puppeteer + xterm.js, tmux, Claude Code + Codex
  3     Knowledge Engine         Graph wiki, CRDT collab, web frontend, search
  4     Self-Building            Blueprint vApp, intent pipeline, EMA builds EMA
  5     Research & Feeds         Ingestion pipeline, dedup, Feeds vApp, MCP
  6     P2P & Infrastructure     Sync, host/invisible peers, distributed services
  7     Platform                 vApp SDK, git install, third-party support
```

---

## Entity Model

```
Space ──contains──▶ Nodes (on layers)
Space ──has──▶ Humans + Agents (members)
Space ──nests──▶ org > team > project

Intent ──fulfilled by──▶ Proposal
Proposal ──produces──▶ Execution
Execution ──writes to──▶ Canon nodes
Execution ──updates──▶ Intent status

Human ←──mutual visibility──▶ Agent
Agent ──dispatches──▶ Agent (through graph)
Agent ──invokes──▶ CLI tools (any machine in network)
```

---

*Schematic v0.2 — living document. Updates via proposal/execution pipeline.*
