# EMA Recon Report

Generated on 2026-04-12 from the live monorepo at `/home/trajan/Projects/ema`.

This report is code-first. It was built from package manifests, source files, service/router registrations, the `ema-genesis/` filesystem, build/test execution, and local agent state on disk. The worktree was already dirty before this session; all findings below reflect that baseline.

## Executive Snapshot

- The active pnpm workspace is a 10-package TypeScript/Electron monorepo. Three additional packages exist in-tree but sit outside `pnpm-workspace.yaml`: `agent-runtime/`, `hq-api/`, and `hq-frontend/`.
- Current root build is not green. `pnpm build` fails in `@ema/platform`; individual package builds also show a second hard failure in `@ema/tools`.
- `@ema/services` is the only workspace package with tests, and it is healthy: 11 suites, 112 tests, all passing.
- The canon is large but split cleanly: the true first-party graph is compact, while `ema-genesis/research/_clones/` contains 189,560 vendored research files from external repos.
- The renderer exposes 28 launchable routes, but its store surface is much larger: 75 stores, with only a minority aligned to currently registered backend routes/channels.
- The old build was materially richer than the current CLI and orchestration surface: 90 CLI command groups, a 21-trigger / 21-action / 5-transform pipes registry, and much broader domain coverage.
- The local agent ecosystem is active. `~/.claude` and `~/.codex` both show heavy recent EMA activity, and the repo also contains project-local `.claude`, `.superman`, and `.superpowers` state.

## Step 1 — Map The Topology

### Workspace Packages

| Package | Dir | Internal deps declared | Internal imports observed | Scripts |
| --- | --- | --- | --- | --- |
| `@ema/electron` | `apps/electron` | none | none | `build:main`, `build`, `dist`, `start` |
| `@ema/renderer` | `apps/renderer` | none | none | `dev`, `build`, `lint`, `preview` |
| `@ema/cli` | `cli` | none | none | `build`, `dev`, `start`, `prepack` |
| `@ema/platform` | `platform` | none | none | `build` |
| `@ema/services` | `services` | `@ema/shared` | `@ema/shared/schemas` | `dev`, `build`, `test` |
| `@ema/shared` | `shared` | none | none | `build`, `typecheck` |
| `@ema/tokens` | `shared/tokens` | none | none | `build`, `typecheck` |
| `@ema/glass` | `shared/glass` | `@ema/tokens` (peer/dev) | none | `typecheck` |
| `@ema/tools` | `tools` | none | none | `extract`, `parity`, `build` |
| `@ema/workers` | `workers` | none | none | `dev`, `build` |

### Workspace-External Package Roots Present In Tree

These are real Node packages in the repo, but pnpm does not manage them from the root workspace.

| Package | Dir | Notes |
| --- | --- | --- |
| `hq-agent-runtime` | `agent-runtime` | Separate TypeScript runtime package, not in `pnpm-workspace.yaml` |
| `hq-api` | `hq-api` | Separate Express API, not in workspace |
| `hq-frontend` | `hq-frontend` | Separate Vite frontend, not in workspace |
| `IGNORE_OLD_TAURI_BUILD/app` | `IGNORE_OLD_TAURI_BUILD/app` | Historical build artifact, intentionally excluded |

### Package Manifests

All `package.json` files discovered under the repo:

```text
agent-runtime/package.json
apps/electron/package.json
apps/renderer/package.json
cli/package.json
hq-api/package.json
hq-frontend/package.json
package.json
platform/package.json
services/package.json
shared/glass/package.json
shared/package.json
shared/tokens/package.json
tools/package.json
workers/package.json
IGNORE_OLD_TAURI_BUILD/app/package.json
IGNORE_OLD_TAURI_BUILD/daemon/priv/mcp/package.json
```

### `pnpm ls --depth=0` Findings

- All workspace package dependency trees resolve.
- Only two internal workspace links are visible in dependency metadata:
  - `@ema/services -> @ema/shared`
  - `@ema/glass -> @ema/tokens`
- The source import graph is even thinner than the manifest graph:
  - only `services/` currently imports `@ema/shared/*`

### Dependency Graph Table

| From | To | Evidence |
| --- | --- | --- |
| `@ema/services` | `@ema/shared` | Declared workspace dependency and source imports from `@ema/shared/schemas` |
| `@ema/glass` | `@ema/tokens` | Peer/dev dependency in `shared/glass/package.json` |
| `@ema/renderer` | none | No workspace package deps or imports observed |
| `@ema/cli` | none | No workspace package deps or imports observed |
| `@ema/workers` | none | No workspace package deps or imports observed |
| `@ema/platform` | none | No workspace package deps or imports observed |
| `@ema/electron` | none | No workspace package deps or imports observed |
| `@ema/shared` | none | Leaf package |
| `@ema/tokens` | none | Leaf package |
| `@ema/tools` | none | Leaf package |

## Step 2 — Find The Living Code

### Root Build Result

`pnpm build` at the repo root currently fails.

Observed failure:

- `@ema/platform#build` fails with TypeScript module-resolution errors:
  - `src/autostart.ts`: cannot find `node:module`
  - `src/shortcuts.ts`: cannot find `node:module`
  - `src/tray.ts`: cannot find `node:path`, `node:url`, `node:module`
- Turbo stops on first failure, so the root build does not prove the health of later packages.

### Individual Package Build Results

Running package builds individually shows the real matrix:

- Passing: `apps/electron`, `apps/renderer`, `cli`, `services`, `shared`, `shared/tokens`, `workers`, `shared/glass` (`typecheck`)
- Failing:
  - `platform`: bad TS configuration for Node built-in module specifiers
  - `tools`: `src/parity-check.ts` contains a block comment with the literal `*/` sequence in `services/core/*/router.ts`, which prematurely terminates the comment and causes parser errors

### Test Results

- `@ema/services`: `pnpm --filter @ema/services test -- --run`
  - 11 test files
  - 112 tests
  - all passing
- No other workspace package currently contains tests by file scan.

### Health Matrix

| Package | `.ts` | `.tsx` | Entry point | Tests | Build | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `@ema/electron` | 4 | 0 | `main.ts` -> `dist/main.js` | none | pass | Desktop host |
| `@ema/renderer` | 114 | 250 | `src/main.tsx` | none | pass | Builds with large chunk warning only |
| `@ema/cli` | 16 | 0 | `bin/run.js` / `src/index.ts` | none | pass | Very small current command surface |
| `@ema/platform` | 3 | 0 | no single index; library modules under `src/` | none | fail | TS cannot resolve `node:*` built-ins |
| `@ema/services` | 140 | 0 | `startup.ts` | 11 files | pass | Healthy service/test surface |
| `@ema/shared` | 54 | 25 | `index.ts` -> `dist/index.js` | none | pass | Schema/contracts/sdk bundle |
| `@ema/tokens` | 11 | 0 | `build.ts` | none | pass | Emits CSS/JSON/TS design tokens |
| `@ema/glass` | 18 | 25 | `src/index.ts` | none | pass (`typecheck`) | Component kit, no build script |
| `@ema/tools` | 2 | 0 | `src/extract-contracts.ts`, `src/parity-check.ts` | none | fail | Comment terminator bug in `parity-check.ts` |
| `@ema/workers` | 8 | 0 | `src/worker-manager.ts`, `src/startup.ts` | none | pass | Watchers/worker runtime compile |

## Step 3 — Read The Canon

### Canon State Counts

| Subtree | File count | Notes |
| --- | --- | --- |
| `ema-genesis/canon` | 23 | 8 decisions + 15 specs |
| `ema-genesis/executions` | 6 | 6 execution records |
| `ema-genesis/intents` | 32 | 31 intent directories + `GAC-QUEUE-MOC.md` |
| `ema-genesis/_meta` | 12 | Meta status and audit docs |
| `ema-genesis/vapps` | 1 | `CATALOG.md` |
| `ema-genesis/research` | 189,560 | Dominated by vendored `_clones/` corpus |

