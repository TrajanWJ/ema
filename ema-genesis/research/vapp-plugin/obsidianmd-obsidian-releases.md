---
id: RES-obsidian-releases
type: research
layer: research
category: vapp-plugin
title: "obsidianmd/obsidian-releases — community plugin registry via PR-to-JSON"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/obsidianmd/obsidian-releases
  stars: 16434
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, vapp-plugin, signal-S, obsidian, registry, pr-workflow]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/ferdium-ferdium-app]]", relation: references }
---

# obsidianmd/obsidian-releases

> The registry repo for Obsidian's community plugin ecosystem. Every plugin is a GitHub repo with tagged releases containing `manifest.json + main.js + styles.css`. **Submission is a PR to community-plugins.json.** No server. GitHub IS the database.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/obsidianmd/obsidian-releases> |
| Stars | 16,434 (verified 2026-04-12) |
| Last activity | 2026-04-12 (very active — community submissions daily) |
| Signal tier | **S** |

## What to steal

### 1. PR-to-JSON registration flow

```json
// community-plugins.json
[
  {
    "id": "obsidian-dataview",
    "name": "Dataview",
    "author": "blacksmithgu",
    "description": "...",
    "repo": "blacksmithgu/obsidian-dataview"
  },
  ...
]
```

Third-party plugin authors submit a PR adding their entry. Core team reviews, merges, users install via the in-app browser. **No server. No database. GitHub is the registry.**

EMA should run an `ema-vapps` registry repo with the same pattern. Submit a PR to `vapps.json`. Reviewer (or automation) merges. Users `ema vapp install <id>` resolves to the GitHub repo.

### 2. Tagged release convention

Plugins ship `manifest.json` + `main.js` + `styles.css` via GitHub Releases. Versions are git tags. The in-app installer fetches from the release URL, not from a build artifact server.

EMA's `ema vapp install <id>` resolves to:
1. Look up `id` in `vapps.json` registry → get `repo`
2. Fetch latest release from `https://api.github.com/repos/<repo>/releases/latest`
3. Download release assets to `~/.local/share/ema/vapps/<slug>/`

### 3. Trust boundary via review

Core team reviews each PR. Catches malicious plugins before merge. The `vapps.json` is the trust list.

For EMA: a small trusted set ships in the official registry; users can install from arbitrary git URLs at their own risk.

### 4. Stars + downloads as social proof

Obsidian shows star count + download count in the in-app browser. EMA should surface the same metadata in the Launchpad's "Browse vApps" view.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §3` | Add "third-party vApps" distribution phase with PR-to-registry trust boundary |
| `SCHEMATIC-v0.md` | Add registry repo concept |

## Gaps surfaced

- EMA says "eventually third-party vApps" but doesn't specify the trust boundary. Obsidian's review-by-PR model is a concrete, low-infrastructure answer. **No server needed — GitHub is the database.**

## Notes

- 16k stars on the registry repo alone. Production pattern.
- Combined with `[[research/vapp-plugin/ferdium-ferdium-app]]`'s recipe pattern, EMA gets the full third-party vApp story for free.

## Connections

- `[[research/vapp-plugin/ferdium-ferdium-app]]` — recipe-per-git-dir cousin
- `[[research/vapp-plugin/laurent22-joplin]]` — manifest cousin
- `[[vapps/CATALOG]]`

#research #vapp-plugin #signal-S #obsidian #registry #pr-workflow
