# place-native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Linux command center — Elixir Phoenix daemon + Tauri/React shell — with Brain Dump, Habits, Journal, Dashboard, and scaffolded future contexts.

**Architecture:** Elixir daemon runs as a persistent local service on port 4488, handling all data and real-time via Phoenix Channels. Tauri wraps a React/TS/Tailwind frontend that connects to the daemon via WebSocket + REST. SQLite via exqlite stores everything in `~/.local/share/place-native/place.db`.

**Tech Stack:** Elixir 1.18 + Phoenix 1.7 + Ecto + exqlite | Tauri 2 + React 19 + TypeScript + Tailwind v4 + Zustand + Motion | Vite 6

---

## File Map

### Daemon (`daemon/`)

```
daemon/
├── mix.exs
├── config/
│   ├── config.exs
│   ├── dev.exs
│   ├── prod.exs
│   └── runtime.exs
├── lib/
│   ├── place/
│   │   ├── application.ex              # OTP app, supervisor tree
│   │   ├── repo.ex                     # Ecto repo (exqlite)
│   │   ├── brain_dump/
│   │   │   ├── item.ex                 # Ecto schema
│   │   │   └── brain_dump.ex           # Context (public API)
│   │   ├── habits/
│   │   │   ├── habit.ex                # Schema
│   │   │   ├── habit_log.ex            # Schema
│   │   │   └── habits.ex              # Context
│   │   ├── journal/
│   │   │   ├── entry.ex                # Schema
│   │   │   └── journal.ex             # Context
│   │   ├── settings/
│   │   │   ├── setting.ex              # Schema
│   │   │   └── settings.ex            # Context
│   │   ├── tasks/
│   │   │   ├── task.ex                 # Schema (scaffold)
│   │   │   └── tasks.ex              # Context (scaffold)
│   │   ├── goals/
│   │   │   ├── goal.ex                 # Schema (scaffold)
│   │   │   └── goals.ex              # Context (scaffold)
│   │   ├── focus/
│   │   │   ├── session.ex              # Schema (scaffold)
│   │   │   ├── block.ex               # Schema (scaffold)
│   │   │   └── focus.ex              # Context (scaffold)
│   │   ├── notes/
│   │   │   ├── note.ex                 # Schema (scaffold)
│   │   │   └── notes.ex              # Context (scaffold)
│   │   ├── vault/
│   │   │   ├── file_index.ex           # Schema (scaffold)
│   │   │   └── vault.ex              # Context (scaffold)
│   │   ├── claude/
│   │   │   ├── session.ex              # Schema (scaffold)
│   │   │   └── claude.ex             # Context (scaffold)
│   │   ├── agents/
│   │   │   ├── agent_run.ex            # Schema (scaffold)
│   │   │   ├── agent_template.ex       # Schema (scaffold)
│   │   │   └── agents.ex             # Context (scaffold)
│   │   ├── context_bridge/
│   │   │   └── context_bridge.ex      # Context (scaffold)
│   │   ├── app_launcher/
│   │   │   ├── app_shortcut.ex         # Schema (scaffold)
│   │   │   └── app_launcher.ex        # Context (scaffold)
│   │   └── system/
│   │       └── system.ex              # Context (scaffold, live data)
│   └── place_web/
│       ├── endpoint.ex
│       ├── router.ex
│       ├── user_socket.ex
│       ├── channels/
│       │   ├── dashboard_channel.ex
│       │   ├── brain_dump_channel.ex
│       │   ├── habits_channel.ex
│       │   ├── journal_channel.ex
│       │   └── settings_channel.ex
│       └── controllers/
│           ├── dashboard_controller.ex
│           ├── brain_dump_controller.ex
│           ├── habits_controller.ex
│           ├── journal_controller.ex
│           ├── settings_controller.ex
│           └── context_controller.ex   # scaffold
├── priv/
│   └── repo/migrations/
│       ├── 20260329000001_create_inbox_items.exs
│       ├── 20260329000002_create_habits.exs
│       ├── 20260329000003_create_journal_entries.exs
│       ├── 20260329000004_create_settings.exs
│       ├── 20260329000005_create_tasks.exs          # scaffold
│       ├── 20260329000006_create_goals.exs           # scaffold
│       ├── 20260329000007_create_focus.exs           # scaffold
│       ├── 20260329000008_create_notes.exs           # scaffold
│       ├── 20260329000009_create_vault_index.exs     # scaffold
│       ├── 20260329000010_create_claude_sessions.exs # scaffold
│       ├── 20260329000011_create_agents.exs          # scaffold
│       └── 20260329000012_create_app_shortcuts.exs   # scaffold
└── test/
    ├── test_helper.exs
    ├── place/
    │   ├── brain_dump_test.exs
    │   ├── habits_test.exs
    │   ├── journal_test.exs
    │   └── settings_test.exs
    └── place_web/
        ├── controllers/
        │   ├── brain_dump_controller_test.exs
        │   ├── habits_controller_test.exs
        │   └── journal_controller_test.exs
        └── channels/
            ├── brain_dump_channel_test.exs
            ├── habits_channel_test.exs
            └── journal_channel_test.exs
```

### Frontend (`app/`)

```
app/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   └── globals.css                 # Tailwind + design tokens + glass classes
│   ├── types/
│   │   ├── brain-dump.ts
│   │   ├── habits.ts
│   │   ├── journal.ts
│   │   └── settings.ts
│   ├── lib/
│   │   ├── ws.ts                       # Phoenix channel client
│   │   ├── api.ts                      # REST client
│   │   ├── date-utils.ts
│   │   └── springs.ts                  # Animation configs
│   ├── stores/
│   │   ├── dashboard-store.ts
│   │   ├── brain-dump-store.ts
│   │   ├── habits-store.ts
│   │   ├── journal-store.ts
│   │   └── settings-store.ts
│   └── components/
│       ├── ui/
│       │   ├── GlassCard.tsx
│       │   ├── SegmentedControl.tsx
│       │   ├── Badge.tsx
│       │   └── Tooltip.tsx
│       ├── layout/
│       │   ├── Shell.tsx
│       │   ├── AmbientStrip.tsx
│       │   ├── Sidebar.tsx
│       │   └── CommandBar.tsx
│       ├── dashboard/
│       │   ├── DashboardPage.tsx
│       │   ├── OneThingCard.tsx
│       │   ├── HabitsSummaryCard.tsx
│       │   ├── BrainDumpCard.tsx
│       │   ├── MoodEnergyCard.tsx
│       │   ├── JournalPreviewCard.tsx
│       │   └── QuickLinksCard.tsx
│       ├── brain-dump/
│       │   ├── BrainDumpPage.tsx
│       │   ├── CaptureInput.tsx
│       │   ├── InboxQueue.tsx
│       │   ├── InboxItem.tsx
│       │   └── KanbanView.tsx
│       ├── habits/
│       │   ├── HabitsPage.tsx
│       │   ├── HabitRow.tsx
│       │   ├── AddHabitForm.tsx
│       │   ├── StreakGrid.tsx
│       │   ├── WeekView.tsx
│       │   ├── MonthView.tsx
│       │   └── StreaksView.tsx
│       ├── journal/
│       │   ├── JournalPage.tsx
│       │   ├── CalendarStrip.tsx
│       │   ├── OneThingInput.tsx
│       │   ├── JournalEditor.tsx
│       │   ├── MoodPicker.tsx
│       │   └── EnergyTracker.tsx
│       └── settings/
│           └── SettingsPage.tsx
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   └── src/
│       └── lib.rs
└── tests/
    ├── setup.ts
    ├── stores/
    │   ├── brain-dump-store.test.ts
    │   ├── habits-store.test.ts
    │   └── journal-store.test.ts
    └── components/
        ├── brain-dump.test.tsx
        ├── habits.test.tsx
        └── journal.test.tsx
```

### Root

```
place-native/
├── scripts/
│   ├── install.sh
│   ├── dev.sh
│   └── place-native.service
├── docs/superpowers/specs/...
├── docs/superpowers/plans/...
└── README.md
```

---

## Phase 0: Environment Setup

### Task 0: Install Elixir, Erlang, and Tauri CLI

**Files:**
- Create: `scripts/install.sh`

- [ ] **Step 1: Install Erlang and Elixir via apt**

```bash
sudo apt-get install -y erlang elixir
```

Verify:

```bash
elixir --version
# Expected: Elixir 1.17+ (Ubuntu 24.04 ships 1.16, which is fine)
erl -eval 'erlang:display(erlang:system_info(otp_release)), halt().' -noshell
# Expected: "26" or "27"
```

If the apt version is too old (below 1.14), install via asdf instead:

```bash
git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.15.0
echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
source ~/.bashrc
asdf plugin add erlang
asdf plugin add elixir
asdf install erlang 27.2
asdf install elixir 1.18.3-otp-27
asdf global erlang 27.2
asdf global elixir 1.18.3-otp-27
```

- [ ] **Step 2: Install Tauri CLI**

```bash
cargo install tauri-cli --version "^2"
```

Verify:

```bash
cargo tauri --version
# Expected: tauri-cli 2.x.x
```

- [ ] **Step 3: Install Phoenix project generator**

```bash
mix local.hex --force
mix local.rebar --force
mix archive.install hex phx_new --force
```

- [ ] **Step 4: Write install.sh script**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== place-native setup ==="

# Check Elixir
if ! command -v elixir &>/dev/null; then
  echo "ERROR: Elixir not found. Install via: sudo apt-get install erlang elixir"
  exit 1
fi

# Check Rust/Cargo
if ! command -v cargo &>/dev/null; then
  echo "ERROR: Rust not found. Install via: https://rustup.rs"
  exit 1
fi

# Check Tauri CLI
if ! cargo install --list | grep -q tauri-cli; then
  echo "Installing Tauri CLI..."
  cargo install tauri-cli --version "^2"
fi

# Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Install via: npm install -g pnpm"
  exit 1
fi

# Daemon deps
echo "Installing daemon dependencies..."
cd daemon
mix deps.get
mix ecto.create
mix ecto.migrate
cd ..

# Frontend deps
echo "Installing frontend dependencies..."
cd app
pnpm install
cd ..

# Data directory
mkdir -p ~/.local/share/place-native

echo "=== Setup complete ==="
```

- [ ] **Step 5: Commit**

```bash
chmod +x scripts/install.sh
git add scripts/install.sh
git commit -m "chore: add install script and document setup requirements"
```

---

## Phase 1: Elixir Daemon — Foundation

### Task 1: Create Phoenix Project

**Files:**
- Create: `daemon/` (entire Phoenix project scaffold)

- [ ] **Step 1: Generate Phoenix project (no HTML, no assets, no mailer, no dashboard)**

```bash
cd /home/trajan/Projects/ema
mix phx.new daemon --no-html --no-assets --no-mailer --no-dashboard --no-gettext --database sqlite3
```

When prompted "Fetch and install dependencies?", answer `Y`.

- [ ] **Step 2: Verify project compiles**

```bash
cd daemon
mix compile
```

Expected: Compilation succeeds with 0 errors.

- [ ] **Step 3: Configure SQLite to use place-native data dir**

Edit `daemon/config/dev.exs` — replace the database path:

```elixir
config :daemon, Place.Repo,
  database: Path.expand("~/.local/share/place-native/place_dev.db"),
  pool_size: 5,
  stacktrace: true,
  show_sensitive_data_on_connection_error: true
```

Edit `daemon/config/runtime.exs` — replace the prod database config:

```elixir
if config_env() == :prod do
  config :daemon, Place.Repo,
    database: Path.expand("~/.local/share/place-native/place.db"),
    pool_size: 5