### File Inventory

This is the complete first-party `ema-genesis/` file inventory excluding the internals of vendored research clones. The clone corpus is listed separately by repo and file count because a literal path-by-path dump would add 189,560 mostly external files and bury the canonical graph.

```text
ema-genesis/BOOTSTRAP-V0.1.md
ema-genesis/CLAUDE.md
ema-genesis/EMA-GENESIS-PROMPT.md
ema-genesis/SCHEMATIC-v0.md
ema-genesis/_meta/BLUEPRINT-REALITY-DISCREPANCIES.md
ema-genesis/_meta/CANON-DIFFS.md
ema-genesis/_meta/CANON-STATUS.md
ema-genesis/_meta/CLI-PARITY-GAP-2026-04-12.md
ema-genesis/_meta/DOC-TRUST-HIERARCHY.md
ema-genesis/_meta/INFRASTRUCTURE-STATUS.md
ema-genesis/_meta/METAPROJECT-BOOTSTRAP-LOG-2026-04-06.md
ema-genesis/_meta/PROJECT-EMA-SUMMARY.md
ema-genesis/_meta/QUALITY-METRICS-SCHEMA.md
ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md
ema-genesis/_meta/STACK-SUMMARY.md
ema-genesis/_meta/VAPP-RECONCILIATION-TABLE.md
ema-genesis/canon/decisions/DEC-001-graph-engine.md
ema-genesis/canon/decisions/DEC-002-crdt-filesync-split.md
ema-genesis/canon/decisions/DEC-003-aspiration-detection-canon.md
ema-genesis/canon/decisions/DEC-004-gac-card-backend.md
ema-genesis/canon/decisions/DEC-005-actor-phases.md
ema-genesis/canon/decisions/DEC-006-deferred-cli-features.md
ema-genesis/canon/decisions/DEC-007-unified-intents-schema.md
ema-genesis/canon/decisions/DEC-008-daily-validation-ritual.md
ema-genesis/canon/specs/ACTOR-WORKSPACE-SYSTEM.md
ema-genesis/canon/specs/AGENT-RUNTIME.md
ema-genesis/canon/specs/BABYSITTER-SYSTEM.md
ema-genesis/canon/specs/BLUEPRINT-PLANNER.md
ema-genesis/canon/specs/EMA-CORE-PROMPT.md
ema-genesis/canon/specs/EMA-V1-SPEC.md
ema-genesis/canon/specs/EMA-VOICE.md
ema-genesis/canon/specs/EXECUTION-SYSTEM.md
ema-genesis/canon/specs/PIPES-SYSTEM.md
ema-genesis/canon/specs/PROPOSAL-QUALITY-GATE.md
ema-genesis/canon/specs/PROPOSAL-TEMPLATES.md
ema-genesis/canon/specs/agents/AGENT-ARCHIVIST.md
ema-genesis/canon/specs/agents/AGENT-COACH.md
ema-genesis/canon/specs/agents/AGENT-STRATEGIST.md
ema-genesis/canon/specs/agents/_MOC.md
ema-genesis/executions/EXE-001-gac-schema-stubs/README.md
ema-genesis/executions/EXE-002-canon-id-collisions/README.md
ema-genesis/executions/EXE-003-intents-port/README.md
ema-genesis/executions/EXE-003-recovery-wave-full/README.md
ema-genesis/executions/EXE-EMA-FULL-SYSTEMS-AUDIT-2026-04-06/README.md
ema-genesis/executions/EXE-LAUNCHPADHQ-EXPANSION-2026-04-06/README.md
ema-genesis/intents/GAC-001/README.md
ema-genesis/intents/GAC-002/README.md
ema-genesis/intents/GAC-003/README.md
ema-genesis/intents/GAC-004/README.md
ema-genesis/intents/GAC-005/README.md
ema-genesis/intents/GAC-006/README.md
ema-genesis/intents/GAC-007/README.md
ema-genesis/intents/GAC-008/README.md
ema-genesis/intents/GAC-009/README.md
ema-genesis/intents/GAC-010/README.md
ema-genesis/intents/GAC-QUEUE-MOC.md
ema-genesis/intents/INT-AGENT-COLLABORATION/README.md
ema-genesis/intents/INT-AUTONOMOUS-REASONING-PHASE3/README.md
ema-genesis/intents/INT-CANON-REPAIR-CANON-STATUS-INDEX/README.md
ema-genesis/intents/INT-CANON-REPAIR-CLAUDE-MD/README.md
ema-genesis/intents/INT-CANON-REPAIR-CROSSREF-AFTER-EXE-002/README.md
ema-genesis/intents/INT-CANON-REPAIR-DEC-007-STATUS-UPGRADE/README.md
ema-genesis/intents/INT-CANON-REPAIR-IMPLEMENTATION-STATUS/README.md
ema-genesis/intents/INT-CANON-REPAIR-V1-SPEC-HEADER/README.md
ema-genesis/intents/INT-DAILY-VALIDATION-RITUAL/README.md
ema-genesis/intents/INT-EXECUTION-DISPATCHER/README.md
ema-genesis/intents/INT-FEEDBACK-LOOP-INTEGRATION/README.md
ema-genesis/intents/INT-FRONTEND-VAPP-RECONCILIATION/README.md
ema-genesis/intents/INT-INTENTIONS-SCHEMATIC-ENGINE/README.md
ema-genesis/intents/INT-KNOWLEDGE-COMPILATION-LAYER/README.md
ema-genesis/intents/INT-NERVOUS-SYSTEM-WIRING/README.md
ema-genesis/intents/INT-P2P-FEDERATED-SYNC/README.md
ema-genesis/intents/INT-PROPOSAL-PIPELINE/README.md
ema-genesis/intents/INT-RECOVERY-WAVE-1/README.md
ema-genesis/intents/INT-SKILLS-ECOSYSTEM/README.md
ema-genesis/intents/INT-SPRINT-2026-04-07/README.md
ema-genesis/intents/INT-TASK-MASTER-STEALS/README.md
ema-genesis/research/_extractions/Ark0N-Codeman.md
ema-genesis/research/_extractions/Kodaxadev-Task-Anchor-MCP.md
ema-genesis/research/_extractions/Significant-Gravitas-AutoGPT.md
ema-genesis/research/_extractions/_TEMPLATE.md
ema-genesis/research/_extractions/element-hq-synapse.md
ema-genesis/research/_extractions/iwe-org-iwe.md
ema-genesis/research/_extractions/matrix-org-dendrite.md
ema-genesis/research/_extractions/matrix-org-matrix-spec-proposals.md
ema-genesis/research/_extractions/microsoft-node-pty.md
ema-genesis/research/_extractions/oclif-oclif.md
ema-genesis/research/_extractions/silverbulletmd-silverbullet.md
ema-genesis/research/_moc/RESEARCH-MOC.md
ema-genesis/research/agent-orchestration/ComposioHQ-agent-orchestrator.md
ema-genesis/research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm.md
ema-genesis/research/agent-orchestration/Dicklesworthstone-coding_agent_session_search.md
ema-genesis/research/agent-orchestration/Dicklesworthstone-ntm.md
ema-genesis/research/agent-orchestration/Significant-Gravitas-AutoGPT.md
ema-genesis/research/agent-orchestration/_MOC.md
ema-genesis/research/agent-orchestration/ai_automation_suggester.md
ema-genesis/research/agent-orchestration/cadence-workflow-cadence.md
ema-genesis/research/agent-orchestration/dagger-container-use.md
ema-genesis/research/agent-orchestration/danielmiessler-Personal_AI_Infrastructure.md
ema-genesis/research/agent-orchestration/dbos-inc-dbos-transact-ts.md
ema-genesis/research/agent-orchestration/generalaction-emdash.md
ema-genesis/research/agent-orchestration/gotohuman-mcp-server.md
ema-genesis/research/agent-orchestration/inngest-inngest.md
ema-genesis/research/agent-orchestration/jayminwest-overstory.md
ema-genesis/research/agent-orchestration/langchain-ai-langgraph.md
ema-genesis/research/agent-orchestration/maybe-finance-maybe.md
ema-genesis/research/agent-orchestration/n8n-io-n8n.md
ema-genesis/research/agent-orchestration/open-webui-open-webui.md
ema-genesis/research/agent-orchestration/restatedev-restate.md
ema-genesis/research/agent-orchestration/roboticforce-sugar.md
ema-genesis/research/agent-orchestration/sakowicz-actual-ai.md
ema-genesis/research/agent-orchestration/shep-ai-shep.md
ema-genesis/research/agent-orchestration/temporalio-temporal.md
ema-genesis/research/agent-orchestration/triggerdotdev-trigger-dev.md
ema-genesis/research/agent-orchestration/windmill-labs-windmill.md
ema-genesis/research/cli-terminal/Ark0N-Codeman.md
ema-genesis/research/cli-terminal/Eugeny-tabby.md
ema-genesis/research/cli-terminal/_MOC.md
ema-genesis/research/cli-terminal/asciinema-asciinema-player.md
ema-genesis/research/cli-terminal/microsoft-node-pty.md
ema-genesis/research/cli-terminal/oclif-oclif.md
ema-genesis/research/cli-terminal/tmux-python-libtmux.md
ema-genesis/research/cli-terminal/vercel-hyper.md
ema-genesis/research/cli-terminal/wavetermdev-waveterm.md
ema-genesis/research/cli-terminal/xtermjs-xterm_js.md
ema-genesis/research/context-memory/BerriAI-litellm.md
ema-genesis/research/context-memory/HKUDS-LightRAG.md
ema-genesis/research/context-memory/MemoriLabs-Memori.md
ema-genesis/research/context-memory/Paul-Kyle-palinode.md
ema-genesis/research/context-memory/_MOC.md
ema-genesis/research/context-memory/aiming-lab-SimpleMem.md
ema-genesis/research/context-memory/getzep-graphiti.md
ema-genesis/research/context-memory/letta-ai-letta.md
ema-genesis/research/context-memory/mem0ai-mem0.md
ema-genesis/research/context-memory/thedotmack-claude-mem.md
ema-genesis/research/context-memory/topoteretes-cognee.md
ema-genesis/research/frontend-patterns/_MOC.md
ema-genesis/research/frontend-patterns/dual-surface-shell.md
ema-genesis/research/frontend-patterns/glass-design-tokens.md
ema-genesis/research/frontend-patterns/launchpad-one-thing-card.md
ema-genesis/research/frontend-patterns/task-master-patterns.md
ema-genesis/research/knowledge-graphs/SkepticMystic-breadcrumbs.md
ema-genesis/research/knowledge-graphs/_MOC.md
ema-genesis/research/knowledge-graphs/blacksmithgu-obsidian-dataview.md
ema-genesis/research/knowledge-graphs/cozodb-cozo.md
ema-genesis/research/knowledge-graphs/foambubble-foam.md
ema-genesis/research/knowledge-graphs/hedgedoc-hedgedoc.md
ema-genesis/research/knowledge-graphs/iwe-org-iwe.md
ema-genesis/research/knowledge-graphs/jackyzha0-quartz.md
ema-genesis/research/knowledge-graphs/logseq-logseq.md
ema-genesis/research/knowledge-graphs/reorproject-reor.md
ema-genesis/research/knowledge-graphs/silverbulletmd-silverbullet.md
ema-genesis/research/knowledge-graphs/squidfunk-mkdocs-material.md
ema-genesis/research/knowledge-graphs/typedb-typedb.md
ema-genesis/research/knowledge-graphs/zk-org-zk.md
ema-genesis/research/life-os-adhd/ErnieAtLYD-retrospect-ai.md
ema-genesis/research/life-os-adhd/JackReis-neurodivergent-visual-org.md
ema-genesis/research/life-os-adhd/JerryZLiu-Dayflow.md
ema-genesis/research/life-os-adhd/Kodaxadev-Task-Anchor-MCP.md
ema-genesis/research/life-os-adhd/_MOC.md
ema-genesis/research/life-os-adhd/_aspiration-detection-verdict.md
ema-genesis/research/life-os-adhd/adrianwedd-ADHDo.md
ema-genesis/research/life-os-adhd/cielecki-life-navigator.md
ema-genesis/research/life-os-adhd/donetick-donetick.md
ema-genesis/research/life-os-adhd/mduffster-utility-explorer.md
ema-genesis/research/life-os-adhd/nashsu-llm_wiki.md
ema-genesis/research/life-os-adhd/nextor2k-hyperfocus.md
ema-genesis/research/life-os-adhd/ravila4-claude-adhd-skills.md
ema-genesis/research/life-os-adhd/vortext-esther.md
ema-genesis/research/p2p-crdt/_MOC.md
ema-genesis/research/p2p-crdt/anyproto-any-sync.md
ema-genesis/research/p2p-crdt/anyproto-anytype-heart.md
ema-genesis/research/p2p-crdt/automerge-automerge-repo.md
ema-genesis/research/p2p-crdt/dxos-dxos.md
ema-genesis/research/p2p-crdt/electric-sql-electric.md
ema-genesis/research/p2p-crdt/element-hq-element-web.md
ema-genesis/research/p2p-crdt/element-hq-synapse.md
ema-genesis/research/p2p-crdt/garden-co-jazz.md
ema-genesis/research/p2p-crdt/hashicorp-nomad.md
ema-genesis/research/p2p-crdt/hashicorp-serf.md
ema-genesis/research/p2p-crdt/k3s-io-k3s.md
ema-genesis/research/p2p-crdt/loro-dev-loro.md
ema-genesis/research/p2p-crdt/matrix-construct-tuwunel.md
ema-genesis/research/p2p-crdt/matrix-org-MSC1772.md
ema-genesis/research/p2p-crdt/matrix-org-dendrite.md
ema-genesis/research/p2p-crdt/mattermost-rocketchat.md
ema-genesis/research/p2p-crdt/syncthing-syncthing.md
ema-genesis/research/p2p-crdt/vlcn-io-cr-sqlite.md
ema-genesis/research/p2p-crdt/yjs-yjs.md
ema-genesis/research/research-ingestion/_MOC.md
ema-genesis/research/self-building/NicholasSpisak-second-brain.md
ema-genesis/research/self-building/_MOC.md
ema-genesis/research/self-building/aden-hive-hive.md
ema-genesis/research/self-building/gsd-build-get-shit-done.md
ema-genesis/research/self-building/loomio-loomio.md
ema-genesis/research/self-building/snarktank-ralph.md
ema-genesis/research/vapp-plugin/_MOC.md
ema-genesis/research/vapp-plugin/alex8088-electron-vite.md
ema-genesis/research/vapp-plugin/argyleink-open-props.md
ema-genesis/research/vapp-plugin/electron-react-boilerplate-electron-react-boilerplate.md
ema-genesis/research/vapp-plugin/ferdium-ferdium-app.md
ema-genesis/research/vapp-plugin/laurent22-joplin.md
ema-genesis/research/vapp-plugin/logseq-logseq.md
ema-genesis/research/vapp-plugin/obsidianmd-obsidian-releases.md
ema-genesis/research/vapp-plugin/siyuan-note-siyuan.md
ema-genesis/research/vapp-plugin/smapiot-piral.md
ema-genesis/research/vapp-plugin/style-dictionary-style-dictionary.md
ema-genesis/research/vapp-plugin/tokens-studio-figma-plugin.md
ema-genesis/vapps/CATALOG.md
```

