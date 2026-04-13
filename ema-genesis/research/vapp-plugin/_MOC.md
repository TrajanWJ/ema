---
id: MOC-vapp-plugin
type: moc
layer: research
title: "vApp & Plugin Architecture — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-13
author: system
tags: [moc, research, vapp-plugin]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
---

# vApp & Plugin Architecture — Map of Content

> Repos covering Electron multi-window app shells, plugin runtimes with isolation, manifest formats, design token systems, IPC patterns, and micro-frontend frameworks.

## Tier S

| Repo | Pattern |
|---|---|
| [[research/vapp-plugin/laurent22-joplin\|joplin]] | Per-plugin BrowserWindow + iframe sandbox |
| [[research/vapp-plugin/logseq-logseq\|logseq @libs]] | SDK package + global proxy |
| [[research/vapp-plugin/siyuan-note-siyuan\|siyuan]] | plugin.json manifest + multi-framework samples |
| [[research/vapp-plugin/ferdium-ferdium-app\|ferdium]] | Recipe-per-git-dir distribution |
| [[research/vapp-plugin/obsidianmd-obsidian-releases\|obsidian-releases]] | Registry via PR-to-JSON |
| [[research/vapp-plugin/alex8088-electron-vite\|electron-vite]] | Main/preload/renderer structure |

## Tier A

| Repo | Pattern |
|---|---|
| [[research/vapp-plugin/argyleink-open-props\|open-props]] | Multi-format design tokens |
| [[research/vapp-plugin/style-dictionary-style-dictionary\|style-dictionary]] | Token build pipeline |
| [[research/vapp-plugin/electron-react-boilerplate-electron-react-boilerplate\|ERB]] | Typed IPC pattern |
| [[research/vapp-plugin/smapiot-piral\|piral]] | pilet + shell API micro-frontend |
| [[research/vapp-plugin/tokens-studio-figma-plugin\|tokens-studio]] | DTCG JSON format |
| [[research/vapp-plugin/ysz7-Arcforge\|Arcforge]] | graph-first backend IDE + architecture JSON + rollback-backed forge |

## Cross-cutting takeaways

1. **EMA needs `@ema/core` SDK** following Logseq's `@logseq/libs` shape — single package, global proxy, framework-agnostic.
2. **Two-layer isolation**: process-level (Joplin per-plugin BrowserWindow) + UI-level (sandboxed iframe). Both required for third-party vApps.
3. **Distribution** = git-installable recipes (Ferdium pattern) + PR-to-registry (Obsidian pattern).
4. **Design tokens** become a multi-format package: Open Props now → Style Dictionary when cross-platform needed → DTCG JSON for Figma interop.
5. **Typed IPC is mandatory** (ERB pattern). Without it, the SDK decays into stringly-typed proxies.
6. **electron-vite** is the build tool that fits the BrowserWindow-per-vApp model.
7. **Graph-first architecture surfaces should separate parse plugins from write blueprints.** Arcforge's plugin parser + Forge split is the right kind of seam, even if its current sandboxing is too permissive.
## Connections

- [[research/_moc/RESEARCH-MOC]]
- [[vapps/CATALOG]]
- [[canon/specs/EMA-GENESIS-PROMPT]] §3

#moc #research #vapp-plugin