end
```

- [ ] **Step 4: Rename module references from Daemon to Place**

The `phx.new` generator names modules after the project folder. We need `Place` and `PlaceWeb`, not `Daemon` and `DaemonWeb`. In every file under `daemon/lib/`, `daemon/config/`, and `daemon/test/`:

- Replace `Daemon.Repo` → `Place.Repo`
- Replace `Daemon.Application` → `Place.Application`
- Replace `DaemonWeb` → `PlaceWeb`
- Replace `Daemon.` → `Place.` (module prefix)
- Replace `:daemon` → `:place` (OTP app name)
- Update `mix.exs`: `app: :place`, `mod: {Place.Application, []}`

Verify after rename:

```bash
mix compile
```

- [ ] **Step 5: Configure endpoint for localhost:4488**

Edit `daemon/config/dev.exs`:

```elixir
config :place, PlaceWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4488],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dev-only-secret-key-base-that-is-at-least-64-bytes-long-for-development-use",
  watchers: []
```

- [ ] **Step 6: Create data directory and verify server starts**

```bash
mkdir -p ~/.local/share/place-native
mix ecto.create
mix phx.server
```

Expected: Server starts on `http://localhost:4488`. Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: scaffold Phoenix daemon on localhost:4488 with SQLite"
```

---

### Task 2: WebSocket Infrastructure

**Files:**
- Create: `daemon/lib/place_web/user_socket.ex`
- Modify: `daemon/lib/place_web/endpoint.ex`

- [ ] **Step 1: Create UserSocket**

Write `daemon/lib/place_web/user_socket.ex`:

```elixir
defmodule PlaceWeb.UserSocket do
  use Phoenix.Socket

  channel "dashboard:*", PlaceWeb.DashboardChannel
  channel "brain_dump:*", PlaceWeb.BrainDumpChannel
  channel "habits:*", PlaceWeb.HabitsChannel
  channel "journal:*", PlaceWeb.JournalChannel
  channel "settings:*", PlaceWeb.SettingsChannel

  @impl true
  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