### Vendored Research Clone Inventory

Representative clone counts. These repos live under `ema-genesis/research/_clones/`.

```text
ActivityWatch-activitywatch — 94
Ark0N-Codeman — 481
BerriAI-litellm — 8,034
ComposioHQ-agent-orchestrator — 644
Dicklesworthstone-claude_code_agent_farm — 189
Dicklesworthstone-coding_agent_session_search — 2,477
Dicklesworthstone-ntm — 1,924
ErnieAtLYD-retrospect-ai — 104
Eugeny-tabby — 896
HKUDS-LightRAG — 443
ITSpecialist111-ai_automation_suggester — 63
JackReis-neurodivergent-visual-org — 51
JerryZLiu-Dayflow — 417
Kodaxadev-Task-Anchor-MCP — 95
MemoriLabs-Memori — 494
NicholasSpisak-second-brain — 46
Paul-Kyle-palinode — 142
Significant-Gravitas-AutoGPT — 3,319
SkepticMystic-breadcrumbs — 229
aden-hive-hive — 1,227
adrianwedd-ADHDo — 419
aiming-lab-SimpleMem — 263
alex8088-electron-vite — 75
anyproto-any-sync — 528
anyproto-anytype-heart — 1,654
argyleink-open-props — 198
asciinema-asciinema-player — 139
automerge-automerge-repo — 356
auxclawdbot-taskflow — 56
blacksmithgu-obsidian-dataview — 194
cielecki-life-navigator — 38
codeninja-oauth-cli-coder — 52
cozodb-cozo — 258
dagger-container-use — 143
danielmiessler-Personal_AI_Infrastructure — 9,948
dbos-inc-dbos-transact-ts — 35,966
donetick-donetick — 176
dxos-dxos — 9,824
electric-sql-electric — 2,586
electron-react-boilerplate-electron-react-boilerplate — 105
element-hq-element-web — 4,497
element-hq-synapse — 1,872
ferdium-ferdium-app — 630
foambubble-foam — 477
garden-co-jazz — 3,122
generalaction-emdash — 970
getzep-graphiti — 366
gnekt-My-Brain-Is-Full-Crew — 170
gotohuman-gotohuman-mcp-server — 36
gsd-build-get-shit-done — 772
hashicorp-memberlist — 85
hashicorp-serf — 241
hedgedoc-hedgedoc — 1,904
inngest-inngest — 12,219
iwe-org-iwe — 296
jackyzha0-quartz — 318
jayminwest-overstory — 351
johannesjo-parallel-code — 231
johannesjo-super-productivity — 3,773
k3s-io-k3s — 678
langchain-ai-langgraph — 562
laurent22-joplin — 8,090
letta-ai-letta — 1,184
logseq-logseq — 1,607
loomio-loomio — 4,373
loro-dev-loro — 669
matrix-org-dendrite — 878
matrix-org-matrix-spec-proposals — 317
mduffster-utility-explorer — 61
mem0ai-mem0 — 1,959
microsoft-node-pty — 107
n8n-io-n8n — 17,308
nashsu-llm_wiki — 155
nextor2k-hyperfocus — 40
oclif-core — 291
oclif-oclif — 206
onejgordon-flow-dashboard — 257
open-webui-open-webui — 4,952
rashadphz-brain-dump-ai — 178
ravila4-claude-adhd-skills — 57
reorproject-reor — 423
restatedev-restate — 1,306
roboticforce-sugar — 299
sakowicz-actual-ai — 106
shep-ai-shep — 3,639
silverbulletmd-silverbullet — 780
smapiot-piral — 1,658
snarktank-ralph — 60
syncthing-syncthing — 970
temporalio-sdk-typescript — 667
thedotmack-claude-mem — 692
tmux-python-libtmux — 190
topoteretes-cognee — 2,029
triggerdotdev-trigger.dev — 4,166
typedb-typedb — 727
vercel-hyper — 197
vlcn-io-cr-sqlite — 199
vortext-esther — 195
wavetermdev-waveterm — 1,114
windmill-labs-windmill — 7,360
wshobson-agents — 702
xtermjs-xterm_js — 757
yjs-yjs — 103
zk-org-zk — 482
```

