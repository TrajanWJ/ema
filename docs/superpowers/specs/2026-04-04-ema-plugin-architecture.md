# EMA Plugin Architecture Spec
**Date:** 2026-04-04  
**Status:** Draft  
**Author:** Coder (via Subagent)

---

## Overview

EMA needs a first-class plugin system so community contributions, custom integrations, and experimental features can be added without modifying core. This spec defines the full plugin lifecycle: manifest, discovery, registration, action dispatch, hook invocation, and the event bus contract.

**Design principles:**
- Plugins are OTP Applications — they get full supervision, lifecycle management, and mix dependency support
- Zero-config discovery via mix deps metadata
- Plugins extend without forking — they register actions and hooks; core never imports plugin code
- Graceful degradation — a bad plugin crashes its own supervision tree, not EMA
- ETS-backed hot registration — plugins can register at boot or at runtime

---

## 1. Plugin Manifest Format (`ema_plugin.json`)

Each plugin ships an `ema_plugin.json` at its project root:

```json
{
  "name": "ema_github",
  "version": "0.1.0",
  "description": "GitHub integration — sync issues to tasks, trigger pipes on PR events",
  "ema_version": ">=0.8.0",
  "actions": [
    {
      "id": "github:create_issue",
      "label": "Create GitHub Issue",
      "description": "Create a GitHub issue from a task",
      "schema": {
        "repo": "string",
        "title": "string",
        "body": "string"
      },
      "module": "EmaGithub.Actions.CreateIssue"
    },
    {
      "id": "github:sync_issues",
      "label": "Sync GitHub Issues",
      "description": "Pull open issues into EMA tasks",
      "schema": {
        "repo": "string",
        "label_filter": "string"
      },
      "module": "EmaGithub.Actions.SyncIssues"
    }
  ],
  "hooks": [
    {
      "hook": "after_task_complete",
      "handler": "EmaGithub.Hooks.CloseIssue",
      "description": "Close linked GitHub issue when EMA task completes"
    }
  ],
  "pubsub_subscriptions": [
    "tasks:updates",
    "proposals:updates"
  ],
  "deps": [
    "tentacat >= 0.9"
  ]
}
```

**Required fields:** `name`, `version`, `actions`, `hooks`  
**Optional:** `ema_version`, `pubsub_subscriptions`, `deps`, `description`

---

## 2. OTP Application Plugin Model

Plugins are standard OTP Applications published to hex.pm with the mix metadata flag:

```elixir
# In plugin's mix.exs
def project do
  [
    app: :ema_github,
    version: "0.1.0",
    # This flag marks it as an EMA plugin for auto-discovery
    ema_plugin: true,
    ...
  ]
end

def application do
  [
    mod: {EmaGithub.Application, []},
    extra_applications: [:logger]
  ]
end
```

### Auto-Discovery

At daemon boot, `EMA.PluginLoader` scans all loaded applications for the `ema_plugin: true` mix metadata flag:

```elixir
defmodule Ema.PluginLoader do
  @doc """
  Called during EMA.Application startup. Finds all loaded OTP apps
  with ema_plugin: true in their mix metadata and registers them.
  """
  def discover_and_register do
    :application.loaded_applications()
    |> Enum.filter(fn {app, _desc, _vsn} ->
      Mix.Project.config_for(app)[:ema_plugin] == true
    end)
    |> Enum.each(fn {app, _desc, _vsn} ->
      register_plugin_app(app)
    end)
  end
end
```

In production (releases), plugins ship their manifest path in the app env:

```elixir
# In plugin's config/config.exs
config :ema_github, :ema_manifest, "priv/ema_plugin.json"
```

`PluginLoader` reads the manifest and calls `EMA.PluginRegistry.register_from_manifest/2`.

---

## 3. Hook System (`EMA.Hooks`)

The hook system provides synchronization points in core EMA flows where plugins can inject behavior.

### API

```elixir
# Register a handler for a hook (called at plugin startup)
EMA.Hooks.register(:after_task_complete, :ema_github_close_issue, fn payload ->
  EmaGithub.Hooks.CloseIssue.handle(payload)
end)

# Run all handlers for a hook (called by EMA core)
{:ok, results} = EMA.Hooks.run(:after_task_complete, %{task: task, source: :pipe})

# Unregister (e.g., on plugin shutdown)
EMA.Hooks.unregister(:after_task_complete, :ema_github_close_issue)
```