```

- [ ] **Step 2: Create stub channels (one per domain)**

Write `daemon/lib/place_web/channels/dashboard_channel.ex`:

```elixir
defmodule PlaceWeb.DashboardChannel do
  use Phoenix.Channel

  @impl true
  def join("dashboard:lobby", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
```

Write `daemon/lib/place_web/channels/brain_dump_channel.ex`:

```elixir
defmodule PlaceWeb.BrainDumpChannel do
  use Phoenix.Channel

  @impl true
  def join("brain_dump:queue", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
```

Write `daemon/lib/place_web/channels/habits_channel.ex`:

```elixir
defmodule PlaceWeb.HabitsChannel do
  use Phoenix.Channel

  @impl true
  def join("habits:tracker", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
```

Write `daemon/lib/place_web/channels/journal_channel.ex`:

```elixir
defmodule PlaceWeb.JournalChannel do
  use Phoenix.Channel

  @impl true
  def join("journal:today", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
```

Write `daemon/lib/place_web/channels/settings_channel.ex`:

```elixir
defmodule PlaceWeb.SettingsChannel do
  use Phoenix.Channel

  @impl true
  def join("settings:sync", _payload, socket) do
    {:ok, %{status: "connected"}, socket}
  end
end
```

- [ ] **Step 3: Mount socket in endpoint**

Add to `daemon/lib/place_web/endpoint.ex`, before the `plug Plug.RequestId` line:

```elixir
  socket "/socket", PlaceWeb.UserSocket,
    websocket: [timeout: 45_000],
    longpoll: false
```

- [ ] **Step 4: Verify compilation**

```bash
cd daemon && mix compile
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: add WebSocket infrastructure with 5 channel stubs"
```

---

### Task 3: Brain Dump Context + Migration

**Files:**
- Create: `daemon/priv/repo/migrations/20260329000001_create_inbox_items.exs`
- Create: `daemon/lib/place/brain_dump/item.ex`
- Create: `daemon/lib/place/brain_dump/brain_dump.ex`
- Create: `daemon/test/place/brain_dump_test.exs`

- [ ] **Step 1: Write the migration**

```bash
cd daemon && mix ecto.gen.migration create_inbox_items
```

Edit the generated migration file:

```elixir
defmodule Place.Repo.Migrations.CreateInboxItems do
  use Ecto.Migration

  def change do
    create table(:inbox_items, primary_key: false) do
      add :id, :string, primary_key: true
      add :content, :text, null: false
      add :source, :string, null: false, default: "text"
      add :processed, :boolean, null: false, default: false
      add :action, :string
      add :processed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:inbox_items, [:processed])
  end
end
```

- [ ] **Step 2: Write the Ecto schema**

Write `daemon/lib/place/brain_dump/item.ex`:

```elixir
defmodule Place.BrainDump.Item do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "inbox_items" do
    field :content, :string
    field :source, :string, default: "text"
    field :processed, :boolean, default: false
    field :action, :string
    field :processed_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @valid_sources ~w(text shortcut clipboard)
  @valid_actions ~w(task journal archive note processing)

  def create_changeset(item, attrs) do
    item
    |> cast(attrs, [:id, :content, :source])
    |> validate_required([:id, :content])
    |> validate_inclusion(:source, @valid_sources)
  end

  def process_changeset(item, attrs) do
    item
    |> cast(attrs, [:processed, :action, :processed_at])
    |> validate_required([:processed, :action])
    |> validate_inclusion(:action, @valid_actions)
  end
end
```

- [ ] **Step 3: Write the context module**

Write `daemon/lib/place/brain_dump/brain_dump.ex`:

```elixir
defmodule Place.BrainDump do
  @moduledoc """
  Brain Dump — quick capture inbox for thoughts, ideas, and fleeting notes.

  Items flow: capture → inbox → process (to task/journal/note/archive).
  Supports queue view (list) and kanban view (inbox/processing/done columns).
  """

  import Ecto.Query
  alias Place.Repo
  alias Place.BrainDump.Item

  @doc "List all items, newest first."
  def list_items do
    Item
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  @doc "List unprocessed items, oldest first (queue order)."
  def list_unprocessed do
    Item
    |> where([i], i.processed == false)
    |> order_by(asc: :inserted_at)
    |> Repo.all()
  end

  @doc "Count unprocessed items."
  def unprocessed_count do
    Item
    |> where([i], i.processed == false)
    |> Repo.aggregate(:count)
  end

  @doc "Get a single item by ID."
  def get_item(id), do: Repo.get(Item, id)

  @doc "Create a new inbox item."
  def create_item(attrs) do
    id = generate_id()

    %Item{}
    |> Item.create_changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  @doc "Mark an item as processed with the given action."
  def process_item(id, action) when action in ~w(task journal archive note) do
    case get_item(id) do
      nil ->
        {:error, :not_found}

      item ->
        item
        |> Item.process_changeset(%{
          processed: true,
          action: action,
          processed_at: DateTime.utc_now()
        })
        |> Repo.update()
    end
  end

  @doc "Move item to processing column (kanban)."
  def move_to_processing(id) do
    case get_item(id) do
      nil -> {:error, :not_found}
      item -> item |> Ecto.Changeset.change(action: "processing") |> Repo.update()
    end
  end

  @doc "Reset a processed item back to inbox."
  def unprocess_item(id) do
    case get_item(id) do
      nil ->
        {:error, :not_found}

      item ->
        item
        |> Ecto.Changeset.change(processed: false, action: nil, processed_at: nil)
        |> Repo.update()
    end
  end

  @doc "Delete an item permanently."
  def delete_item(id) do
    case get_item(id) do
      nil -> {:error, :not_found}
      item -> Repo.delete(item)
    end
  end

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "bd_#{timestamp}_#{random}"
  end
end
```

- [ ] **Step 4: Write context tests**

Write `daemon/test/place/brain_dump_test.exs`:

```elixir
defmodule Place.BrainDumpTest do
  use Place.DataCase, async: true

  alias Place.BrainDump

  describe "create_item/1" do
    test "creates an item with valid attrs" do
      assert {:ok, item} = BrainDump.create_item(%{content: "Buy milk"})
      assert item.content == "Buy milk"
      assert item.source == "text"
      assert item.processed == false
      assert item.action == nil
      assert String.starts_with?(item.id, "bd_")
    end

    test "fails without content" do
      assert {:error, changeset} = BrainDump.create_item(%{})
      assert %{content: ["can't be blank"]} = errors_on(changeset)
    end
  end

  describe "list_unprocessed/0" do
    test "returns only unprocessed items in queue order" do
      {:ok, first} = BrainDump.create_item(%{content: "First"})
      {:ok, _processed} = BrainDump.create_item(%{content: "Processed"})
      {:ok, second} = BrainDump.create_item(%{content: "Second"})

      BrainDump.process_item(_processed.id, "archive")

      items = BrainDump.list_unprocessed()
      assert length(items) == 2
      assert hd(items).id == first.id
    end
  end

  describe "process_item/2" do
    test "marks item as processed" do
      {:ok, item} = BrainDump.create_item(%{content: "Process me"})
      assert {:ok, processed} = BrainDump.process_item(item.id, "task")
      assert processed.processed == true
      assert processed.action == "task"
      assert processed.processed_at != nil
    end

    test "returns error for non-existent item" do
      assert {:error, :not_found} = BrainDump.process_item("nope", "task")
    end
  end

  describe "delete_item/1" do
    test "deletes an existing item" do
      {:ok, item} = BrainDump.create_item(%{content: "Delete me"})
      assert {:ok, _} = BrainDump.delete_item(item.id)
      assert BrainDump.get_item(item.id) == nil
    end
  end

  describe "unprocessed_count/0" do
    test "returns count of unprocessed items" do
      {:ok, _} = BrainDump.create_item(%{content: "One"})
      {:ok, item} = BrainDump.create_item(%{content: "Two"})
      BrainDump.process_item(item.id, "archive")

      assert BrainDump.unprocessed_count() == 1
    end
  end
end
```

- [ ] **Step 5: Run migration and tests**

```bash
cd daemon
mix ecto.migrate
mix test test/place/brain_dump_test.exs
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: add Brain Dump context with schema, queries, and tests"
```

---

### Task 4: Habits Context + Migration

**Files:**
- Create: `daemon/priv/repo/migrations/..._create_habits.exs`
- Create: `daemon/lib/place/habits/habit.ex`
- Create: `daemon/lib/place/habits/habit_log.ex`
- Create: `daemon/lib/place/habits/habits.ex`
- Create: `daemon/test/place/habits_test.exs`

- [ ] **Step 1: Write the migration**

```bash
cd daemon && mix ecto.gen.migration create_habits
```

Edit the generated file:

```elixir
defmodule Place.Repo.Migrations.CreateHabits do
  use Ecto.Migration

  def change do
    create table(:habits, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :frequency, :string, null: false, default: "daily"
      add :target, :string
      add :active, :boolean, null: false, default: true
      add :sort_order, :integer, null: false, default: 0
      add :color, :string

      timestamps(type: :utc_datetime)
    end

    create table(:habit_logs, primary_key: false) do
      add :id, :string, primary_key: true
      add :habit_id, references(:habits, type: :string, on_delete: :delete_all), null: false
      add :date, :string, null: false
      add :completed, :boolean, null: false, default: false
      add :notes, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:habit_logs, [:habit_id, :date])
    create index(:habit_logs, [:habit_id])
    create index(:habit_logs, [:date])
  end
end
```

- [ ] **Step 2: Write Habit schema**

Write `daemon/lib/place/habits/habit.ex`:

```elixir
defmodule Place.Habits.Habit do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "habits" do
    field :name, :string
    field :frequency, :string, default: "daily"
    field :target, :string
    field :active, :boolean, default: true
    field :sort_order, :integer, default: 0
    field :color, :string

    has_many :logs, Place.Habits.HabitLog

    timestamps(type: :utc_datetime)
  end

  @colors ~w(#5b9cf5 #38c97a #e8a84c #ef6b6b #a78bfa #f472b6 #34d399)

  def colors, do: @colors

  def changeset(habit, attrs) do
    habit
    |> cast(attrs, [:id, :name, :frequency, :target, :active, :sort_order, :color])
    |> validate_required([:id, :name, :frequency])
    |> validate_inclusion(:frequency, ~w(daily weekly))
  end
end
```

- [ ] **Step 3: Write HabitLog schema**

Write `daemon/lib/place/habits/habit_log.ex`:

```elixir
defmodule Place.Habits.HabitLog do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "habit_logs" do
    field :date, :string
    field :completed, :boolean, default: false
    field :notes, :string

    belongs_to :habit, Place.Habits.Habit, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(log, attrs) do
    log
    |> cast(attrs, [:id, :habit_id, :date, :completed, :notes])
    |> validate_required([:id, :habit_id, :date])
    |> unique_constraint([:habit_id, :date])
  end
end
```

- [ ] **Step 4: Write Habits context**

Write `daemon/lib/place/habits/habits.ex`:

```elixir
defmodule Place.Habits do
  @moduledoc """
  Habits — daily/weekly habit tracking with streak calculations.

  Max 7 active habits. Each habit gets a color from a 7-color palette.
  Logs are per-habit per-date. Streaks calculated by consecutive completed days.
  """

  import Ecto.Query
  alias Place.Repo
  alias Place.Habits.{Habit, HabitLog}

  @max_habits 7

  def list_active do
    Habit
    |> where([h], h.active == true)
    |> order_by(asc: :sort_order, asc: :inserted_at)
    |> Repo.all()
  end

  def get_habit(id), do: Repo.get(Habit, id)

  def create_habit(attrs) do
    active_count = Habit |> where([h], h.active == true) |> Repo.aggregate(:count)

    if active_count >= @max_habits do
      {:error, :limit_reached}
    else
      color = assign_color(active_count)
      id = generate_id("hab")

      %Habit{}
      |> Habit.changeset(Map.merge(attrs, %{id: id, color: color, sort_order: active_count}))
      |> Repo.insert()
    end
  end

  def archive_habit(id) do
    case get_habit(id) do
      nil -> {:error, :not_found}
      habit -> habit |> Ecto.Changeset.change(active: false) |> Repo.update()
    end
  end

  def toggle_log(habit_id, date) do
    case Repo.get_by(HabitLog, habit_id: habit_id, date: date) do
      nil ->
        %HabitLog{}
        |> HabitLog.changeset(%{
          id: generate_id("hl"),
          habit_id: habit_id,
          date: date,
          completed: true
        })
        |> Repo.insert()

      log ->
        log
        |> Ecto.Changeset.change(completed: !log.completed)
        |> Repo.update()
    end
  end

  def logs_for_date(date) do
    HabitLog
    |> where([l], l.date == ^date)
    |> Repo.all()
  end

  def logs_for_range(habit_id, start_date, end_date) do
    HabitLog
    |> where([l], l.habit_id == ^habit_id)
    |> where([l], l.date >= ^start_date and l.date <= ^end_date)
    |> order_by(asc: :date)
    |> Repo.all()
  end

  def calculate_streak(habit_id) do
    today = Date.utc_today() |> Date.to_iso8601()

    logs =
      HabitLog
      |> where([l], l.habit_id == ^habit_id and l.completed == true)
      |> order_by(desc: :date)
      |> limit(60)
      |> Repo.all()

    completed_dates = MapSet.new(logs, & &1.date)
    count_streak(today, completed_dates, 0)
  end

  defp count_streak(date_str, completed_dates, acc) do
    if MapSet.member?(completed_dates, date_str) do
      prev = date_str |> Date.from_iso8601!() |> Date.add(-1) |> Date.to_iso8601()
      count_streak(prev, completed_dates, acc + 1)
    else
      acc
    end
  end

  defp assign_color(index) do
    colors = Habit.colors()
    Enum.at(colors, rem(index, length(colors)))
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
```

- [ ] **Step 5: Write habits tests**

Write `daemon/test/place/habits_test.exs`:

```elixir
defmodule Place.HabitsTest do
  use Place.DataCase, async: true

  alias Place.Habits

  describe "create_habit/1" do
    test "creates a habit with auto-assigned color" do
      assert {:ok, habit} = Habits.create_habit(%{name: "Meditate", frequency: "daily"})
      assert habit.name == "Meditate"
      assert habit.color == "#5b9cf5"
      assert habit.active == true
    end

    test "enforces 7 habit limit" do
      for i <- 1..7, do: Habits.create_habit(%{name: "Habit #{i}"})
      assert {:error, :limit_reached} = Habits.create_habit(%{name: "Habit 8"})
    end
  end

  describe "toggle_log/2" do
    test "creates log on first toggle" do
      {:ok, habit} = Habits.create_habit(%{name: "Read"})
      today = Date.utc_today() |> Date.to_iso8601()

      assert {:ok, log} = Habits.toggle_log(habit.id, today)
      assert log.completed == true
    end

    test "toggles existing log off" do
      {:ok, habit} = Habits.create_habit(%{name: "Read"})
      today = Date.utc_today() |> Date.to_iso8601()

      {:ok, _} = Habits.toggle_log(habit.id, today)
      {:ok, log} = Habits.toggle_log(habit.id, today)
      assert log.completed == false
    end
  end

  describe "calculate_streak/1" do
    test "returns 0 for no logs" do
      {:ok, habit} = Habits.create_habit(%{name: "Run"})
      assert Habits.calculate_streak(habit.id) == 0
    end

    test "counts consecutive days" do
      {:ok, habit} = Habits.create_habit(%{name: "Run"})
      today = Date.utc_today()

      for offset <- 0..4 do
        date = today |> Date.add(-offset) |> Date.to_iso8601()
        Habits.toggle_log(habit.id, date)
      end

      assert Habits.calculate_streak(habit.id) == 5
    end
  end

  describe "archive_habit/1" do
    test "soft-deletes a habit" do
      {:ok, habit} = Habits.create_habit(%{name: "Delete me"})
      assert {:ok, archived} = Habits.archive_habit(habit.id)
      assert archived.active == false
      assert Habits.list_active() == []
    end
  end
end
```

- [ ] **Step 6: Run migration and tests**

```bash
cd daemon
mix ecto.migrate
mix test test/place/habits_test.exs
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: add Habits context with streak calculation and tests"
```

---

### Task 5: Journal Context + Migration

**Files:**
- Create: `daemon/priv/repo/migrations/..._create_journal_entries.exs`
- Create: `daemon/lib/place/journal/entry.ex`
- Create: `daemon/lib/place/journal/journal.ex`
- Create: `daemon/test/place/journal_test.exs`

- [ ] **Step 1: Write the migration**

```bash
cd daemon && mix ecto.gen.migration create_journal_entries
```

```elixir
defmodule Place.Repo.Migrations.CreateJournalEntries do
  use Ecto.Migration

  def change do
    create table(:journal_entries, primary_key: false) do
      add :id, :string, primary_key: true
      add :date, :string, null: false
      add :content, :text, null: false, default: ""
      add :one_thing, :string
      add :mood, :integer
      add :energy_p, :integer
      add :energy_m, :integer
      add :energy_e, :integer
      add :gratitude, :text
      add :tags, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:journal_entries, [:date])
  end
end
```

- [ ] **Step 2: Write Entry schema**

Write `daemon/lib/place/journal/entry.ex`:

```elixir
defmodule Place.Journal.Entry do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "journal_entries" do
    field :date, :string
    field :content, :string, default: ""
    field :one_thing, :string
    field :mood, :integer
    field :energy_p, :integer
    field :energy_m, :integer
    field :energy_e, :integer
    field :gratitude, :string
    field :tags, :string

    timestamps(type: :utc_datetime)
  end

  @default_template """
  ## Today's Focus

  ## Notes

  ## Ideas & Thoughts

  ## Gratitude
  1.
  2.
  3.

  ## Reflection
  """

  def default_template, do: @default_template

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:id, :date, :content, :one_thing, :mood, :energy_p, :energy_m, :energy_e, :gratitude, :tags])
    |> validate_required([:id, :date])
    |> validate_inclusion(:mood, [1, 2, 3, 4, 5])
    |> validate_number(:energy_p, greater_than_or_equal_to: 1, less_than_or_equal_to: 10)
    |> validate_number(:energy_m, greater_than_or_equal_to: 1, less_than_or_equal_to: 10)
    |> validate_number(:energy_e, greater_than_or_equal_to: 1, less_than_or_equal_to: 10)
    |> unique_constraint(:date)
  end
end
```

- [ ] **Step 3: Write Journal context**

Write `daemon/lib/place/journal/journal.ex`:

```elixir
defmodule Place.Journal do
  @moduledoc """
  Journal — daily entries with mood tracking, energy levels, and markdown content.

  One entry per date. Auto-creates with template on first access.
  Supports full-text search across content and one_thing fields.
  """

  import Ecto.Query
  alias Place.Repo
  alias Place.Journal.Entry

  def get_entry(date) do
    Repo.get_by(Entry, date: date)
  end

  def get_or_create_entry(date) do
    case get_entry(date) do
      nil -> create_entry(date)
      entry -> {:ok, entry}
    end
  end

  def create_entry(date) do
    id = generate_id("jrn")

    %Entry{}
    |> Entry.changeset(%{id: id, date: date, content: Entry.default_template()})
    |> Repo.insert()
  end

  def update_entry(date, attrs) do
    case get_or_create_entry(date) do
      {:ok, entry} ->
        entry
        |> Entry.changeset(attrs)
        |> Repo.update()

      {:error, _} = err ->
        err
    end
  end

  def list_entries(limit \\ 30) do
    Entry
    |> order_by(desc: :date)
    |> limit(^limit)
    |> Repo.all()
  end

  def search(query) when is_binary(query) and byte_size(query) > 0 do
    pattern = "%#{query}%"

    Entry
    |> where([e], like(e.content, ^pattern) or like(e.one_thing, ^pattern))
    |> order_by(desc: :date)
    |> limit(20)
    |> Repo.all()
  end

  def search(_), do: []

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
```

- [ ] **Step 4: Write journal tests**

Write `daemon/test/place/journal_test.exs`:

```elixir
defmodule Place.JournalTest do
  use Place.DataCase, async: true

  alias Place.Journal

  @today Date.utc_today() |> Date.to_iso8601()

  describe "get_or_create_entry/1" do
    test "creates entry with template on first access" do
      assert {:ok, entry} = Journal.get_or_create_entry(@today)
      assert entry.date == @today
      assert entry.content =~ "Today's Focus"
      assert entry.mood == nil
    end

    test "returns existing entry on subsequent access" do
      {:ok, first} = Journal.get_or_create_entry(@today)
      {:ok, second} = Journal.get_or_create_entry(@today)
      assert first.id == second.id
    end
  end

  describe "update_entry/2" do
    test "updates content" do
      {:ok, _} = Journal.get_or_create_entry(@today)
      assert {:ok, updated} = Journal.update_entry(@today, %{content: "New content"})
      assert updated.content == "New content"
    end

    test "updates mood and energy" do
      assert {:ok, entry} = Journal.update_entry(@today, %{mood: 4, energy_p: 7, energy_m: 8, energy_e: 6})
      assert entry.mood == 4
      assert entry.energy_p == 7
    end

    test "rejects invalid mood" do
      assert {:error, changeset} = Journal.update_entry(@today, %{mood: 6})
      assert %{mood: _} = errors_on(changeset)
    end
  end

  describe "search/1" do
    test "finds entries by content" do
      Journal.update_entry(@today, %{content: "Worked on place-native daemon"})
      results = Journal.search("place-native")
      assert length(results) == 1
    end

    test "returns empty for blank query" do
      assert Journal.search("") == []
    end
  end
end
```

- [ ] **Step 5: Run migration and tests**

```bash
cd daemon
mix ecto.migrate
mix test test/place/journal_test.exs
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: add Journal context with entry management, search, and tests"
```

---

### Task 6: Settings Context + Migration

**Files:**
- Create: `daemon/priv/repo/migrations/..._create_settings.exs`
- Create: `daemon/lib/place/settings/setting.ex`
- Create: `daemon/lib/place/settings/settings.ex`
- Create: `daemon/test/place/settings_test.exs`

- [ ] **Step 1: Write migration**

```bash
cd daemon && mix ecto.gen.migration create_settings
```

```elixir
defmodule Place.Repo.Migrations.CreateSettings do
  use Ecto.Migration

  def change do
    create table(:settings, primary_key: false) do
      add :key, :string, primary_key: true
      add :value, :text, null: false

      timestamps(type: :utc_datetime)
    end
  end
end
```

- [ ] **Step 2: Write schema + context**

Write `daemon/lib/place/settings/setting.ex`:

```elixir
defmodule Place.Settings.Setting do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:key, :string, autogenerate: false}

  schema "settings" do
    field :value, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(setting, attrs) do
    setting
    |> cast(attrs, [:key, :value])
    |> validate_required([:key, :value])
  end