### Intent Canon State

| Slug | Status | Priority | Title | One-line summary |
| --- | --- | --- | --- | --- |
| `GAC-001` | answered | critical | Cross-machine dispatch protocol | Remote-agent execution protocol is specified, but implementation is not yet the issue here. |
| `GAC-002` | answered | critical | Concurrent agent coordination | Canon answers how agents avoid stomping each other, but the runtime is not wired end to end. |
| `GAC-003` | answered | high | Agent state machine | Defines richer runtime states beyond coarse detect/launch/work/report flow. |
| `GAC-004` | answered | high | Intent exit_condition + scope | Makes completion/scope explicit instead of dispatching unbounded intents. |
| `GAC-005` | answered | high | Typed edge grammar | Defines how typed links live in markdown/canon. |
| `GAC-006` | pending | high | `@ema/core` SDK API surface | API contract exists conceptually, but implementation coverage is incomplete. |
| `GAC-007` | answered | high | Nested spaces | Canon settles the spaces model, but current implementation is still flat and young. |
| `GAC-008` | pending | medium | Identity layer | Cryptographic peer identity remains unresolved. |
| `GAC-009` | pending | medium | Workflow resumability | Durable workflow engine choice remains open. |
| `GAC-010` | answered | medium | User state awareness | Canon answers the need; runtime pipeline is still partial. |
| `GAC-QUEUE-MOC` | active | n/a | GAC Queue — Map of Content | Queue map of the GAC decision set. |
| `INT-AGENT-COLLABORATION` | preliminary | high | Agent workspace collaboration | Wire real collaboration instead of decorative agent infrastructure. |
| `INT-AUTONOMOUS-REASONING-PHASE3` | preliminary | high | Phase 3 Autonomous Reasoning Loop | Recover the meta-loop that makes EMA autonomous. |
| `INT-CANON-REPAIR-CANON-STATUS-INDEX` | active | medium | Canon repair — CANON-STATUS index | `_meta/CANON-STATUS.md` is missing newly added canon nodes. |
| `INT-CANON-REPAIR-CLAUDE-MD` | active | high | Canon repair — rewrite `ema-genesis/CLAUDE.md` structure | Fix dead paths and stale examples in canon instructions. |
| `INT-CANON-REPAIR-CROSSREF-AFTER-EXE-002` | active | high | Canon repair — update stale crossrefs after rename | Update docs still pointing at old decision IDs. |
| `INT-CANON-REPAIR-DEC-007-STATUS-UPGRADE` | active | medium | Canon repair — upgrade DEC-007 status | DEC-007 is foundational but still marked preliminary. |
| `INT-CANON-REPAIR-IMPLEMENTATION-STATUS` | active | critical | Canon repair — add implementation reality flags | Canon decisions overstate implementation status. |
| `INT-CANON-REPAIR-V1-SPEC-HEADER` | active | high | Canon repair — soften `EMA-V1-SPEC` header | Current header over-claims supersession. |
| `INT-DAILY-VALIDATION-RITUAL` | preliminary | high | Daily 5-minute ritual | Operational validation routine proposal. |
| `INT-EXECUTION-DISPATCHER` | active | high | Agent-spawn dispatcher | Approved executions still need a real dispatcher. |
| `INT-FEEDBACK-LOOP-INTEGRATION` | preliminary | critical | Close the feedback loop | End-to-end seed → proposal → execution → feedback loop remains incomplete. |
| `INT-FRONTEND-VAPP-RECONCILIATION` | preliminary | critical | vApp reconciliation | Canon, old build, and renderer disagree on the app catalog. |
| `INT-INTENTIONS-SCHEMATIC-ENGINE` | preliminary | high | Intentions Schematic Engine | Hierarchical intent graph remains conceptual. |
| `INT-KNOWLEDGE-COMPILATION-LAYER` | preliminary | medium | Knowledge Compilation Layer | Compile-don't-search pattern planned for the large vault. |
| `INT-NERVOUS-SYSTEM-WIRING` | preliminary | critical | Wire EMA nervous system | High-leverage wiring pass still open. |
| `INT-P2P-FEDERATED-SYNC` | preliminary | low | P2P sync / federated Life OS | Federated sync remains long-horizon work. |
| `INT-PROPOSAL-PIPELINE` | active | high | Port the 5-stage proposal pipeline | Current implementation covers only narrow slices of the old pipeline. |
| `INT-RECOVERY-WAVE-1` | active | critical | Recovery Wave 1 | Master porting intent from the old build. |
| `INT-SKILLS-ECOSYSTEM` | preliminary | medium | Skills Ecosystem | Skill trigger-loading and ecosystem porting remain open. |
| `INT-SPRINT-2026-04-07` | preliminary | medium | Sprint priorities from 2026-04-07 | Sprint note retained as intent. |
| `INT-TASK-MASTER-STEALS` | preliminary | medium | Task-master top steals | Concrete execution-system patterns still to port. |

