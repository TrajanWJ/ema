# @ema/cli — Bootstrap v0.2

The first real TypeScript code in the EMA stack. A CLI named `ema` whose
first job is to make the `ema-genesis/research/` layer queryable.

## Install

```bash
cd cli
npm install
npm run build
npm link
```

Now `ema` is on your PATH. Run it from anywhere inside the project.

## Commands

```bash
ema backend manifest                   # active backend domains + entities
ema backend flow intents               # runtime intents from the active backend
ema backend flow intent INTENT-SLUG    # runtime bundle for one intent
ema backend flow start INTENT-SLUG     # create execution from intent
ema backend flow phase EXECUTION-ID --to idle --reason "boot"
ema backend flow step EXECUTION-ID --label "implemented"
ema backend flow result EXECUTION-ID --path /tmp/result.md --summary "attached"
ema backend flow complete EXECUTION-ID --summary "done" --intent-status completed
ema backend flow execution EXECUTION-ID
ema goal list --owner-kind=human
ema goal create --title "Ship planning ledger" --timeframe=quarterly --owner-kind=human --owner-id=trajan
ema goal create --title "Strategist decomposition pass" --timeframe=weekly --owner-kind=agent --owner-id=strategist
ema goal view GOAL-ID
ema calendar list --owner-kind=agent --owner-id=strategist
ema calendar create --title "Human review block" --kind human_commitment --start-at 2026-04-13T14:00:00.000Z
ema calendar buildout --goal-id GOAL-ID --owner-id strategist --start-at 2026-04-13T16:00:00.000Z
ema research list                       # all nodes, tabular
ema research list --category=cli-terminal
ema research list --signal=S --json
ema research get oclif-oclif            # print a node
ema research search "object index"      # frontmatter + body search
ema research queue list                 # research backlog by domain/topic/depth
ema research queue add "Miniflux pass" --kind=repo --domain=research-ingestion --topic=rss --depth=3
ema research grep "deno run" --clones   # ripgrep in cloned sources
ema research stats                      # category/signal counts + disk use
ema research categories                 # categories + counts + MOCs
ema research extractions                # list extraction docs
ema research extractions --missing      # nodes without extractions
ema research node oclif-oclif           # alias for `get`
```

Set `EMA_GENESIS_ROOT` to override auto-detection of the genesis folder.

The research queue lives in `ema-genesis/research/research-ingestion/QUEUE.md`.
Use it for future clone targets, topic follow-ups, and domain passes before
promoting finished work into committed research nodes.

## Requirements

- Node.js >= 22
- `rg` (ripgrep) installed for `ema research grep`

## Why oclif

Research round 1 flagged `oclif/oclif` as Tier-S for EMA's `<noun> <verb>`
CLI shape. See `[[research/cli-terminal/oclif-oclif]]` for the rationale.