end
```

Write `daemon/lib/place/settings/settings.ex`:

```elixir
defmodule Place.Settings do
  @moduledoc """
  Settings — key-value store for user preferences.

  Values stored as JSON strings. Provides typed get/set with defaults.
  """

  alias Place.Repo
  alias Place.Settings.Setting

  @defaults %{
    "color_mode" => "dark",
    "accent_color" => "teal",
    "glass_intensity" => "0.65",
    "font_family" => "system",
    "font_size" => "14",
    "launch_on_boot" => "true",
    "start_minimized" => "false",
    "shortcut_capture" => "Super+Shift+C",
    "shortcut_toggle" => "Super+Shift+Space"
  }

  def get(key) do
    case Repo.get(Setting, key) do
      nil -> Map.get(@defaults, key)
      setting -> setting.value
    end
  end

  def set(key, value) do
    value_str = to_string(value)

    case Repo.get(Setting, key) do
      nil ->
        %Setting{}
        |> Setting.changeset(%{key: key, value: value_str})
        |> Repo.insert()

      setting ->
        setting
        |> Setting.changeset(%{value: value_str})
        |> Repo.update()
    end
  end

  def all do
    settings = Repo.all(Setting) |> Map.new(&{&1.key, &1.value})
    Map.merge(@defaults, settings)
  end

  def defaults, do: @defaults
end
```

- [ ] **Step 3: Write tests**

Write `daemon/test/place/settings_test.exs`:

```elixir
defmodule Place.SettingsTest do
  use Place.DataCase, async: true

  alias Place.Settings

  test "returns default for unset key" do
    assert Settings.get("color_mode") == "dark"
  end

  test "set and get a value" do
    {:ok, _} = Settings.set("color_mode", "light")
    assert Settings.get("color_mode") == "light"
  end

  test "overwrites existing value" do
    {:ok, _} = Settings.set("font_size", "16")
    {:ok, _} = Settings.set("font_size", "18")
    assert Settings.get("font_size") == "18"
  end

  test "all/0 merges defaults with stored values" do
    {:ok, _} = Settings.set("color_mode", "light")
    all = Settings.all()
    assert all["color_mode"] == "light"
    assert all["glass_intensity"] == "0.65"
  end
end
```

- [ ] **Step 4: Run migration and tests**

```bash
cd daemon
mix ecto.migrate
mix test test/place/settings_test.exs
```

- [ ] **Step 5: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: add Settings context with key-value store and defaults"
```

---

### Task 7: REST Controllers

**Files:**
- Create: `daemon/lib/place_web/controllers/brain_dump_controller.ex`
- Create: `daemon/lib/place_web/controllers/habits_controller.ex`
- Create: `daemon/lib/place_web/controllers/journal_controller.ex`
- Create: `daemon/lib/place_web/controllers/settings_controller.ex`
- Create: `daemon/lib/place_web/controllers/dashboard_controller.ex`
- Create: `daemon/lib/place_web/controllers/context_controller.ex`
- Modify: `daemon/lib/place_web/router.ex`
- Create: `daemon/lib/place_web/controllers/fallback_controller.ex`

- [ ] **Step 1: Write fallback controller for error handling**

Write `daemon/lib/place_web/controllers/fallback_controller.ex`:

```elixir
defmodule PlaceWeb.FallbackController do
  use PlaceWeb, :controller

  def call(conn, {:error, :not_found}) do
    conn |> put_status(:not_found) |> json(%{error: "not_found"})
  end

  def call(conn, {:error, :limit_reached}) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: "limit_reached"})
  end

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    errors =
      Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
        Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
          opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
        end)
      end)

    conn |> put_status(:unprocessable_entity) |> json(%{error: "validation_failed", fields: errors})
  end
end
```

- [ ] **Step 2: Write BrainDump controller**

Write `daemon/lib/place_web/controllers/brain_dump_controller.ex`:

```elixir
defmodule PlaceWeb.BrainDumpController do
  use PlaceWeb, :controller

  alias Place.BrainDump
  action_fallback PlaceWeb.FallbackController

  def index(conn, _params) do
    items = BrainDump.list_items()
    json(conn, %{items: Enum.map(items, &serialize_item/1)})
  end

  def create(conn, %{"content" => content} = params) do
    source = Map.get(params, "source", "text")

    with {:ok, item} <- BrainDump.create_item(%{content: content, source: source}) do
      PlaceWeb.Endpoint.broadcast!("brain_dump:queue", "item_created", serialize_item(item))
      conn |> put_status(:created) |> json(serialize_item(item))
    end
  end

  def process(conn, %{"id" => id, "action" => action}) do
    with {:ok, item} <- BrainDump.process_item(id, action) do
      PlaceWeb.Endpoint.broadcast!("brain_dump:queue", "item_processed", serialize_item(item))
      json(conn, serialize_item(item))
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- BrainDump.delete_item(id) do
      PlaceWeb.Endpoint.broadcast!("brain_dump:queue", "item_deleted", %{id: id})
      json(conn, %{ok: true})
    end
  end

  defp serialize_item(item) do
    %{
      id: item.id,
      content: item.content,
      source: item.source,
      processed: item.processed,
      action: item.action,
      processed_at: item.processed_at,
      created_at: item.inserted_at,
      updated_at: item.updated_at
    }
  end
end
```

- [ ] **Step 3: Write Habits controller**

Write `daemon/lib/place_web/controllers/habits_controller.ex`:

```elixir
defmodule PlaceWeb.HabitsController do
  use PlaceWeb, :controller

  alias Place.Habits
  action_fallback PlaceWeb.FallbackController

  def index(conn, _params) do
    habits = Habits.list_active()
    json(conn, %{habits: Enum.map(habits, &serialize_habit/1)})
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"],
      frequency: params["frequency"] || "daily",
      target: params["target"]
    }

    with {:ok, habit} <- Habits.create_habit(attrs) do
      PlaceWeb.Endpoint.broadcast!("habits:tracker", "habit_created", serialize_habit(habit))
      conn |> put_status(:created) |> json(serialize_habit(habit))
    end
  end

  def archive(conn, %{"id" => id}) do
    with {:ok, habit} <- Habits.archive_habit(id) do
      PlaceWeb.Endpoint.broadcast!("habits:tracker", "habit_archived", %{id: id})
      json(conn, serialize_habit(habit))
    end
  end

  def toggle(conn, %{"id" => id} = params) do
    date = Map.get(params, "date", Date.utc_today() |> Date.to_iso8601())

    with {:ok, log} <- Habits.toggle_log(id, date) do
      streak = Habits.calculate_streak(id)

      PlaceWeb.Endpoint.broadcast!("habits:tracker", "habit_toggled", %{
        habit_id: id,
        date: date,
        completed: log.completed,
        streak: streak
      })

      json(conn, %{log: serialize_log(log), streak: streak})
    end
  end

  def logs(conn, %{"id" => id, "start" => start_date, "end" => end_date}) do
    logs = Habits.logs_for_range(id, start_date, end_date)
    json(conn, %{logs: Enum.map(logs, &serialize_log/1)})
  end

  def today_logs(conn, _params) do
    date = Date.utc_today() |> Date.to_iso8601()
    logs = Habits.logs_for_date(date)
    json(conn, %{logs: Enum.map(logs, &serialize_log/1)})
  end

  defp serialize_habit(h) do
    %{id: h.id, name: h.name, frequency: h.frequency, target: h.target,
      active: h.active, sort_order: h.sort_order, color: h.color,
      created_at: h.inserted_at, updated_at: h.updated_at}
  end

  defp serialize_log(l) do
    %{id: l.id, habit_id: l.habit_id, date: l.date, completed: l.completed, notes: l.notes}
  end
end
```

- [ ] **Step 4: Write Journal controller**

Write `daemon/lib/place_web/controllers/journal_controller.ex`:

```elixir
defmodule PlaceWeb.JournalController do
  use PlaceWeb, :controller

  alias Place.Journal
  action_fallback PlaceWeb.FallbackController

  def show(conn, %{"date" => date}) do
    case Journal.get_or_create_entry(date) do
      {:ok, entry} -> json(conn, serialize_entry(entry))
      {:error, _} = err -> err
    end
  end

  def update(conn, %{"date" => date} = params) do
    attrs =
      params
      |> Map.take(~w(content one_thing mood energy_p energy_m energy_e gratitude tags))
      |> Map.new(fn {k, v} -> {String.to_existing_atom(k), v} end)

    with {:ok, entry} <- Journal.update_entry(date, attrs) do
      PlaceWeb.Endpoint.broadcast!("journal:today", "entry_updated", serialize_entry(entry))
      json(conn, serialize_entry(entry))
    end
  end

  def search(conn, %{"q" => query}) do
    entries = Journal.search(query)
    json(conn, %{entries: Enum.map(entries, &serialize_entry/1)})
  end

  defp serialize_entry(e) do
    %{id: e.id, date: e.date, content: e.content, one_thing: e.one_thing,
      mood: e.mood, energy_p: e.energy_p, energy_m: e.energy_m, energy_e: e.energy_e,
      gratitude: e.gratitude, tags: e.tags,
      created_at: e.inserted_at, updated_at: e.updated_at}
  end
end
```

- [ ] **Step 5: Write Settings + Dashboard + Context controllers**

Write `daemon/lib/place_web/controllers/settings_controller.ex`:

```elixir
defmodule PlaceWeb.SettingsController do
  use PlaceWeb, :controller

  alias Place.Settings

  def index(conn, _params) do
    json(conn, Settings.all())
  end

  def update(conn, %{"key" => key, "value" => value}) do
    {:ok, _} = Settings.set(key, value)
    PlaceWeb.Endpoint.broadcast!("settings:sync", "setting_changed", %{key: key, value: value})
    json(conn, %{ok: true})
  end
end
```

Write `daemon/lib/place_web/controllers/dashboard_controller.ex`:

```elixir
defmodule PlaceWeb.DashboardController do
  use PlaceWeb, :controller

  alias Place.{BrainDump, Habits, Journal}

  def today(conn, _params) do
    date = Date.utc_today() |> Date.to_iso8601()
    habits = Habits.list_active()
    today_logs = Habits.logs_for_date(date)
    journal = Journal.get_entry(date)
    inbox_items = BrainDump.list_unprocessed() |> Enum.take(5)

    streaks =
      Map.new(habits, fn h -> {h.id, Habits.calculate_streak(h.id)} end)

    json(conn, %{
      date: date,
      inbox_count: BrainDump.unprocessed_count(),
      inbox_items: Enum.map(inbox_items, fn i ->
        %{id: i.id, content: i.content, created_at: i.inserted_at}
      end),
      habits: Enum.map(habits, fn h ->
        log = Enum.find(today_logs, &(&1.habit_id == h.id))
        %{id: h.id, name: h.name, color: h.color, completed: log != nil && log.completed, streak: streaks[h.id]}
      end),
      journal: if(journal, do: %{
        content: journal.content,
        one_thing: journal.one_thing,
        mood: journal.mood,
        energy_p: journal.energy_p,
        energy_m: journal.energy_m,
        energy_e: journal.energy_e
      }, else: nil)
    })
  end
end
```