### Execution Canon State

| Execution | Status | Date | What shipped |
| --- | --- | --- | --- |
| `EXE-001-gac-schema-stubs` | completed | 2026-04-12 | Schema stubs, initial SDK facade, spaces/user-state/runtime heartbeat skeleton. |
| `EXE-002-canon-id-collisions` | completed | 2026-04-12 | Canon ID collision repair and stale architecture cleanup. |
| `EXE-003-intents-port` | completed | 2026-04-12 | `services/core/intents/` port and semantic/operational bridge. |
| `EXE-003-recovery-wave-full` | completed | 2026-04-12 | Broad recovery-wave record tying the TS/Electron migration together. |
| `EXE-EMA-FULL-SYSTEMS-AUDIT-2026-04-06` | preliminary | 2026-04-12 | Full-system audit with blockers and corrective direction. |
| `EXE-LAUNCHPADHQ-EXPANSION-2026-04-06` | preliminary | 2026-04-12 | Frontend expansion: multiple stores, new pages, channel rewiring. |

### Decision Canon State

| Decision | Status | Summary |
| --- | --- | --- |
| `DEC-001` | active | Graph engine is a derived object index over markdown with typed edges and DQL-style querying. |
| `DEC-002` | active | Sync is split: file-sync for markdown, CRDTs for structured data. |
| `DEC-003` | active | Aspiration detection is canonically part of EMA’s niche. |
| `DEC-004` | active | GAC cards are first-class backend primitives. |
| `DEC-005` | active | Actor lifecycle is `idle -> plan -> execute -> review -> retro`. |
| `DEC-006` | active | Some CLI features are preserved conceptually but deferred. |
| `DEC-007` | preliminary | Unified intents schema / three-truths model, but still not marked fully active. |
| `DEC-008` | preliminary | Daily validation ritual is canonized but not yet operationalized. |

## Step 4 — Discover The Agents

### Root Briefing Files

- Project root contains `CLAUDE.md`
- Project root does not contain `CLAUDE-CLI.md`
- Project root does not contain `AGENTS.md`
- `ema-genesis/CLAUDE.md` also exists for in-canon instructions

### Agent Discovery Table

| Agent | Config dir | Sessions | Projects | Date range | Notes |
| --- | --- | --- | --- | --- | --- |
| `claude` | `/home/trajan/.claude` | 327 | 35 | 2026-02-15..2026-04-13 | Full global config: `history.jsonl`, `sessions/`, `projects/`, `session-env/`, `tasks/`, `plans/`, `plugins/` |
| `codex` | `/home/trajan/.codex` | 182 | 19 | 2026-02-16..2026-04-13 | Global Codex state: `history.jsonl`, `sessions/`, sqlite state/log DBs, memories, skills |
| `cursor` | `/home/trajan/.cursor` | 0 | 13 | n/a | Config + `ai-tracking/` DB, `projects/`, `worktrees/`, skills, but no stored conversation summaries |
| `superman` | `/home/trajan/.superman` | 1 | 1 | 2026-04-03..2026-04-03 | Intent-folder style state only |
| `superpowers` | `/home/trajan/Desktop/.superpowers` | 1 | 1 | 2026-03-13..2026-03-13 | Brainstorm session dir only |
| `cursor` | `/home/trajan/Desktop/Coding/Projects/blueprint-media-full-archive/.cursor` | 0 | 0 | n/a | Project-local skill/config folder only |
| `superpowers` | `/home/trajan/Desktop/Coding/Projects/execudeck/.superpowers` | 1 | 1 | 2026-03-12..2026-03-12 | Brainstorm folder only |
| `claude` | `/home/trajan/Desktop/Coding/Projects/letmescale/.claude` | 0 | 0 | n/a | Project-local config, no history |
| `superpowers` | `/home/trajan/Desktop/Coding/Projects/letmescale/.superpowers` | 1 | 1 | 2026-03-12..2026-03-12 | Brainstorm folder only |
| `claude` | `/home/trajan/Desktop/Coding/Projects/xpressdrop/.claude` | 0 | 0 | n/a | `settings.local.json` only |
| `claude` | `/home/trajan/Desktop/MyApp/node_modules/es-abstract/.claude` | 0 | 0 | n/a | Vendored `.claude` dir inside `node_modules` |
| `superpowers` | `/home/trajan/Desktop/Proslync documentation/.superpowers` | 1 | 1 | 2026-03-26..2026-03-26 | Brainstorm folder only |
| `claude` | `/home/trajan/Desktop/Tech Vault Obsidi2/Trajans Tech Serious Vault/.claude` | 0 | 0 | n/a | Project-local config, commands, sessions dir present but empty by scan |
| `claude` | `/home/trajan/Desktop/place.org/.claude` | 0 | 0 | n/a | Empty project-local `.claude` dir |
| `superpowers` | `/home/trajan/Desktop/place.org/.superpowers` | 4 | 1 | 2026-03-20..2026-03-25 | Active brainstorm usage |
| `claude` | `/home/trajan/Desktop/proslync-app/.claude` | 0 | 0 | n/a | Project-local config + worktrees, no history |
| `superpowers` | `/home/trajan/Desktop/proslync-app/.superpowers` | 3 | 1 | 2026-04-02..2026-04-07 | Brainstorm sessions with named content topics |
| `claude` | `/home/trajan/Dippy/.claude` | 0 | 0 | n/a | Skills only |
| `claude` | `/home/trajan/Documents/obsidian_first_stuff/twj1/.claude` | 0 | 0 | n/a | Project-local config, commands, hooks, sessions dir present but empty by scan |
| `claude` | `/home/trajan/Projects/ema/.claude` | 0 | 0 | n/a | Project-local settings + worktrees only |
| `superman` | `/home/trajan/Projects/ema/.superman` | 1 | 1 | 2026-04-03..2026-04-03 | Local context, project file, intent folder |
| `superpowers` | `/home/trajan/Projects/ema/.superpowers` | 2 | 1 | 2026-03-29..2026-04-06 | EMA brainstorm artifacts |
| `superman` | `/home/trajan/Projects/ema/IGNORE_OLD_TAURI_BUILD/daemon/.superman` | 27 | 1 | 2026-04-13..2026-04-13 | Dense old-build intent archive |
| `claude` | `/home/trajan/claude-desktop-debian/.claude` | 0 | 0 | n/a | Local config only |
| `claude` | `/home/trajan/claude-devtools/.claude` | 0 | 0 | n/a | Local config only |
| `claude` | `/home/trajan/lasso-claude-hooks/.claude` | 0 | 0 | n/a | Commands + skills only |
| `claude` | `/home/trajan/shared/inbox-host/ui-ux-pro-max-skill/.claude` | 0 | 0 | n/a | Skills only |

## Step 5 — Scan Past Sessions

Only 12 of the discovered agent config dirs contain actual session/history data. The remaining 15 are config-only directories with zero detected sessions.

### Session Archaeology Table

