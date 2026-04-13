---
id: RES-logseq-libs
type: research
layer: research
category: vapp-plugin
title: "logseq/logseq — @logseq/libs SDK pattern with global proxy + postMessage"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/logseq/logseq
  stars: 42051
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: S
tags: [research, vapp-plugin, signal-S, logseq, sdk, libs-pattern]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/laurent22-joplin]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
---

# logseq/logseq — `@logseq/libs` SDK pattern

> The plugin SDK pattern: a single npm package exporting TypeScript types + a global `logseq` namespace that proxies every call through postMessage to the host. EMA should publish `@ema/core` with the same shape.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/logseq/logseq> |
| SDK package | `@logseq/libs` |
| Stars | 42,051 (verified 2026-04-12) |
| Signal tier | **S** |

## What to steal

### 1. The SDK package shape

```typescript
import '@logseq/libs';

logseq.ready(() => {
  logseq.Editor.registerSlashCommand('My Command', async () => {
    const block = await logseq.Editor.getCurrentBlock();
    await logseq.Editor.updateBlock(block.uuid, '...');
  });
});
```

One npm package, global `logseq` namespace, typed methods, framework-agnostic. React/Svelte/Vue/vanilla all import the same package.

EMA's `@ema/core` should look the same:
```typescript
import { ema } from '@ema/core';

ema.ready(() => {
  ema.Intents.create({ title: '...', priority: 'high' });
  ema.Vault.search('keyword');
  ema.Agents.dispatch('coder', { intent_id: '...' });
});
```

### 2. Iframe isolation + postMessage proxy

Plugins run in iframes isolated from the main window. The `logseq` global is a proxy — every method call serializes to a postMessage and waits for a response. Plugin authors don't see this; they just call methods.

EMA needs `top.document` instead of `document` — a gotcha to surface in vApp dev docs.

### 3. Single-package framework-agnostic

The proof: the same `@logseq/libs` package works for plugins built in React, Vue, Svelte, or vanilla JS. The SDK provides nothing framework-specific. EMA must make the same commitment.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` | Document the `@ema/core` SDK contract per vApp |
| `SCHEMATIC-v0.md` | Add SDK layer between vApp iframe/window and EMA Core |
| `EMA-GENESIS-PROMPT.md §3` | Explicit framework-agnostic requirement |

## Gaps surfaced

- EMA canon says vApps are "framework-agnostic web components" but doesn't specify HOW they reach the EMA Core API. Without the SDK, the 35 vApps will each reinvent IPC.

## Notes

- Plugins need `top.document` instead of `document` — surface in vApp dev docs.
- ClojureScript codebase but the JS-facing SDK is plain TypeScript.

## Connections

- `[[research/vapp-plugin/laurent22-joplin]]` — process-isolation cousin
- `[[research/vapp-plugin/siyuan-note-siyuan]]` — multi-framework sample cousin
- `[[research/vapp-plugin/smapiot-piral]]` — micro-frontend cousin
- `[[vapps/CATALOG]]`

#research #vapp-plugin #signal-S #logseq #sdk #libs-pattern