Write `daemon/lib/place_web/controllers/context_controller.ex`:

```elixir
defmodule PlaceWeb.ContextController do
  @moduledoc """
  Context Bridge — executive summary endpoint for LLM consumption.
  Returns structured JSON of current user state.
  """
  use PlaceWeb, :controller

  alias Place.{BrainDump, Habits, Journal}

  def executive_summary(conn, _params) do
    date = Date.utc_today() |> Date.to_iso8601()
    habits = Habits.list_active()
    today_logs = Habits.logs_for_date(date)
    journal = Journal.get_entry(date)
    recent_captures = BrainDump.list_unprocessed() |> Enum.take(3)

    completed_count = Enum.count(today_logs, & &1.completed)

    json(conn, %{
      one_thing: if(journal, do: journal.one_thing),
      mood: if(journal, do: journal.mood),
      energy: if(journal, do: %{physical: journal.energy_p, mental: journal.energy_m, emotional: journal.energy_e}),
      habits_today: %{completed: completed_count, total: length(habits)},
      inbox_unprocessed: BrainDump.unprocessed_count(),
      recent_captures: Enum.map(recent_captures, & &1.content),
      journal_snippet: if(journal, do: String.slice(journal.content, 0, 200))
    })
  end
end
```

- [ ] **Step 6: Wire up routes**

Replace the contents of `daemon/lib/place_web/router.ex`:

```elixir
defmodule PlaceWeb.Router do
  use PlaceWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", PlaceWeb do
    pipe_through :api

    # Dashboard
    get "/dashboard/today", DashboardController, :today

    # Brain Dump
    get "/brain-dump/items", BrainDumpController, :index
    post "/brain-dump/items", BrainDumpController, :create
    patch "/brain-dump/items/:id/process", BrainDumpController, :process
    delete "/brain-dump/items/:id", BrainDumpController, :delete

    # Habits
    get "/habits", HabitsController, :index
    post "/habits", HabitsController, :create
    post "/habits/:id/archive", HabitsController, :archive
    post "/habits/:id/toggle", HabitsController, :toggle
    get "/habits/:id/logs", HabitsController, :logs
    get "/habits/today", HabitsController, :today_logs

    # Journal
    get "/journal/:date", JournalController, :show
    put "/journal/:date", JournalController, :update
    get "/journal/search", JournalController, :search

    # Settings
    get "/settings", SettingsController, :index
    put "/settings", SettingsController, :update

    # Context Bridge (scaffold)
    get "/context/executive-summary", ContextController, :executive_summary
  end
end
```

- [ ] **Step 7: Verify compilation and basic server test**

```bash
cd daemon
mix compile
mix phx.server &
sleep 2
curl -s http://localhost:4488/api/dashboard/today | python3 -m json.tool
kill %1
```

Expected: JSON response with today's dashboard data.

- [ ] **Step 8: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: add REST controllers and routing for all V1 endpoints"
```

---

### Task 8: Wire Up Channels with Real Data

**Files:**
- Modify: `daemon/lib/place_web/channels/dashboard_channel.ex`
- Modify: `daemon/lib/place_web/channels/brain_dump_channel.ex`
- Modify: `daemon/lib/place_web/channels/habits_channel.ex`
- Modify: `daemon/lib/place_web/channels/journal_channel.ex`

- [ ] **Step 1: Dashboard channel sends snapshot on join**

Replace `daemon/lib/place_web/channels/dashboard_channel.ex`:

```elixir
defmodule PlaceWeb.DashboardChannel do
  use Phoenix.Channel

  alias Place.{BrainDump, Habits, Journal}

  @impl true
  def join("dashboard:lobby", _payload, socket) do
    send(self(), :send_snapshot)
    {:ok, socket}
  end

  @impl true
  def handle_info(:send_snapshot, socket) do
    date = Date.utc_today() |> Date.to_iso8601()
    habits = Habits.list_active()
    today_logs = Habits.logs_for_date(date)
    journal = Journal.get_entry(date)
    inbox_items = BrainDump.list_unprocessed() |> Enum.take(5)

    streaks = Map.new(habits, fn h -> {h.id, Habits.calculate_streak(h.id)} end)

    push(socket, "snapshot", %{
      date: date,
      inbox_count: BrainDump.unprocessed_count(),
      inbox_items: Enum.map(inbox_items, fn i -> %{id: i.id, content: i.content, created_at: i.inserted_at} end),
      habits: Enum.map(habits, fn h ->
        log = Enum.find(today_logs, &(&1.habit_id == h.id))
        %{id: h.id, name: h.name, color: h.color, completed: log != nil && log.completed, streak: streaks[h.id]}
      end),
      journal: if(journal, do: %{content: journal.content, one_thing: journal.one_thing, mood: journal.mood,
        energy_p: journal.energy_p, energy_m: journal.energy_m, energy_e: journal.energy_e}, else: nil)
    })

    {:noreply, socket}
  end
end
```

- [ ] **Step 2: Brain Dump channel with list on join**

Replace `daemon/lib/place_web/channels/brain_dump_channel.ex`:

```elixir
defmodule PlaceWeb.BrainDumpChannel do
  use Phoenix.Channel

  alias Place.BrainDump

  @impl true
  def join("brain_dump:queue", _payload, socket) do
    items = BrainDump.list_items()

    serialized =
      Enum.map(items, fn i ->
        %{id: i.id, content: i.content, source: i.source, processed: i.processed,
          action: i.action, processed_at: i.processed_at, created_at: i.inserted_at}
      end)

    {:ok, %{items: serialized}, socket}
  end
end
```

- [ ] **Step 3: Habits channel with data on join**

Replace `daemon/lib/place_web/channels/habits_channel.ex`:

```elixir
defmodule PlaceWeb.HabitsChannel do
  use Phoenix.Channel

  alias Place.Habits

  @impl true
  def join("habits:tracker", _payload, socket) do
    habits = Habits.list_active()
    date = Date.utc_today() |> Date.to_iso8601()
    today_logs = Habits.logs_for_date(date)
    streaks = Map.new(habits, fn h -> {h.id, Habits.calculate_streak(h.id)} end)

    {:ok, %{
      habits: Enum.map(habits, fn h ->
        %{id: h.id, name: h.name, frequency: h.frequency, target: h.target,
          color: h.color, sort_order: h.sort_order, created_at: h.inserted_at}
      end),
      today_logs: Enum.map(today_logs, fn l ->
        %{id: l.id, habit_id: l.habit_id, date: l.date, completed: l.completed}
      end),
      streaks: streaks
    }, socket}
  end
end
```

- [ ] **Step 4: Journal channel with today's entry on join**

Replace `daemon/lib/place_web/channels/journal_channel.ex`:

```elixir
defmodule PlaceWeb.JournalChannel do
  use Phoenix.Channel

  alias Place.Journal

  @impl true
  def join("journal:today", _payload, socket) do
    date = Date.utc_today() |> Date.to_iso8601()

    case Journal.get_or_create_entry(date) do
      {:ok, entry} ->
        {:ok, %{
          entry: %{id: entry.id, date: entry.date, content: entry.content,
            one_thing: entry.one_thing, mood: entry.mood,
            energy_p: entry.energy_p, energy_m: entry.energy_m, energy_e: entry.energy_e,
            gratitude: entry.gratitude}
        }, socket}

      {:error, _} ->
        {:ok, %{entry: nil}, socket}
    end
  end
end
```

- [ ] **Step 5: Compile and verify**

```bash
cd daemon && mix compile
```

- [ ] **Step 6: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: wire channels to deliver real data on join"
```

---

### Task 9: Scaffold Future Contexts (Backend Only)

**Files:**
- Create: 8 migration files for scaffold tables
- Create: 8 schema files + 8 context modules (minimal stubs)

- [ ] **Step 1: Generate all scaffold migrations**

```bash
cd daemon
mix ecto.gen.migration create_tasks
mix ecto.gen.migration create_goals
mix ecto.gen.migration create_focus
mix ecto.gen.migration create_notes
mix ecto.gen.migration create_vault_index
mix ecto.gen.migration create_claude_sessions
mix ecto.gen.migration create_agents
mix ecto.gen.migration create_app_shortcuts
```

- [ ] **Step 2: Write all scaffold migrations**

Tasks migration:
```elixir
defmodule Place.Repo.Migrations.CreateTasks do
  use Ecto.Migration

  def change do
    create table(:tasks, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :status, :string, null: false, default: "todo"
      add :priority, :integer, default: 0
      add :due_date, :string
      add :goal_id, references(:goals, type: :string, on_delete: :nilify_all)
      timestamps(type: :utc_datetime)
    end
  end
end
```

Goals migration:
```elixir
defmodule Place.Repo.Migrations.CreateGoals do
  use Ecto.Migration

  def change do
    create table(:goals, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :timeframe, :string, null: false, default: "monthly"
      add :status, :string, null: false, default: "active"
      add :parent_id, references(:goals, type: :string, on_delete: :nilify_all)
      timestamps(type: :utc_datetime)
    end
  end
end
```

**Note:** Goals must migrate BEFORE tasks (since tasks references goals). Reorder the migration timestamps so goals comes first.

Focus migration:
```elixir
defmodule Place.Repo.Migrations.CreateFocus do
  use Ecto.Migration

  def change do
    create table(:focus_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :started_at, :utc_datetime, null: false
      add :ended_at, :utc_datetime
      add :target_ms, :integer
      timestamps(type: :utc_datetime)
    end

    create table(:focus_blocks, primary_key: false) do
      add :id, :string, primary_key: true
      add :session_id, references(:focus_sessions, type: :string, on_delete: :delete_all)
      add :block_type, :string, null: false, default: "work"
      add :started_at, :utc_datetime, null: false
      add :ended_at, :utc_datetime
      add :elapsed_ms, :integer
      timestamps(type: :utc_datetime)
    end
  end
end
```

Notes migration:
```elixir
defmodule Place.Repo.Migrations.CreateNotes do
  use Ecto.Migration

  def change do
    create table(:notes, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :content, :text, null: false, default: ""
      add :source_type, :string
      add :source_id, :string
      timestamps(type: :utc_datetime)
    end
  end
end
```

Vault index migration:
```elixir
defmodule Place.Repo.Migrations.CreateVaultIndex do
  use Ecto.Migration

  def change do
    create table(:vault_index, primary_key: false) do
      add :path, :string, primary_key: true
      add :title, :string
      add :tags, :text
      add :modified_at, :utc_datetime
      timestamps(type: :utc_datetime)
    end
  end
end
```

Claude sessions migration:
```elixir
defmodule Place.Repo.Migrations.CreateClaudeSessions do
  use Ecto.Migration

  def change do
    create table(:claude_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :project_path, :string, null: false
      add :started_at, :utc_datetime
      add :last_active, :utc_datetime
      add :summary, :text
      add :token_count, :integer
      add :status, :string, default: "active"
      timestamps(type: :utc_datetime)
    end
  end
end
```

Agents migration:
```elixir
defmodule Place.Repo.Migrations.CreateAgents do
  use Ecto.Migration

  def change do
    create table(:agent_templates, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :command, :string, null: false
      add :description, :text
      add :icon, :string
      timestamps(type: :utc_datetime)
    end

    create table(:agent_runs, primary_key: false) do
      add :id, :string, primary_key: true
      add :template_id, references(:agent_templates, type: :string, on_delete: :nilify_all)
      add :project_path, :string
      add :status, :string, null: false, default: "pending"
      add :started_at, :utc_datetime
      add :output_path, :string
      add :exit_code, :integer
      timestamps(type: :utc_datetime)
    end
  end
end
```

App shortcuts migration:
```elixir
defmodule Place.Repo.Migrations.CreateAppShortcuts do
  use Ecto.Migration

  def change do
    create table(:app_shortcuts, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :exec_command, :string, null: false
      add :icon_path, :string
      add :category, :string
      add :sort_order, :integer, default: 0
      timestamps(type: :utc_datetime)
    end
  end
end
```