| Agent dir | Sessions | Messages | Date range | Project associations | 5 most recent opening prompts |
| --- | --- | --- | --- | --- | --- |
| `/home/trajan/.claude` | 327 | 3,695 | 2026-02-15..2026-04-13 | 35 | `find more lost intents`; `keep iterating, still hasnt opened successfuly once`; `how are we doing ... CLI development up and at it now`; `checkpoint commit + update all context`; `/insights` |
| `/home/trajan/.codex` | 182 | 50,136 | 2026-02-16..2026-04-13 | 19 | `run gap analysis`; `see all the research done ... what EMA is`; `# EMA — Codex Deployment Prompt`; `how are we doing`; `this entire codebase is about to go a huge transformation` |
| `/home/trajan/.superman` | 1 | 0 | 2026-04-03..2026-04-03 | 1 | `Test Execution Intent ... write EXECUTION_TEST_PROVEN to stdout` |
| `/home/trajan/Desktop/.superpowers` | 1 | 0 | 2026-03-13..2026-03-13 | 1 | unnamed brainstorm session |
| `/home/trajan/Desktop/Coding/Projects/execudeck/.superpowers` | 1 | 0 | 2026-03-12..2026-03-12 | 1 | unnamed brainstorm session |
| `/home/trajan/Desktop/Coding/Projects/letmescale/.superpowers` | 1 | 0 | 2026-03-12..2026-03-12 | 1 | unnamed brainstorm session |
| `/home/trajan/Desktop/Proslync documentation/.superpowers` | 1 | 0 | 2026-03-26..2026-03-26 | 1 | unnamed brainstorm session |
| `/home/trajan/Desktop/place.org/.superpowers` | 4 | 0 | 2026-03-20..2026-03-25 | 1 | unnamed brainstorm sessions across four runs |
| `/home/trajan/Desktop/proslync-app/.superpowers` | 3 | 0 | 2026-04-02..2026-04-07 | 1 | `social-features`; `current-vs-vision, phased-architecture, social-features`; unnamed brainstorm session |
| `/home/trajan/Projects/ema/.superman` | 1 | 0 | 2026-04-03..2026-04-03 | 1 | `Execution-First EMA OS with Intent Folders and Runtime Executions` |
| `/home/trajan/Projects/ema/.superpowers` | 2 | 0 | 2026-03-29..2026-04-06 | 1 | `intent-schema-v2, intent-schema-v3, intent-schema`; `ema-app-windows, ema-architecture, ema-launchpad` |
| `/home/trajan/Projects/ema/IGNORE_OLD_TAURI_BUILD/daemon/.superman` | 27 | 0 | 2026-04-13..2026-04-13 | 1 | `Verify dispatch works`; `trigger state sync`; `testing CLI bootstrapping session`; `top steals from task-master`; `session detection already built` |

### Notable Archaeology Findings

- EMA itself is the dominant recent project in both `~/.claude` and `~/.codex`.
- Claude history shows heavy focus on lost-intent recovery, CLI parity, and canonical state management.
- Codex history shows the transition from broad gap analysis into this autonomous deployment prompt.
- Repo-local `.superman` and `.superpowers` state predate the current Codex session and already describe an execution-first EMA model and intent-schema work.
- The archived old build still has a dense `.superman` intent corpus that can be mined for backfeed and migration clues.

## Step 6 — Inventory The Services

### HTTP Server Shape

- `services/http/server.ts` auto-registers `services/core/<domain>/<domain>.router.ts` or `router.ts`
- Health endpoint: `GET /api/health`
- Mounted prefixes are domain-specific shims:
  - `/api/blueprint`
  - `/api/intents`
  - `/api/spaces`
  - `/api/user-state`
  - many older domains register absolute `/api/...` routes directly

### Realtime Channels Actually Registered

Only these channel families are started from `services/startup.ts`:

- `brain_dump:*`
- `dashboard:*`
- `executions:*`
- `projects:*`
- `settings:*`
- `tasks:*`
- `workspace:*`

This is materially smaller than the renderer’s expected Phoenix surface.

### Service Inventory

| Service | What it does | Routes | MCP tools | SDK coverage |
| --- | --- | --- | --- | --- |
| `actors` | Runtime transition ingress for agent state changes | `POST /api/agents/runtime-transition` | none | `agents.emitRuntimeTransition` wired; `agents.status` still pending |
| `blueprint` | GAC card queue, CRUD, state machine, filesystem bootstrap | `GET /api/blueprint/gac`, `GET /api/blueprint/gac/:id`, `POST /api/blueprint/gac`, `POST /:id/answer`, `POST /:id/defer`, `POST /:id/promote` | `gac_list`, `gac_show`, `gac_create`, `gac_answer`, `gac_defer`, `gac_promote` | No SDK wrapper yet |
| `brain-dump` | Inbox capture CRUD + dashboard snapshot fanout | `GET /api/brain-dump/items`, `POST /api/brain-dump/items`, `PATCH /:id/process`, `DELETE /:id` | none | `brainDump.list/create` wired |
| `composer` | Artifact writer / compile-response helper | none | none | Not surfaced in SDK |
| `dashboard` | Today snapshot for inbox and surface metrics | `GET /api/dashboard/today` | none | Not surfaced in SDK |
| `executions` | Execution CRUD, status changes, steps, reflexion, pipe trigger on create | `GET /api/executions`, `GET /:id`, `POST /`, `POST /:id/approve`, `POST /:id/cancel`, `POST /:id/complete`, `POST /:id/archive`, `POST /:id/phase`, `POST /:id/steps`, `GET /reflexion` | `executions_list`, `executions_show`, `executions_create`, `executions_transition_phase`, `executions_append_step`, `executions_reflexion` | `executions.list/get/create` wired; SDK misses approve/cancel/complete |
| `intents` | Filesystem-backed intent engine with SQLite index and attachment endpoints | `GET /api/intents/`, `GET /:slug`, `POST /`, `POST /:slug/phase`, `POST /:slug/status`, `POST /reindex`, `POST /:slug/attach/execution`, `POST /:slug/attach/actor`, `POST /:slug/attach/session`, `GET /:slug/links`, `GET /:slug/runtime`, `GET /tree` | `intents_list`, `intents_show`, `intents_create`, `intents_transition_phase`, `intents_update_status`, `get_intent_tree`, `get_intent_runtime`, `attach_intent_execution`, `attach_intent_actor`, `attach_intent_session` | `intents.list/get/create` wired; SDK `update()` is stale and points at a nonexistent `PATCH` route |
| `memory` | Cross-pollination history and applicability reads | `GET /api/memory/`, `GET /applicable/:project`, `GET /history/:project`, `GET /:id`, `POST /` | none | No SDK wrapper |
| `pipes` | Pipe CRUD, run history, catalog, executor indirection | `GET /api/pipes/catalog`, `GET /history`, `GET /`, `GET /:id`, `POST /`, `POST /:id/toggle` | `pipes_list`, `pipes_show`, `pipes_create`, `pipes_toggle`, `pipes_run`, `pipes_history` | No SDK wrapper |
| `projects` | Project CRUD + project context aggregation | `GET /api/projects`, `GET /api/portfolio/projects`, `GET /api/projects/:id/context`, `GET /api/projects/:id`, `POST /api/projects`, `PUT /api/projects/:id` | none | No SDK wrapper |
| `proposals` | Seed/harvested proposal ingress cleanup | `GET /api/proposals/seeds`, `GET /api/proposals/harvested`, `POST /api/proposals/harvested/clean` | none | SDK wraps `listSeeds/listHarvested`; `create/approve` are still pending and have no matching routes |
| `settings` | Key-value settings persistence | `GET /api/settings`, `PUT /api/settings` | none | No dedicated SDK object beyond raw settings use in renderer |
| `spaces` | Flat space namespace, members, archive | `GET /api/spaces/`, `GET /:ref`, `POST /`, `POST /:ref/archive`, `POST /:ref/members`, `DELETE /:ref/members/:actor_id` | `spaces_list`, `spaces_show`, `spaces_create`, `spaces_archive`, `spaces_add_member`, `spaces_remove_member` | Service is live, but SDK still marks `spaces.*` as `@pending` |
| `tasks` | Task CRUD, transitions, comments | `GET /api/tasks`, `GET /api/projects/:id/tasks`, `GET /api/tasks/:id`, `POST /api/tasks`, `POST /:id/transition`, `POST /:id/comments` | none | No SDK wrapper |
| `user-state` | Singleton operator state + signal history | `GET /api/user-state/current`, `POST /update`, `POST /signal`, `GET /history` | `user_state_current`, `user_state_update`, `user_state_signal`, `user_state_history` | SDK is stale: it expects `latest(actorId)` and `report()` routes that do not exist |
| `visibility` | Visibility topics/events query surface | `GET /api/visibility/topics`, `GET /api/visibility/events` | none | No SDK wrapper |
| `workspace` | Window layout persistence | `GET /api/workspace`, `PUT /api/workspace/:appId` | none | No SDK wrapper |

