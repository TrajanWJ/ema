# CLI Command Tree

Canonical native CLI root: `Ema.CLI`

Current built-in groups observed in source:

- `task`
- `proposal`
- `vault`
- `focus`
- `agent`
- `exec`
- `goal`
- `brain-dump`
- `habit`
- `journal`
- `resp`
- `seed`
- `engine`
- `dump`
- `status`

Planned additions for this build:

- `project`
- `org`
- `space`
- `campaign`
- `pipe`
- `responsibility`
- `session`
- `evolution`
- `channel`
- `superman`
- `intent`
- `gap`
- `memory`
- `provider`
- `tokens`
- `watch`
- `config`
- `em`
- `tag`
- `data`
- `actor`
- `dispatch`
- `babysitter`

Architectural note:

- this command tree extends the existing `Ema.CLI` implementation under `daemon/lib/ema/cli/`
- it does not create a parallel `EmaCli.CLI` namespace
