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
ema research list                       # all nodes, tabular
ema research list --category=cli-terminal
ema research list --signal=S --json
ema research get oclif-oclif            # print a node
ema research search "object index"      # frontmatter + body search
ema research grep "deno run" --clones   # ripgrep in cloned sources
ema research stats                      # category/signal counts + disk use
ema research categories                 # categories + counts + MOCs
ema research extractions                # list extraction docs
ema research extractions --missing      # nodes without extractions
ema research node oclif-oclif           # alias for `get`
```

Set `EMA_GENESIS_ROOT` to override auto-detection of the genesis folder.

## Requirements

- Node.js >= 22
- `rg` (ripgrep) installed for `ema research grep`

## Why oclif

Research round 1 flagged `oclif/oclif` as Tier-S for EMA's `<noun> <verb>`
CLI shape. See `[[research/cli-terminal/oclif-oclif]]` for the rationale.