### Defined Hook Points

| Hook | Fired by | Payload |
|------|----------|---------|
| `:before_task_dispatch` | `Ema.Pipes.Executor` | `%{action_id, payload, config}` |
| `:after_task_complete` | `Ema.Tasks` on status→done | `%{task, source}` |
| `:before_proposal_create` | `Ema.Proposals` | `%{attrs, seed}` |
| `:on_brain_dump_created` | `Ema.BrainDump` | `%{item}` |
| `:after_pipe_executed` | `Ema.Pipes.Executor` | `%{pipe, result, duration_ms}` |
| `:on_daemon_boot` | `Ema.Application` | `%{version, env}` |

### Hook Execution Semantics

- Hooks run **synchronously in sequence** by default (ordered by registration time)
- Handler failures are **isolated** — one bad handler logs an error but does not abort remaining handlers
- Hooks return `{:ok, [result1, result2, ...]}` — results list matches handler registration order
- Future: async hooks with `EMA.Hooks.run_async/2`

---

## 4. Action Registry (`EMA.PluginRegistry`)

Plugins register pipe actions that appear alongside built-in actions in the Pipes editor.

### Architecture

```
Ema.Pipes.Registry (GenServer, stock actions)
         │
         └── checks EMA.PluginRegistry (ETS) on miss
```

`Pipes.Registry.get_action/1` first checks its in-memory stock list, then falls through to `PluginRegistry`:

```elixir
def get_action(action_id) do
  case GenServer.call(__MODULE__, {:get_action, action_id}) do
    nil -> Ema.PluginRegistry.lookup_action(action_id)
    action -> action
  end
end
```

### Registration Flow

1. Plugin app starts → `EmaGithub.Application.start/2` is called
2. App calls `EMA.PluginRegistry.register_action("ema_github", "github:create_issue", EmaGithub.Actions.CreateIssue)`
3. Registry stores in ETS: `{action_id, plugin_id, module}`
4. When a pipe fires `github:create_issue`, `Pipes.Registry` → `PluginRegistry` → `EmaGithub.Actions.CreateIssue.execute/2`

### Action Module Behaviour

All plugin actions implement:

```elixir
defmodule EmaGithub.Actions.CreateIssue do
  @behaviour Ema.PluginAction

  @impl true
  def execute(payload, config) do
    # payload: the runtime pipe payload
    # config: the action config from the pipe definition
    # Returns: {:ok, result} | {:error, reason}
    {:ok, %{issue_number: 42}}
  end

  @impl true
  def schema do
    %{repo: :string, title: :string, body: :string}
  end
end
```

---

## 5. Event Bus (Phoenix.PubSub Integration)

Plugins subscribe to EMA's existing `Ema.PubSub` topics. Core already broadcasts on these topics; plugins just subscribe.

### Existing Topics (available to plugins)

| Topic | Events |
|-------|--------|
| `"tasks:updates"` | `{:task_created, task}`, `{:task_completed, task}`, `{:task_status_changed, task, old, new}` |
| `"proposals:updates"` | `{:proposal_generated, p}`, `{:proposal_approved, p}`, `{:proposal_killed, p}` |
| `"brain_dump:updates"` | `{:item_created, item}`, `{:item_processed, item}` |
| `"habits:updates"` | `{:habit_toggled, id, log}`, `{:streak_milestone, id, count}` |
| `"system:events"` | `{:daemon_started, vsn}`, `{:daily_tick}`, `{:weekly_tick}` |

### Plugin Subscription Example

```elixir
defmodule EmaGithub.EventListener do
  use GenServer

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  def init(_) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "tasks:updates")
    {:ok, %{}}
  end

  def handle_info({:task_completed, task}, state) do
    EmaGithub.Hooks.CloseIssue.handle(%{task: task})
    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}
end
```

### Plugin-Emitted Events

Plugins can also broadcast on their own namespaced topics:

```elixir
Phoenix.PubSub.broadcast(Ema.PubSub, "plugin:ema_github", {:issue_synced, issue})
```

Core and other plugins can subscribe to `"plugin:ema_github"` for inter-plugin coordination.

---

## 6. Community Plugin Model (hex.pm)

Publishing a community plugin:

```elixir
# mix.exs
defp package do
  [
    name: "ema_github",
    description: "EMA GitHub integration",
    licenses: ["MIT"],
    links: %{"GitHub" => "https://github.com/yourname/ema_github"},
    keywords: ["ema", "ema_plugin", "productivity"]
  ]
end

def project do
  [
    app: :ema_github,
    ema_plugin: true,      # Required for auto-discovery
    ...
  ]
end
```

Using a community plugin:

```elixir
# In EMA daemon's mix.exs
defp deps do
  [
    {:ema_github, "~> 0.1"},
    ...
  ]
end
```

Then `mix deps.get && mix ema.plugins.list` shows it as registered at boot.

### Future: Mix Task

```bash
# List all installed plugins
mix ema.plugins.list

# Install a plugin (adds to mix.exs, runs deps.get, recompiles)
mix ema.plugins.install ema_github

# Search hex.pm for ema_ prefixed packages
mix ema.plugins.search github
```

---

## 7. Example Plugin Skeleton

### Directory Structure

```
ema_github/
├── mix.exs
├── priv/
│   └── ema_plugin.json
├── lib/
│   └── ema_github/
│       ├── application.ex      # OTP Application + registration
│       ├── event_listener.ex   # PubSub subscriber
│       ├── actions/
│       │   ├── create_issue.ex
│       │   └── sync_issues.ex
│       └── hooks/
│           └── close_issue.ex
└── test/
```

### `lib/ema_github/application.ex`

```elixir
defmodule EmaGithub.Application do
  use Application

  @impl true
  def start(_type, _args) do
    # Register actions with EMA's PluginRegistry
    Ema.PluginRegistry.register_action("ema_github", "github:create_issue", EmaGithub.Actions.CreateIssue)
    Ema.PluginRegistry.register_action("ema_github", "github:sync_issues", EmaGithub.Actions.SyncIssues)

    # Register hooks
    Ema.Hooks.register(:after_task_complete, :ema_github_close_issue, fn payload ->
      EmaGithub.Hooks.CloseIssue.handle(payload)
    end)

    children = [
      EmaGithub.EventListener
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: EmaGithub.Supervisor)
  end
end
```

### `lib/ema_github/actions/create_issue.ex`

```elixir
defmodule EmaGithub.Actions.CreateIssue do
  @behaviour Ema.PluginAction

  @impl true
  def execute(payload, config) do
    repo = Map.get(config, "repo") || Map.get(payload, "repo")
    title = Map.get(payload, "title", "Untitled")
    body = Map.get(payload, "body", "")

    # Call GitHub API...
    {:ok, %{repo: repo, issue_number: 1, title: title}}
  end

  @impl true
  def schema, do: %{repo: :string, title: :string, body: :string}
end
```

---

## Implementation Roadmap

| Phase | Work | Priority |
|-------|------|----------|
| 1 | `EMA.PluginRegistry` (ETS-backed) + wire into `Pipes.Registry` | HIGH |
| 1 | `EMA.Hooks` (ETS-backed, sync) | HIGH |
| 1 | `EMA.PluginAction` behaviour | HIGH |
| 2 | `EMA.PluginLoader` — manifest discovery at boot | MEDIUM |
| 2 | `mix ema.plugins.list` task | MEDIUM |
| 3 | Async hooks (`run_async/2`) | LOW |
| 3 | `mix ema.plugins.install` | LOW |
| 3 | Plugin sandbox / permission model | FUTURE |

---

## Security Considerations

- Plugins run **in-process** — they have full access to the EMA node. This is intentional for v1 (power users installing hex deps they trust).
- Future: sandboxed plugins via port processes or NIF boundaries
- Action `module.execute/2` calls are wrapped in `try/rescue` to prevent crashes propagating to core
- Hook handlers run in isolated `try/rescue` — one failing handler doesn't abort the chain