### Shared Contracts

`shared/contracts/` exports:

- `ServiceContract<T>`
  - `list(opts?)`
  - `get(id)`
  - `create(data)`
  - `update(id, data)`
  - `delete(id)`

### Shared Schemas

`shared/schemas/` currently exports the following validators/types by module:

- `actor-phase.ts`: `actorPhaseSchema`, `agentRuntimeStateSchema`, `phaseTransitionSchema`, `PHASE_TRANSITION_DDL`, `PHASE_TRANSITIONS`, plus `ActorPhase`, `AgentRuntimeState`, `PhaseTransition`
- `actor.ts`: `actorRoleSchema`, `humanActorSchema`, `agentActorSchema`, `actorSchema`, fixtures/examples, plus actor types
- `agents.ts`: `agentStatusSchema`, `agentSchema`
- `artifact.ts`: `artifactTypeSchema`, `artifactSchema`, fixtures/examples, plus artifact types
- `brain-dump.ts`: `brainDumpSourceSchema`, `brainDumpStatusSchema`, `inboxItemSchema`
- `common.ts`: `idSchema`, `timestampSchema`, `paginationSchema`, `baseEntitySchema`, `emaLinkTypeSchema`, `emaLinkSchema`, `emaLinksField`, `spaceIdField`, plus `PaginationOpts`, `EmaLink`, `EmaLinkType`
- `cross-pollination.ts`: `crossPollinationEntrySchema`, `CrossPollinationEntry`
- `events.ts`: `emaEventTypeSchema`, `emaEventSchema`, fixtures/examples, plus event types
- `execution.ts`: `coreExecutionStatusSchema`, `coreExecutionSchema`, fixtures/examples, plus core execution types
- `executions.ts`: `executionStatusSchema`, `executionSchema`, plus `Execution`, `ExecutionStatus`
- `gac-card.ts`: all GAC card schemas, enums, transitions, and related types
- `habits.ts`: `habitCadenceSchema`, `habitSchema`, `habitLogSchema`
- `intent.ts`: core intent schemas, `createCoreIntentInputSchema`, fixtures/examples, plus core intent types
- `intents.ts`: `intentLevelSchema`, `intentStatusSchema`, `intentKindSchema`, `INTENT_KINDS_REQUIRING_EXIT_CONDITION`, `intentSchema`, `validateIntentForKind`, plus `Intent`, `IntentKind`
- `projects.ts`: `projectStatusSchema`, `projectSchema`
- `proposal.ts`: core proposal schemas, `reviseCoreProposalInputSchema`, fixtures/examples, plus core proposal types
- `proposals.ts`: `proposalStatusSchema`, `proposalSchema`
- `settings.ts`: `settingSchema`
- `spaces.ts`: `spaceMemberSchema`, `spaceSchema`, plus `Space`, `SpaceMember`
- `tasks.ts`: `taskStatusSchema`, `taskPrioritySchema`, `taskEffortSchema`, `taskSchema`
- `user-state.ts`: all user-state schemas and related types

### Shared SDK Surface

`shared/sdk/index.ts` exposes:

- `IntentsApi`: `list`, `get`, `create`, `update`
- `ProposalsApi`: `listSeeds`, `listHarvested`, `create`, `approve`
- `ExecutionsApi`: `list`, `get`, `create`
- `BrainDumpApi`: `list`, `create`
- `VaultApi`: `search`, `read`, `write`
- `CanonApi`: `read`, `write`
- `AgentsApi`: `status`, `emitRuntimeTransition`
- `SpacesApi`: `list`, `get`, `create`
- `UserStateApi`: `latest`, `report`
- `EventsApi`: `on`, `emit`

Pending/deferred markers in the SDK:

- `@pending`: 16
- `@deferred`: 0

SDK drift already visible:

- `spaces.*` routes exist, but the SDK still labels them pending
- `userState.latest/report` do not match the current service routes
- `intents.update()` points at a nonexistent `PATCH`
- `vault.*`, `canon.*`, and `agents.status()` have no backend routes yet

## Step 7 — Inventory The Frontend

### Route / View Inventory

`apps/renderer/src/App.tsx` exposes 28 routes:

| Route | Component | Backing stores | Status |
| --- | --- | --- | --- |
| `brain-dump` | `BrainDumpApp` | `BrainDumpStore` | wired |
| `tasks` | `TasksApp` | `TasksStore`, `ProjectsStore` | wired |
| `projects` | `ProjectsApp` | `ProjectsStore`, `TasksStore`, `ProposalsStore`, `ExecutionStore` | wired |
| `executions` | `ExecutionsApp` | `ExecutionStore` | wired |
| `proposals` | `ProposalsApp` | `ProposalsStore`, `EvolutionStore`, `ExecutionStore` | wired |
| `blueprint-planner` | `BlueprintPlannerApp` | none | partial |
| `intent-schematic` | `IntentSchematicApp` | `WikiEngineStore` | partial |
| `wiki` | `WikiApp` | `VaultStore` | wired |
| `agents` | `AgentsApp` | `AgentsStore` | wired in UI, but store targets routes not present in current backend |
| `canvas` | `CanvasApp` | `CanvasStore` | wired in UI, but channel surface is not registered in current services |
| `pipes` | `PipesApp` | `PipesStore` | wired |
| `evolution` | `EvolutionDashboard` | `EvolutionStore` | wired in UI, but backend domain is not present in current services |
| `whiteboard` | `WhiteboardApp` | none | orphaned/static |
| `storyboard` | `StoryboardApp` | none | orphaned/static |
| `decision-log` | `DecisionLogApp` | `DecisionLogStore` | wired in UI, but backend domain is not present in current services |
| `campaigns` | `CampaignsApp` | none | partial |
| `governance` | `GovernanceApp` | none | orphaned/static |
| `babysitter` | `BabysitterApp` | none | orphaned/static |
| `habits` | `HabitsApp` | `HabitsStore` | wired in UI, but backend domain is not present in current services |
| `journal` | `JournalApp` | `JournalStore` | orphaned |
| `focus` | `FocusApp` | `FocusStore` | wired in UI, but backend domain is not present in current services |
| `responsibilities` | `ResponsibilitiesApp` | `ResponsibilitiesStore` | wired in UI, but backend domain is not present in current services |
| `temporal` | `TemporalApp` | none | partial |
| `goals` | `GoalsApp` | `GoalsStore` | wired in UI, but backend domain is not present in current services |
| `settings` | `SettingsApp` | `SettingsStore`, `ActorsStore` | partial against live backend because `ActorsStore` has no matching service surface |
| `voice` | `VoiceApp` | `VoiceStore` | partial |
| `hq` | `HQApp` | none | orphaned/static |
| `operator-chat` | `OperatorChatApp` | none | partial |
| `agent-chat` | `AgentChatApp` | none | orphaned/static |

