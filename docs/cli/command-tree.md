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
- `project`
- `org`
- `space`
- `campaign`
- `pipe`
- `session`
- `evolution`
- `channel`
- `superman`
- `intent`
- `gap`
- `tokens`
- `watch`
- `config`
- `em`
- `tag`
- `data`
- `actor`
- `babysitter`

Phase 2 actor/container surface now wired:

- `task list --actor --space --project`
- `task create --actor --space --project`
- `proposal list --actor --space --project`
- `goal list --actor --space --project`
- `goal create --actor --space --project`
- `project list --space`
- `project create --space`
- `brain-dump list --actor --space --project --task`
- `brain-dump create --actor --space --project --task`
- `space create --portable=<true|false>`
- `actor list --space --type --status`
- `actor create --space --type --capabilities`
- `actor phases`
- `actor register`
- `config list|get|set <container_type:id>`
- `tag add|remove|list <entity_type:id>`
- `data list|get|set|delete <entity_type:id>`
- `em status [actor]`
- `em phases <actor>`
- `em velocity <actor>`

Architectural note:

- this command tree extends the existing `Ema.CLI` implementation under `daemon/lib/ema/cli/`
- it does not create a parallel `EmaCli.CLI` namespace
