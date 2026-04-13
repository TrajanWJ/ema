---
id: MOC-cli-terminal
type: moc
layer: research
title: "CLI & Terminal — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, cli-terminal]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
---

# CLI & Terminal — Map of Content

> Repos covering CLI frameworks, Electron terminal emulators, xterm.js + node-pty integration, tmux automation, and session recording.

## Tier S

| Repo | Pattern |
|---|---|
| [[research/cli-terminal/Ark0N-Codeman\|Codeman]] | Exact EMA stack in miniature — anti-flicker pipeline |
| [[research/cli-terminal/oclif-oclif\|oclif]] | TypeScript CLI framework — recommended for `ema <noun> <verb>` |

## Tier A

| Repo | Pattern |
|---|---|
| [[research/cli-terminal/microsoft-node-pty\|node-pty]] | Pseudoterminal binding — non-negotiable dependency |
| [[research/cli-terminal/xtermjs-xterm_js\|xterm.js]] | Browser/Electron terminal emulator |
| [[research/cli-terminal/wavetermdev-waveterm\|waveterm]] | Block composition model |
| [[research/cli-terminal/vercel-hyper\|hyper]] | Canonical Electron+xterm reference |
| [[research/cli-terminal/asciinema-asciinema-player\|asciinema-player]] | Drop-in session replay |
| [[research/cli-terminal/tmux-python-libtmux\|libtmux]] | Server/Session/Window/Pane object model |

## Tier B

| Repo | Pattern |
|---|---|
| [[research/cli-terminal/Eugeny-tabby\|tabby]] | SSH client implementation reference |

## Cross-cutting takeaways

1. **The Codeman pipeline is the canonical recipe**: PTY → 16ms server batch → DEC 2026 wrap → SSE → client rAF → xterm.js. EMA should port wholesale.
2. **node-pty + xterm.js are non-negotiable** — same maintainer team (VSCode terminal), production-tested at scale.
3. **oclif beats Commander** for `ema <noun> <verb>` because the topic-tree convention scales past 30 commands.
4. **libtmux's object model + Codeman's pipeline** together give EMA the multi-agent terminal supervision layer.
5. **asciinema-player is a drop-in** for vApp 23 replay mode — no need to invent a recording format.

## Connections

- [[research/_moc/RESEARCH-MOC]]
- [[canon/specs/AGENT-RUNTIME]]
- [[research/agent-orchestration/_MOC]] — overlap on Codeman, agent_farm, ComposioHQ

#moc #research #cli-terminal