### Store Inventory Summary

Store totals under `apps/renderer/src/stores/`:

- wired by transport usage: 32
- partial by transport usage: 28
- orphaned by transport usage: 15

Important caveat: many stores are "wired" only in the sense that they call REST/Channel APIs. A large share still point at old-build domains that do not exist in the current `services/` app.

### Representative Store Mapping

| Store | Primary service/topic | Status |
| --- | --- | --- |
| `brain-dump-store.ts` | `brain_dump:queue`, `/brain-dump/items` | wired to live service |
| `execution-store.ts` | `executions:all`, `/executions/*` | wired to live service |
| `projects-store.ts` | `projects:lobby`, `/projects` | wired to live service |
| `tasks-store.ts` | `tasks:*` | wired to live service |
| `settings-store.ts` | `settings:sync`, `/settings` | wired to live service |
| `workspace-store.ts` | `workspace:state`, `/workspace/:appId` | wired to live service |
| `pipes-store.ts` | `pipes:editor`, `/pipes` | partially aligned; current services have REST, but no pipes channel registered at startup |
| `agents-store.ts` | `agents:lobby`, `/agents` | dead wire against current backend |
| `canvas-store.ts` | `canvas:${id}` | dead wire against current backend |
| `focus-store.ts` | `focus:timer` | dead wire against current backend |
| `goals-store.ts` | `goals:lobby` | dead wire against current backend |
| `proposals-store.ts` | `proposals:queue` | dead wire against current backend |
| `journal-store.ts` | no live transport | orphaned |
| `graph-store.ts` | no live transport | orphaned |
| `service-store.ts` | no live transport | orphaned |

## Step 8 — Assess The Old Build

### Old Build Structure

The historical build lives under `IGNORE_OLD_TAURI_BUILD/`:

- `app/` — old frontend app package
- `daemon/` — Elixir/Phoenix backend, CLI, pipes, actors, proposal engine, ingestion, sessions
- `docs/`
- `src/`, `src-tauri/` — archived Tauri-era material

### Old CLI Entry Point

- Old CLI entry module: `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/cli/cli.ex`
- It advertises itself as the Optimus-based CLI entry point
- Old command groups under `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/cli/commands/`: 90

Selected old CLI roots include:

- `intent`, `proposal`, `exec`, `pipe`, `dump`, `status`, `vault`, `space`, `task`, `session`, `provider`, `memory`, `ingest`, `routing`, `quality`, `governance`, `health`, `watch`, `skills`, `vectors`, `voice`, `calendar`, `brief`, `now`, `chronicle`

### Old Pipes Registry

From `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/pipes/registry.ex`:

- triggers: 21
- actions: 21
- transforms: 5

This matches the inline note in the new TypeScript `services/core/pipes/registry.ts`, which explicitly calls out a doc/source discrepancy: canon headings mention 22 triggers, but the enumerated source lists 21.

### Old Actor / Proposal / Execution Models

| Entity | Fields |
| --- | --- |
| `Actor` | `actor_type`, `name`, `slug`, `capabilities`, `config`, `phase`, `phase_started_at`, `status`, `space_id` |
| `Proposal` | `title`, `summary`, `body`, `status`, `confidence`, `risks`, `benefits`, `estimated_scope`, `generation_log`, `steelman`, `red_team`, `synthesis`, `embedding`, `idea_score`, `prompt_quality_score`, `score_breakdown`, `source_fingerprint`, `quality_score`, `pipeline_stage`, `pipeline_iteration`, `cost_display`, `generation`, `genealogy_path`, `validation_score`, `validation_gates_passed`, `validation_gates_failed`, `source_intent_id`, `project_id`, `seed_id`, `actor_id`, `space_id`, `parent_proposal_id` |
| `Execution` | `project_slug`, `intent_slug`, `title`, `objective`, `mode`, `status`, `requires_approval`, `intent_path`, `result_path`, `agent_session_id`, `brain_dump_item_id`, `metadata`, `completed_at`, `git_diff`, `space_id`, `actor_id`, `origin`, `proposal_id`, `task_id`, `session_id` |

### Old Build Summary

| Metric | Count |
| --- | --- |
| CLI command groups | 90 |
| Pipe triggers | 21 |
| Pipe actions | 21 |
| Pipe transforms | 5 |

## Step 9 — Synthesize

### What's Working

- `@ema/services` is the healthiest subsystem in the repo: it builds, its 11 test files pass, and its core live domains are real.
- Current live backend capabilities are strongest in:
  - intents
  - blueprint/GAC cards
  - executions
  - brain-dump
  - spaces
  - settings
  - tasks
  - workspace
- `@ema/renderer`, `@ema/electron`, `@ema/cli`, `@ema/shared`, `@ema/tokens`, and `@ema/workers` all compile individually.
- The current CLI already has a small but real surface: `research` commands plus `health check` and intent read commands.
- Canon is materially richer than a stub: decisions, specs, intents, executions, and a very large research corpus are all present and internally cross-linked.

### What's Broken

- Root build is red because `@ema/platform` fails immediately; `@ema/tools` also fails when built directly.
- The renderer/backend contract is badly out of sync. The services app only boots 7 websocket channel families, while the renderer expects many more (`agents`, `pipes`, `focus`, `goals`, `voice`, `canvas`, `metamind`, `knowledge_graph`, `superman`, etc.).
- The shared SDK is stale against the current services:
  - 16 `@pending` markers
  - live `spaces` routes still marked pending
  - `userState` wrapper points at routes that do not exist
  - `intents.update()` targets a nonexistent `PATCH`
- Most renderer stores still speak the old API vocabulary rather than the current TypeScript services vocabulary.
- The current CLI is nowhere near the canon/old-build shape; it only exposes a research/query slice and a couple of early intent/health commands.

### What's Missing

- The CLI spine named in the prompt is mostly absent:
  - no full `intent/proposal/exec/canon` tree
  - no graph/queue/blueprint/system ops tiers
  - no file-fallback transport layer
- Proposal pipeline parity is still thin compared with the old build and the canon intent.
- Pipe bus integration is only partial. Executions clearly trigger the pipe bus; the same pattern is not yet evident across all entity-mutating services.
- The ingestion / archaeology surface does not exist yet as a first-class service in `services/core/ingestion/`.
- Canon/implementation gaps are still open in exactly the areas the intent set says they are:
  - dispatcher
  - agent collaboration
  - full feedback loop
  - frontend vApp reconciliation
  - user-state operationalization
  - identity / resumability / federated sync

### Recommended Build Order

1. Fix the root build blockers first:
   - `platform` TS config
   - `tools/parity-check.ts` parser bug
2. Expand the CLI next, because the repo and canon both treat it as the universal control surface.
3. Reconcile SDK/service drift:
   - remove stale `@pending` markers where routes already exist
   - downgrade true absences to explicit `@deferred` with missing service names
4. Tighten service eventing and worker boot:
   - ensure every entity mutation fires pipe events
   - verify worker startup for `intent-watcher`, `vault-watcher`, `session-watcher`, `agent-runtime-heartbeat`
5. Build ingestion as a first-class vertical:
   - agent config discovery
   - session archaeology
   - proposal backfeed into canon review flow
6. Only after backend/CLI alignment, start reconciling renderer routes against live services instead of the old build.

### Agent Ecosystem Snapshot

- `~/.claude` and `~/.codex` are both active and both recently focused on EMA.
- Claude session history shows a recovery-oriented thread: lost intents, CLI parity, checkpoint commits, context management.
- Codex session history shows migration and repo-shaping work leading directly into this autonomous deployment prompt.
- Project-local `ema/.superman` and `ema/.superpowers` show that the repo already carries prior agent thinking about execution-first EMA, intent schema evolution, and architecture brainstorming.
- The archived old build also preserves a substantial `.superman` intent archive, which is likely valuable source material for the future ingestion/backfeed workstream.