- [ ] **Step 3: Create minimal schema + context stubs for each**

For each scaffold context, create a schema file and a context file with just the module doc. Example for Tasks:

Write `daemon/lib/place/tasks/task.ex`:
```elixir
defmodule Place.Tasks.Task do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "tasks" do
    field :title, :string
    field :description, :string
    field :status, :string, default: "todo"
    field :priority, :integer, default: 0
    field :due_date, :string
    field :goal_id, :string

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/tasks/tasks.ex`:
```elixir
defmodule Place.Tasks do
  @moduledoc """
  Tasks — todo items with priority, status, and goal linking.
  Statuses: todo | in_progress | done | archived.
  Scaffolded — implementation pending.
  """
end
```

Repeat this pattern for Goals, Focus, Notes, Vault, Claude, Agents, AppLauncher, System. Each gets a schema matching its migration and a context module with a `@moduledoc` describing its purpose.

Write `daemon/lib/place/goals/goal.ex`:
```elixir
defmodule Place.Goals.Goal do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "goals" do
    field :title, :string
    field :description, :string
    field :timeframe, :string, default: "monthly"
    field :status, :string, default: "active"
    field :parent_id, :string

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/goals/goals.ex`:
```elixir
defmodule Place.Goals do
  @moduledoc """
  Goals — hierarchical goal tracking across timeframes.
  Timeframes: weekly | monthly | quarterly | yearly | 3year.
  Scaffolded — implementation pending.
  """
end
```

Write `daemon/lib/place/focus/session.ex`:
```elixir
defmodule Place.Focus.Session do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "focus_sessions" do
    field :started_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :target_ms, :integer

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/focus/block.ex`:
```elixir
defmodule Place.Focus.Block do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "focus_blocks" do
    field :session_id, :string
    field :block_type, :string, default: "work"
    field :started_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :elapsed_ms, :integer

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/focus/focus.ex`:
```elixir
defmodule Place.Focus do
  @moduledoc """
  Focus — pomodoro/time-block sessions with work and break blocks.
  Scaffolded — implementation pending.
  """
end
```

Write `daemon/lib/place/notes/note.ex`:
```elixir
defmodule Place.Notes.Note do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "notes" do
    field :title, :string
    field :content, :string, default: ""
    field :source_type, :string
    field :source_id, :string

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/notes/notes.ex`:
```elixir
defmodule Place.Notes do
  @moduledoc """
  Notes — markdown notes with source linking (from brain dump, etc).
  Scaffolded — implementation pending.
  """
end
```

Write `daemon/lib/place/vault/file_index.ex`:
```elixir
defmodule Place.Vault.FileIndex do
  use Ecto.Schema

  @primary_key {:path, :string, autogenerate: false}

  schema "vault_index" do
    field :title, :string
    field :tags, :string
    field :modified_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/vault/vault.ex`:
```elixir
defmodule Place.Vault do
  @moduledoc """
  Vault Bridge — read-only index of Obsidian vault files.
  FileSystem watcher on ~/Documents/obsidian_first_stuff/twj1/.
  Scaffolded — implementation pending.
  """
end
```

Write `daemon/lib/place/claude/session.ex`:
```elixir
defmodule Place.Claude.Session do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "claude_sessions" do
    field :project_path, :string
    field :started_at, :utc_datetime
    field :last_active, :utc_datetime
    field :summary, :string
    field :token_count, :integer
    field :status, :string, default: "active"

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/claude/claude.ex`:
```elixir
defmodule Place.Claude do
  @moduledoc """
  Claude Sessions — watches ~/.claude/projects/ for session data.
  Parses session files to extract conversation metadata.
  Scaffolded — implementation pending.
  """
end
```

Write `daemon/lib/place/agents/agent_template.ex`:
```elixir
defmodule Place.Agents.AgentTemplate do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_templates" do
    field :name, :string
    field :command, :string
    field :description, :string
    field :icon, :string

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/agents/agent_run.ex`:
```elixir
defmodule Place.Agents.AgentRun do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_runs" do
    field :template_id, :string
    field :project_path, :string
    field :status, :string, default: "pending"
    field :started_at, :utc_datetime
    field :output_path, :string
    field :exit_code, :integer

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/agents/agents.ex`:
```elixir
defmodule Place.Agents do
  @moduledoc """
  Agent Dispatch — launch and monitor Claude Code agents.
  Uses DynamicSupervisor for agent process isolation.
  Scaffolded — implementation pending.
  """
end
```

Write `daemon/lib/place/app_launcher/app_shortcut.ex`:
```elixir
defmodule Place.AppLauncher.AppShortcut do
  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}

  schema "app_shortcuts" do
    field :name, :string
    field :exec_command, :string
    field :icon_path, :string
    field :category, :string
    field :sort_order, :integer, default: 0

    timestamps(type: :utc_datetime)
  end
end
```

Write `daemon/lib/place/app_launcher/app_launcher.ex`:
```elixir
defmodule Place.AppLauncher do
  @moduledoc """
  App Launcher — scans .desktop files, launches native apps via xdg-open.
  Scaffolded — implementation pending.
  """
end
```

Write `daemon/lib/place/system/system.ex`:
```elixir
defmodule Place.System do
  @moduledoc """
  System Monitor — live CPU, RAM, disk, battery data from /proc/.
  No database table — streams live data via channel.
  Scaffolded — implementation pending.
  """
end
```

Write `daemon/lib/place/context_bridge/context_bridge.ex`:
```elixir
defmodule Place.ContextBridge do
  @moduledoc """
  Context Bridge — universal context provider for LLM tools.
  Provides executive summary JSON for Claude CLI and future MCP server.
  Scaffolded — controller already implemented, context to be enriched.
  """
end
```

- [ ] **Step 4: Run all migrations**

```bash
cd daemon && mix ecto.migrate
```

Expected: All migrations run successfully.

- [ ] **Step 5: Verify full compilation**

```bash
mix compile
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /home/trajan/Projects/ema
git add daemon/
git commit -m "feat: scaffold 10 future contexts with migrations, schemas, and module docs"
```

---

## Phase 2: Frontend Foundation

### Task 10: Tauri + React + Vite Project Scaffold

**Files:**
- Create: `app/` (entire Tauri project)

- [ ] **Step 1: Create Tauri project with React template**

```bash
cd /home/trajan/Projects/ema
pnpm create tauri-app app --template react-ts --manager pnpm
```

When prompted:
- Project name: `place-native`
- Identifier: `org.place.native`
- Frontend: React with TypeScript (Vite)

- [ ] **Step 2: Install additional frontend deps**

```bash
cd app
pnpm add zustand motion @tauri-apps/plugin-autostart @tauri-apps/plugin-global-shortcut @tauri-apps/plugin-notification
pnpm add -D @tailwindcss/vite tailwindcss @types/react @types/react-dom vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Tailwind v4**

Write `app/src/styles/globals.css`:

```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-pn-void: #060610;
  --color-pn-base: #08090E;
  --color-pn-surface-1: #0E1017;
  --color-pn-surface-2: #141620;
  --color-pn-surface-3: #1A1D2A;

  /* Primary (Teal) */
  --color-pn-primary-900: #064E3B;
  --color-pn-primary-500: #0D9373;
  --color-pn-primary-400: #2DD4A8;
  --color-pn-primary-50: #CCFBF1;

  /* Secondary (Blue) */
  --color-pn-secondary-900: #1E3A6E;
  --color-pn-secondary-500: #4B7BE5;
  --color-pn-secondary-400: #6B95F0;
  --color-pn-secondary-50: #E0ECFD;

  /* Tertiary (Amber) */
  --color-pn-tertiary-900: #78350F;
  --color-pn-tertiary-500: #D97706;
  --color-pn-tertiary-400: #F59E0B;
  --color-pn-tertiary-50: #FEF3C7;

  /* Semantic */
  --color-pn-error: #E24B4A;
  --color-pn-success: #22C55E;
  --color-pn-warning: #EAB308;

  /* Fonts */
  --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Code", "Fira Code", ui-monospace, monospace;

  /* Easing */
  --ease-smooth: cubic-bezier(0.65, 0.05, 0, 1);
}

/* Text opacity helpers */
:root {
  --pn-text-primary: rgba(255, 255, 255, 0.87);
  --pn-text-secondary: rgba(255, 255, 255, 0.60);
  --pn-text-tertiary: rgba(255, 255, 255, 0.40);
  --pn-text-muted: rgba(255, 255, 255, 0.25);

  --pn-border-subtle: rgba(255, 255, 255, 0.04);
  --pn-border-default: rgba(255, 255, 255, 0.08);
  --pn-border-strong: rgba(255, 255, 255, 0.15);
}

/* Glass tiers */
.glass-ambient {
  background: rgba(14, 16, 23, 0.40);
  backdrop-filter: blur(6px) saturate(120%);
  -webkit-backdrop-filter: blur(6px) saturate(120%);
}

.glass-surface {
  background: rgba(14, 16, 23, 0.55);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.glass-elevated, .glass {
  background: rgba(14, 16, 23, 0.65);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Base styles */
body {
  margin: 0;
  background: var(--color-pn-base);
  color: var(--pn-text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
```

- [ ] **Step 4: Configure Vite with Tailwind**

Replace `app/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
```

- [ ] **Step 5: Configure Tauri for system tray and autostart**

Edit `app/src-tauri/tauri.conf.json` — set the key fields:

```json
{
  "productName": "place-native",
  "version": "0.1.0",
  "identifier": "org.place.native",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "place-native",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "decorations": false,
        "transparent": true
      }
    ],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": false
    }
  },
  "plugins": {
    "autostart": { "macosExtraArgs": [] },
    "global-shortcut": {},
    "notification": {}
  }
}
```

- [ ] **Step 6: Verify Tauri builds**

```bash
cd app && pnpm build
cd src-tauri && cargo build
```

Expected: Both build successfully. (First Cargo build will take a while — downloading/compiling Tauri deps.)

- [ ] **Step 7: Commit**

```bash
cd /home/trajan/Projects/ema
git add app/
git commit -m "feat: scaffold Tauri + React + Vite + Tailwind with design tokens and glass system"
```

---

### Task 11: WebSocket Client + REST Client + Types

**Files:**
- Create: `app/src/lib/ws.ts`
- Create: `app/src/lib/api.ts`
- Create: `app/src/lib/springs.ts`
- Create: `app/src/lib/date-utils.ts`
- Create: `app/src/types/brain-dump.ts`
- Create: `app/src/types/habits.ts`
- Create: `app/src/types/journal.ts`
- Create: `app/src/types/settings.ts`

- [ ] **Step 1: Install Phoenix JS client**

```bash
cd app && pnpm add phoenix
```

- [ ] **Step 2: Write Phoenix WebSocket client**

Write `app/src/lib/ws.ts`:

```typescript
import { Socket, Channel } from "phoenix";

const DAEMON_URL = "ws://localhost:4488/socket";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = new Socket(DAEMON_URL, { params: {} });
    socket.connect();
  }
  return socket;
}

export function joinChannel(topic: string): Promise<{ channel: Channel; response: unknown }> {
  const channel = getSocket().channel(topic, {});

  return new Promise((resolve, reject) => {
    channel
      .join()
      .receive("ok", (response: unknown) => resolve({ channel, response }))
      .receive("error", (err: unknown) => reject(err))
      .receive("timeout", () => reject(new Error(`Timeout joining ${topic}`)));
  });
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}
```

- [ ] **Step 3: Write REST client**

Write `app/src/lib/api.ts`:

```typescript
const BASE = "http://localhost:4488/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
```

- [ ] **Step 4: Write type definitions**

Write `app/src/types/brain-dump.ts`:

```typescript
export interface InboxItem {
  readonly id: string;
  readonly content: string;
  readonly source: "text" | "shortcut" | "clipboard";
  readonly processed: boolean;
  readonly action: "task" | "journal" | "archive" | "note" | "processing" | null;
  readonly processed_at: string | null;
  readonly created_at: string;
}
```

Write `app/src/types/habits.ts`:

```typescript
export interface Habit {
  readonly id: string;
  readonly name: string;
  readonly frequency: "daily" | "weekly";
  readonly target: string | null;
  readonly active: boolean;
  readonly sort_order: number;
  readonly color: string;
  readonly created_at: string;
}

