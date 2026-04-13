# Router Additions Needed

After F3/F4/F5 backend is merged, add these routes to daemon/lib/ema_web/router.ex
inside the `scope "/api"` block:

## Context (F3)
```elixir
get "/context", ContextController, :show
get "/context/sessions", ContextController, :sessions
post "/context/crystallize", ContextController, :crystallize
```

## Quality (F4)
```elixir
get "/quality/report", QualityController, :report
get "/quality/friction", QualityController, :friction
get "/quality/gradient", QualityController, :gradient
get "/quality/budget", QualityController, :budget
get "/quality/threats", QualityController, :threats
post "/quality/improve", QualityController, :improve
```

## Orchestration (F5)
```elixir
get "/orchestration/stats", OrchestrationController, :stats
get "/orchestration/fitness", OrchestrationController, :fitness
post "/orchestration/route", OrchestrationController, :route
```

## Proposal genealogy (F2)
```elixir
get "/proposals/:id/genealogy", ProposalController, :genealogy
```

## Intent (F1)
```elixir
get "/intelligence/intent_nodes", IntelligenceController, :intent_nodes
get "/intelligence/intent_nodes/tree", IntelligenceController, :intent_tree
get "/intelligence/intent_nodes/:id", IntelligenceController, :intent_node
```

## MIX.EXS addition (escript section)
Add to `project/0` in mix.exs:
```elixir
escript: [main_module: EmaCli.CLI, name: "ema"],
```

## Install CLI
```bash
cd ~/Projects/ema/daemon && mix escript.build && cp ema ~/bin/ema
```