export interface HabitLog {
  readonly id: string;
  readonly habit_id: string;
  readonly date: string;
  readonly completed: boolean;
  readonly notes: string | null;
}

export const HABIT_COLORS = [
  "#5b9cf5", "#38c97a", "#e8a84c", "#ef6b6b", "#a78bfa", "#f472b6", "#34d399",
] as const;
```

Write `app/src/types/journal.ts`:

```typescript
export interface JournalEntry {
  readonly id: string;
  readonly date: string;
  readonly content: string;
  readonly one_thing: string | null;
  readonly mood: number | null;
  readonly energy_p: number | null;
  readonly energy_m: number | null;
  readonly energy_e: number | null;
  readonly gratitude: string | null;
  readonly tags: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export const MOOD_LABELS = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
} as const;

export const MOOD_COLORS = {
  1: "var(--color-pn-error)",
  2: "var(--color-pn-tertiary-400)",
  3: "var(--pn-text-secondary)",
  4: "var(--color-pn-secondary-400)",
  5: "var(--color-pn-success)",
} as const;
```

Write `app/src/types/settings.ts`:

```typescript
export interface AppSettings {
  readonly color_mode: "dark" | "light" | "auto";
  readonly accent_color: string;
  readonly glass_intensity: string;
  readonly font_family: string;
  readonly font_size: string;
  readonly launch_on_boot: string;
  readonly start_minimized: string;
  readonly shortcut_capture: string;
  readonly shortcut_toggle: string;
}
```

- [ ] **Step 5: Write spring configs and date utils**

Write `app/src/lib/springs.ts`:

```typescript
export const SPRINGS = {
  default: { stiffness: 300, damping: 25 },
  snappy: { stiffness: 500, damping: 30 },
  gentle: { stiffness: 200, damping: 20 },
  bouncy: { stiffness: 400, damping: 15 },
} as const;
```

Write `app/src/lib/date-utils.ts`:

```typescript
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return "Today";
  if (dateStr === offsetDate(today, -1)) return "Yesterday";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dayOfWeek(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

export function weekDates(dateStr: string): string[] {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date.toISOString().slice(0, 10);
  });
}

export function getMonthDays(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7;
  const days: string[] = [];
  const cursor = new Date(first);
  cursor.setDate(1 - startDay);
  for (let i = 0; i < 42; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
```

- [ ] **Step 6: Commit**

```bash
cd /home/trajan/Projects/ema
git add app/src/
git commit -m "feat: add WebSocket client, REST client, types, and utility libs"
```

---

### Task 12: Zustand Stores

**Files:**
- Create: `app/src/stores/brain-dump-store.ts`
- Create: `app/src/stores/habits-store.ts`
- Create: `app/src/stores/journal-store.ts`
- Create: `app/src/stores/dashboard-store.ts`
- Create: `app/src/stores/settings-store.ts`

- [ ] **Step 1: Write Brain Dump store**

Write `app/src/stores/brain-dump-store.ts`:

```typescript
import { create } from "zustand";
import type { InboxItem } from "@/types/brain-dump";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

interface BrainDumpState {
  readonly items: readonly InboxItem[];
  readonly loading: boolean;
  channel: Channel | null;
  load: () => Promise<void>;
  connect: () => Promise<void>;
  add: (content: string, source?: InboxItem["source"]) => Promise<void>;
  process: (id: string, action: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBrainDumpStore = create<BrainDumpState>((set, get) => ({
  items: [],
  loading: false,
  channel: null,

  async load() {
    set({ loading: true });
    const data = await api.get<{ items: InboxItem[] }>("/brain-dump/items");
    set({ items: data.items, loading: false });
  },

  async connect() {
    const { channel, response } = await joinChannel("brain_dump:queue");
    const resp = response as { items: InboxItem[] };
    set({ channel, items: resp.items });

    channel.on("item_created", (item: InboxItem) => {
      set((s) => ({ items: [item, ...s.items] }));
    });

    channel.on("item_processed", (item: InboxItem) => {
      set((s) => ({ items: s.items.map((i) => (i.id === item.id ? item : i)) }));
    });

    channel.on("item_deleted", ({ id }: { id: string }) => {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    });
  },

  async add(content, source = "text") {
    await api.post("/brain-dump/items", { content, source });
  },

  async process(id, action) {
    await api.patch(`/brain-dump/items/${id}/process`, { action });
  },

  async remove(id) {
    await api.delete(`/brain-dump/items/${id}`);
  },
}));
```

- [ ] **Step 2: Write Habits store**

Write `app/src/stores/habits-store.ts`:

```typescript
import { create } from "zustand";
import type { Habit, HabitLog } from "@/types/habits";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

interface HabitsState {
  readonly habits: readonly Habit[];
  readonly todayLogs: readonly HabitLog[];
  readonly streaks: Record<string, number>;
  readonly loading: boolean;
  channel: Channel | null;
  connect: () => Promise<void>;
  addHabit: (name: string, frequency?: string, target?: string) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  toggleToday: (habitId: string) => Promise<void>;
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  todayLogs: [],
  streaks: {},
  loading: false,
  channel: null,

  async connect() {
    const { channel, response } = await joinChannel("habits:tracker");
    const resp = response as { habits: Habit[]; today_logs: HabitLog[]; streaks: Record<string, number> };
    set({ channel, habits: resp.habits, todayLogs: resp.today_logs, streaks: resp.streaks });

    channel.on("habit_created", (habit: Habit) => {
      set((s) => ({ habits: [...s.habits, habit] }));
    });

    channel.on("habit_toggled", (data: { habit_id: string; completed: boolean; streak: number; date: string }) => {
      set((s) => {
        const existing = s.todayLogs.find((l) => l.habit_id === data.habit_id);
        const todayLogs = existing
          ? s.todayLogs.map((l) => (l.habit_id === data.habit_id ? { ...l, completed: data.completed } : l))
          : [...s.todayLogs, { id: `tmp_${Date.now()}`, habit_id: data.habit_id, date: data.date, completed: data.completed, notes: null }];
        return { todayLogs, streaks: { ...s.streaks, [data.habit_id]: data.streak } };
      });
    });

    channel.on("habit_archived", ({ id }: { id: string }) => {
      set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
    });
  },

  async addHabit(name, frequency = "daily", target) {
    await api.post("/habits", { name, frequency, target });
  },

  async archiveHabit(id) {
    await api.post(`/habits/${id}/archive`, {});
  },

  async toggleToday(habitId) {
    await api.post(`/habits/${habitId}/toggle`, {});
  },
}));
```

- [ ] **Step 3: Write Journal store**

Write `app/src/stores/journal-store.ts`:

```typescript
import { create } from "zustand";
import type { JournalEntry } from "@/types/journal";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/date-utils";

interface JournalState {
  readonly currentDate: string;
  readonly currentEntry: JournalEntry | null;
  readonly loading: boolean;
  readonly dirty: boolean;
  loadEntry: (date: string) => Promise<void>;
  setCurrentDate: (date: string) => Promise<void>;
  updateField: (field: string, value: unknown) => void;
  save: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useJournalStore = create<JournalState>((set, get) => ({
  currentDate: todayStr(),
  currentEntry: null,
  loading: false,
  dirty: false,

  async loadEntry(date) {
    set({ loading: true, currentDate: date });
    const entry = await api.get<JournalEntry>(`/journal/${date}`);
    set({ currentEntry: entry, loading: false, dirty: false });
  },

  async setCurrentDate(date) {
    if (get().dirty) await get().save();
    await get().loadEntry(date);
  },

  updateField(field, value) {
    const entry = get().currentEntry;
    if (!entry) return;
    set({ currentEntry: { ...entry, [field]: value }, dirty: true });

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => get().save(), 600);
  },

  async save() {
    const { currentEntry, currentDate } = get();
    if (!currentEntry || !get().dirty) return;

    await api.put(`/journal/${currentDate}`, {
      content: currentEntry.content,
      one_thing: currentEntry.one_thing,
      mood: currentEntry.mood,
      energy_p: currentEntry.energy_p,
      energy_m: currentEntry.energy_m,
      energy_e: currentEntry.energy_e,
      gratitude: currentEntry.gratitude,
    });

    set({ dirty: false });
  },
}));
```

- [ ] **Step 4: Write Dashboard store**

Write `app/src/stores/dashboard-store.ts`:

```typescript
import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

interface DashboardHabit {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly completed: boolean;
  readonly streak: number;
}

interface DashboardSnapshot {
  readonly date: string;
  readonly inbox_count: number;
  readonly inbox_items: readonly { id: string; content: string; created_at: string }[];
  readonly habits: readonly DashboardHabit[];
  readonly journal: {
    content: string;
    one_thing: string | null;
    mood: number | null;
    energy_p: number | null;
    energy_m: number | null;
    energy_e: number | null;
  } | null;
}

interface DashboardState {
  readonly snapshot: DashboardSnapshot | null;
  readonly connected: boolean;
  channel: Channel | null;
  connect: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  snapshot: null,
  connected: false,
  channel: null,

  async connect() {
    const { channel } = await joinChannel("dashboard:lobby");
    set({ channel, connected: true });

    channel.on("snapshot", (snapshot: DashboardSnapshot) => {
      set({ snapshot });
    });
  },
}));
```

- [ ] **Step 5: Write Settings store**

Write `app/src/stores/settings-store.ts`:

```typescript
import { create } from "zustand";
import type { AppSettings } from "@/types/settings";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

interface SettingsState {
  readonly settings: AppSettings | null;
  readonly loading: boolean;
  channel: Channel | null;
  load: () => Promise<void>;
  connect: () => Promise<void>;
  set: (key: string, value: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  channel: null,

  async load() {
    set({ loading: true });
    const settings = await api.get<AppSettings>("/settings");
    set({ settings, loading: false });
  },

  async connect() {
    const { channel } = await joinChannel("settings:sync");
    set({ channel });

    channel.on("setting_changed", ({ key, value }: { key: string; value: string }) => {
      set((s) => ({
        settings: s.settings ? { ...s.settings, [key]: value } : null,
      }));
    });

    await get().load();
  },

  async set(key, value) {
    await api.put("/settings", { key, value });
  },
}));
```

- [ ] **Step 6: Commit**

```bash
cd /home/trajan/Projects/ema
git add app/src/stores/
git commit -m "feat: add Zustand stores for all V1 apps with WebSocket sync"
```

---

### Task 13: UI Primitives + App Shell

**Files:**
- Create: `app/src/components/ui/GlassCard.tsx`
- Create: `app/src/components/ui/SegmentedControl.tsx`
- Create: `app/src/components/ui/Badge.tsx`
- Create: `app/src/components/ui/Tooltip.tsx`
- Create: `app/src/components/layout/Shell.tsx`
- Create: `app/src/components/layout/AmbientStrip.tsx`
- Create: `app/src/components/layout/Sidebar.tsx`
- Create: `app/src/components/layout/CommandBar.tsx`
- Create: `app/src/App.tsx`
- Modify: `app/src/main.tsx`

This task builds the visual shell and reusable components. Since it contains many files, I'll provide the key implementations. Each component should be written and verified to compile before moving to the next.

- [ ] **Step 1: Write GlassCard**

Write `app/src/components/ui/GlassCard.tsx`:

```tsx
import type { ReactNode } from "react";

interface GlassCardProps {
  readonly title?: string;
  readonly onNavigate?: () => void;
  readonly children: ReactNode;
  readonly className?: string;
}

export function GlassCard({ title, onNavigate, children, className = "" }: GlassCardProps) {
  return (
    <div
      className={`glass-surface rounded-xl transition-all duration-150 hover:translate-y-[-1px] hover:shadow-lg ${className}`}
      style={{ borderColor: "var(--pn-border-default)" }}
    >
      {title && (
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
        >
          <span
            className="text-[0.6rem] font-semibold uppercase tracking-[0.05em]"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            {title}
          </span>
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="text-[0.6rem] opacity-40 hover:opacity-80 transition-opacity"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              ▸
            </button>
          )}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write SegmentedControl**

Write `app/src/components/ui/SegmentedControl.tsx`:

```tsx
interface SegmentedControlProps<T extends string> {
  readonly options: readonly { value: T; label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ background: "var(--color-pn-surface-2)" }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1 text-[0.65rem] rounded-md transition-all duration-100"
          style={{
            background: value === opt.value ? "rgba(255,255,255,0.06)" : "transparent",
            color: value === opt.value ? "var(--pn-text-primary)" : "var(--pn-text-tertiary)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write Badge**

Write `app/src/components/ui/Badge.tsx`:

```tsx
interface BadgeProps {
  readonly count: number;
  readonly color?: string;
}

export function Badge({ count, color = "var(--color-pn-error)" }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[0.55rem] font-semibold text-white"
      style={{ background: color }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
```

- [ ] **Step 4: Write Tooltip**

Write `app/src/components/ui/Tooltip.tsx`:

```tsx
import { useState, type ReactNode } from "react";

interface TooltipProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[0.6rem] whitespace-nowrap z-50 glass-surface"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write layout Shell, AmbientStrip, Sidebar, CommandBar**

Write `app/src/components/layout/AmbientStrip.tsx`:

```tsx
import { useEffect, useState } from "react";

export function AmbientStrip() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="glass-ambient h-8 flex items-center justify-between px-3"
      data-tauri-drag-region
    >
      <span
        className="text-[0.65rem] font-semibold tracking-[0.05em]"
        style={{ color: "var(--color-pn-secondary-400)" }}
      >
        place
      </span>

      <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {" · "}
        {time.toLocaleDateString([], { month: "short", day: "numeric" })}
      </span>

      <div className="w-16" />
    </div>
  );
}
```

Write `app/src/components/layout/Sidebar.tsx`:

```tsx
import { Tooltip } from "@/components/ui/Tooltip";

interface SidebarItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

const NAV_ITEMS: readonly SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "◉" },
  { id: "brain-dump", label: "Brain Dump", icon: "◎" },
  { id: "habits", label: "Habits", icon: "↻" },
  { id: "journal", label: "Journal", icon: "✎" },
];

interface SidebarProps {
  readonly activePage: string;
  readonly onNavigate: (page: string) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <div className="glass-surface w-14 flex flex-col items-center py-3 gap-2">
      {NAV_ITEMS.map((item) => (
        <Tooltip key={item.id} label={item.label}>
          <button
            onClick={() => onNavigate(item.id)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-all duration-100"
            style={{
              color: activePage === item.id ? "var(--color-pn-primary-400)" : "var(--pn-text-tertiary)",
              background: activePage === item.id ? "rgba(45, 212, 168, 0.08)" : "transparent",
              borderLeft: activePage === item.id ? "2px solid var(--color-pn-primary-400)" : "2px solid transparent",
            }}
          >
            {item.icon}
          </button>
        </Tooltip>
      ))}

      <div className="flex-1" />

      <div className="w-6 h-px" style={{ background: "var(--pn-border-default)" }} />

      <Tooltip label="Settings">
        <button
          onClick={() => onNavigate("settings")}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-all duration-100"
          style={{
            color: activePage === "settings" ? "var(--color-pn-primary-400)" : "var(--pn-text-tertiary)",
          }}
        >
          ⚙
        </button>
      </Tooltip>
    </div>
  );
}
```

Write `app/src/components/layout/CommandBar.tsx`:

```tsx
import { useState } from "react";

export function CommandBar() {
  const [query, setQuery] = useState("");

  return (
    <div className="glass-ambient h-10 flex items-center px-3 gap-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search everything..."
        className="flex-1 bg-transparent text-[0.7rem] outline-none"
        style={{ color: "var(--pn-text-secondary)" }}
      />
      <span
        className="text-[0.55rem] px-1.5 py-0.5 rounded"
        style={{
          background: "rgba(255,255,255,0.05)",
          color: "var(--pn-text-muted)",
        }}
      >
        Ctrl+K
      </span>
    </div>
  );
}
```

Write `app/src/components/layout/Shell.tsx`:

```tsx
import { useState, useEffect, type ReactNode } from "react";
import { AmbientStrip } from "./AmbientStrip";
import { Sidebar } from "./Sidebar";
import { CommandBar } from "./CommandBar";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHabitsStore } from "@/stores/habits-store";
import { useSettingsStore } from "@/stores/settings-store";

interface ShellProps {
  readonly activePage: string;
  readonly onNavigate: (page: string) => void;
  readonly children: ReactNode;
}

export function Shell({ activePage, onNavigate, children }: ShellProps) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      await Promise.all([
        useDashboardStore.getState().connect(),
        useBrainDumpStore.getState().connect(),
        useHabitsStore.getState().connect(),
        useSettingsStore.getState().connect(),
      ]);
      setInitialized(true);
    }
    init().catch(console.error);
  }, []);

  if (!initialized) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: "var(--color-pn-base)" }}
      >
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
          Connecting to daemon...
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-pn-base)" }}>
      <AmbientStrip />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
      <CommandBar />
    </div>
  );
}
```

- [ ] **Step 6: Write App.tsx with routing**

Write `app/src/App.tsx`:

```tsx
import { useState } from "react";
import { Shell } from "@/components/layout/Shell";

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <span style={{ color: "var(--pn-text-muted)" }}>{name} — coming next</span>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");

  return (
    <Shell activePage={page} onNavigate={setPage}>
      {page === "dashboard" && <Placeholder name="Dashboard" />}
      {page === "brain-dump" && <Placeholder name="Brain Dump" />}
      {page === "habits" && <Placeholder name="Habits" />}
      {page === "journal" && <Placeholder name="Journal" />}
      {page === "settings" && <Placeholder name="Settings" />}
    </Shell>
  );
}
```

- [ ] **Step 7: Update main.tsx**

Replace `app/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
```

- [ ] **Step 8: Verify frontend compiles**

```bash
cd app && pnpm tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
cd /home/trajan/Projects/ema
git add app/src/
git commit -m "feat: add UI primitives, app shell with sidebar/strip/command bar, and page routing"
```

---

### Task 14: Dashboard Page with All Cards

**Files:**
- Create: `app/src/components/dashboard/DashboardPage.tsx`
- Create: `app/src/components/dashboard/OneThingCard.tsx`
- Create: `app/src/components/dashboard/HabitsSummaryCard.tsx`
- Create: `app/src/components/dashboard/BrainDumpCard.tsx`
- Create: `app/src/components/dashboard/MoodEnergyCard.tsx`
- Create: `app/src/components/dashboard/JournalPreviewCard.tsx`
- Create: `app/src/components/dashboard/QuickLinksCard.tsx`
- Modify: `app/src/App.tsx`

This is a large task. Each card is a focused component reading from the dashboard store. Implement them one at a time, verifying compilation after each.

The card implementations follow the spec exactly — OneThingCard with inline editing, HabitsSummaryCard with colored checkboxes and progress bar, BrainDumpCard with last 5 items and quick actions, MoodEnergyCard with 5 circles and 3 sliders, JournalPreviewCard with markdown preview, QuickLinksCard with 2x2 action grid.

DashboardPage composes them in a responsive CSS grid:

```tsx
// DashboardPage.tsx layout structure
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-min">
  <div className="lg:col-span-3"><OneThingCard /></div>
  <HabitsSummaryCard />
  <BrainDumpCard />
  <MoodEnergyCard />
  <div className="md:col-span-2"><JournalPreviewCard /></div>
  <QuickLinksCard />
</div>
```

Each card reads from `useDashboardStore` snapshot. Full implementations follow the patterns in GlassCard.

After all cards are built, update `App.tsx` to render `<DashboardPage />` instead of the placeholder.

- [ ] **Step 1–8: Implement each card component** (follow patterns from spec section 2.1, using GlassCard wrapper, dashboard store data, and design tokens)

- [ ] **Step 9: Commit**

```bash
cd /home/trajan/Projects/ema
git add app/src/components/dashboard/ app/src/App.tsx
git commit -m "feat: add Dashboard page with 6 executive summary cards"
```

---

### Task 15: Brain Dump Page

Implement BrainDumpPage with CaptureInput, InboxQueue, InboxItem, KanbanView. Follow spec section 2.2 exactly. Uses `useBrainDumpStore`.

### Task 16: Habits Page

Implement HabitsPage with all four tabs (Today, Week, Month, Streaks), HabitRow, AddHabitForm, StreakGrid. Follow spec section 2.3. Uses `useHabitsStore`.

### Task 17: Journal Page

Implement JournalPage with CalendarStrip, OneThingInput, JournalEditor (3 modes), MoodPicker, EnergyTracker. Follow spec section 2.4. Uses `useJournalStore`.

### Task 18: Settings Page

Implement SettingsPage with appearance, startup, shortcuts, notifications, data, about sections. Follow spec section 2.5. Uses `useSettingsStore`.

---

## Phase 3: Native Integration

### Task 19: Dev Script + Systemd Service + Autostart

**Files:**
- Create: `scripts/dev.sh`
- Create: `scripts/place-native.service`

- [ ] **Step 1: Write dev script**

Write `scripts/dev.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Starting place-native dev environment..."

# Start Elixir daemon in background
cd daemon
mix ecto.migrate
mix phx.server &
DAEMON_PID=$!
cd ..

# Wait for daemon to be ready
echo "Waiting for daemon on :4488..."
for i in {1..30}; do
  if curl -s http://localhost:4488/api/dashboard/today > /dev/null 2>&1; then
    echo "Daemon ready."
    break
  fi
  sleep 0.5
done

# Start Tauri dev
cd app
cargo tauri dev &
TAURI_PID=$!
cd ..

# Cleanup on exit
trap "kill $DAEMON_PID $TAURI_PID 2>/dev/null" EXIT
wait
```

- [ ] **Step 2: Write systemd user service**

Write `scripts/place-native.service`:

```ini
[Unit]
Description=place-native Elixir daemon
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/Projects/place-native/daemon
ExecStart=/usr/bin/mix phx.server
Restart=on-failure
RestartSec=5
Environment=MIX_ENV=prod
Environment=SECRET_KEY_BASE=generate-a-real-key-here

[Install]
WantedBy=default.target
```

- [ ] **Step 3: Commit**

```bash
chmod +x scripts/dev.sh
cd /home/trajan/Projects/ema
git add scripts/
git commit -m "feat: add dev script and systemd service for daemon"
```

---

### Task 20: Run Full Stack End-to-End

- [ ] **Step 1: Start the full stack**

```bash
cd /home/trajan/Projects/ema
bash scripts/dev.sh
```

- [ ] **Step 2: Verify daemon API**

```bash
curl -s http://localhost:4488/api/dashboard/today | python3 -m json.tool
curl -s -X POST http://localhost:4488/api/brain-dump/items -H 'Content-Type: application/json' -d '{"content":"First thought!"}' | python3 -m json.tool
```

- [ ] **Step 3: Verify Tauri window opens and connects**

The Tauri window should show the dashboard with live data from the daemon.

- [ ] **Step 4: Run all daemon tests**

```bash
cd daemon && mix test
```

- [ ] **Step 5: Final commit**

```bash
cd /home/trajan/Projects/ema
git add -A
git commit -m "feat: place-native v0.1.0 — full stack working end-to-end"
```
