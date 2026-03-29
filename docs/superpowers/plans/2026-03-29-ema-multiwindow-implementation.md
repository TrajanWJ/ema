# EMA Multi-Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ema from a single-window sidebar app into EMA — a multi-window desktop system where each app runs as its own OS window, with a central Launchpad and workspace persistence.

**Architecture:** Single Tauri 2 process spawns multiple OS windows via `WebviewWindow` API. Each window loads a route (`/`, `/brain-dump`, etc.) and connects independently to the Elixir daemon. A new `Ema.Workspace` context tracks window state for session restoration.

**Tech Stack:** Elixir 1.18 + Phoenix 1.8 + Ecto + exqlite | Tauri 2 + React 19 + TypeScript + Tailwind v4 + Zustand + Motion | Vite 6

---

## File Map

### Daemon Changes (`daemon/`)

```
daemon/
├── mix.exs                                    # Rename :place → :ema
├── config/
│   ├── config.exs                             # Rename Place → Ema
│   ├── dev.exs                                # Update db path → ema_dev.db
│   ├── test.exs                               # Update db path → ema_test.db
│   ├── prod.exs                               # Rename
│   └── runtime.exs                            # Rename
├── lib/
│   ├── ema.ex                                 # Renamed from place.ex
│   ├── ema/
│   │   ├── application.ex                     # Renamed supervisor
│   │   ├── repo.ex                            # Renamed repo
│   │   ├── workspace/                         # NEW — workspace state
│   │   │   ├── window_state.ex                # NEW — schema
│   │   │   └── workspace.ex                   # NEW — context
│   │   ├── brain_dump/                        # Renamed Place → Ema
│   │   ├── habits/                            # Renamed
│   │   ├── journal/                           # Renamed
│   │   ├── settings/                          # Renamed
│   │   ├── tasks/                             # Renamed
│   │   ├── goals/                             # Renamed
│   │   ├── focus/                             # Renamed
│   │   ├── notes/                             # Renamed
│   │   ├── vault_index/                       # Renamed
│   │   ├── claude_sessions/                   # Renamed
│   │   ├── agents/                            # Renamed
│   │   └── app_shortcuts/                     # Renamed
│   └── ema_web/                               # Renamed from place_web/
│       ├── endpoint.ex                        # Renamed
│       ├── router.ex                          # + workspace routes
│       ├── user_socket.ex                     # + workspace channel
│       ├── channels/
│       │   ├── workspace_channel.ex           # NEW
│       │   └── ...                            # Renamed
│       └── controllers/
│           ├── workspace_controller.ex        # NEW
│           └── ...                            # Renamed
├── priv/repo/migrations/
│   └── 20260329210001_create_workspace_windows.exs  # NEW
└── test/
    └── ema/
        └── workspace_test.exs                 # NEW
```

### Frontend Changes (`app/`)

```
app/
├── package.json                               # Rename to ema
├── src-tauri/
│   ├── tauri.conf.json                        # Multi-window config
│   ├── capabilities/
│   │   └── default.json                       # NEW — permissions
│   ├── src/
│   │   ├── lib.rs                             # + tray icon setup
│   │   └── main.rs                            # Unchanged
│   └── Cargo.toml                             # + tray dependencies
├── src/
│   ├── main.tsx                               # Unchanged
│   ├── App.tsx                                # Route-based rendering
│   ├── lib/
│   │   ├── ws.ts                              # Unchanged
│   │   ├── api.ts                             # Unchanged
│   │   ├── window-manager.ts                  # NEW — open/close/focus
│   │   ├── springs.ts                         # Unchanged
│   │   └── date-utils.ts                      # Unchanged
│   ├── stores/
│   │   ├── workspace-store.ts                 # NEW — window state
│   │   └── ...                                # Unchanged
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppWindowChrome.tsx            # NEW — shared title bar
│   │   │   ├── Launchpad.tsx                  # NEW — replaces DashboardPage
│   │   │   ├── Dock.tsx                       # NEW — evolved Sidebar
│   │   │   ├── AppTile.tsx                    # NEW — launchpad tile
│   │   │   ├── Shell.tsx                      # Modified for Launchpad only
│   │   │   ├── AmbientStrip.tsx               # Modified (ema brand)
│   │   │   └── CommandBar.tsx                 # Unchanged
│   │   ├── brain-dump/
│   │   │   ├── BrainDumpApp.tsx               # NEW — window wrapper
│   │   │   └── ...                            # Unchanged
│   │   ├── habits/
│   │   │   ├── HabitsApp.tsx                  # NEW — window wrapper
│   │   │   └── ...                            # Unchanged
│   │   ├── journal/
│   │   │   ├── JournalApp.tsx                 # NEW — window wrapper
│   │   │   └── ...                            # Unchanged
│   │   ├── settings/
│   │   │   ├── SettingsApp.tsx                # NEW — window wrapper
│   │   │   └── ...                            # Unchanged
│   │   ├── dashboard/                         # Kept for card components
│   │   └── ui/                                # Unchanged
│   ├── types/
│   │   └── workspace.ts                       # NEW
│   └── styles/
│       └── globals.css                        # Update brand vars
├── scripts/
│   ├── dev.sh                                 # Rename references
│   └── ema.service                            # Renamed from ema.service
```

---

## Task 1: Rename Daemon — Place → Ema

This is a bulk mechanical rename across all daemon files. Every `Place` becomes `Ema`, every `PlaceWeb` becomes `EmaWeb`, every `place` becomes `ema`.

**Files:** All files under `daemon/`

- [ ] **Step 1: Rename directory structure**

```bash
cd /home/trajan/Projects/ema/daemon

# Rename lib directories
mv lib/place.ex lib/ema.ex
mv lib/place lib/ema
mv lib/place_web.ex lib/ema_web.ex
mv lib/place_web lib/ema_web

# Rename test directories
mv test/place test/ema 2>/dev/null || true
mv test/place_web test/ema_web 2>/dev/null || true
```

- [ ] **Step 2: Bulk rename module references in all .ex and .exs files**

```bash
cd /home/trajan/Projects/ema/daemon

# Replace PlaceWeb → EmaWeb (must come before Place → Ema to avoid PlaceWeb becoming EmaWeb)
find . -name "*.ex" -o -name "*.exs" | xargs sed -i 's/PlaceWeb/EmaWeb/g'
find . -name "*.ex" -o -name "*.exs" | xargs sed -i 's/Place\b/Ema/g'
find . -name "*.ex" -o -name "*.exs" | xargs sed -i 's/:place\b/:ema/g'
find . -name "*.ex" -o -name "*.exs" | xargs sed -i 's/place_web/ema_web/g'

# Fix the otp_app references
find . -name "*.ex" -o -name "*.exs" | xargs sed -i 's/otp_app: :ema/otp_app: :ema/g'
```

- [ ] **Step 3: Update mix.exs app name**

In `daemon/mix.exs`, ensure:
```elixir
def project do
  [
    app: :ema,
    # ...
    compilers: Mix.compilers(),
    start_permanent: Mix.env() == :prod,
    aliases: aliases(),
    deps: deps()
  ]
end

def application do
  [
    mod: {Ema.Application, []},
    extra_applications: [:logger, :runtime_tools]
  ]
end
```

- [ ] **Step 4: Update config files — database paths**

In `config/dev.exs`, change:
```elixir
config :ema, Ema.Repo,
  database: Path.expand("~/.local/share/ema/ema_dev.db"),
```

In `config/test.exs`, change:
```elixir
config :ema, Ema.Repo,
  database: Path.expand("~/.local/share/ema/ema_test.db"),
```

In `config/runtime.exs`, update all `:place` references to `:ema` and `Place`/`PlaceWeb` to `Ema`/`EmaWeb`.

- [ ] **Step 5: Verify compilation**

```bash
cd /home/trajan/Projects/ema/daemon
mix deps.get && mix compile
```

Expected: Clean compilation with no errors. There may be warnings about unused variables — those are acceptable.

- [ ] **Step 6: Run tests**

```bash
cd /home/trajan/Projects/ema/daemon
mix test
```

Expected: All existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename daemon Place → Ema across all modules and configs"
```

---

## Task 2: Add Workspace Context to Daemon

New context that tracks which app windows are open, their positions and sizes.

**Files:**
- Create: `daemon/priv/repo/migrations/20260329210001_create_workspace_windows.exs`
- Create: `daemon/lib/ema/workspace/window_state.ex`
- Create: `daemon/lib/ema/workspace/workspace.ex`
- Create: `daemon/test/ema/workspace_test.exs`

- [ ] **Step 1: Generate the migration file**

```bash
cd /home/trajan/Projects/ema/daemon
mix ecto.gen.migration create_workspace_windows
```

- [ ] **Step 2: Write the migration**

Edit the generated migration file in `daemon/priv/repo/migrations/*_create_workspace_windows.exs`:

```elixir
defmodule Ema.Repo.Migrations.CreateWorkspaceWindows do
  use Ecto.Migration

  def change do
    create table(:workspace_windows) do
      add :app_id, :string, null: false
      add :is_open, :boolean, default: false, null: false
      add :x, :integer
      add :y, :integer
      add :width, :integer
      add :height, :integer
      add :is_maximized, :boolean, default: false, null: false

      timestamps()
    end

    create unique_index(:workspace_windows, [:app_id])
  end
end
```

- [ ] **Step 3: Write the WindowState schema**

Create `daemon/lib/ema/workspace/window_state.ex`:

```elixir
defmodule Ema.Workspace.WindowState do
  use Ecto.Schema
  import Ecto.Changeset

  schema "workspace_windows" do
    field :app_id, :string
    field :is_open, :boolean, default: false
    field :x, :integer
    field :y, :integer
    field :width, :integer
    field :height, :integer
    field :is_maximized, :boolean, default: false

    timestamps()
  end

  @required_fields [:app_id]
  @optional_fields [:is_open, :x, :y, :width, :height, :is_maximized]

  def changeset(window_state, attrs) do
    window_state
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> unique_constraint(:app_id)
  end
end
```

- [ ] **Step 4: Write the Workspace context**

Create `daemon/lib/ema/workspace/workspace.ex`:

```elixir
defmodule Ema.Workspace do
  @moduledoc """
  Tracks open/closed state and position/size of app windows for workspace restoration.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Workspace.WindowState

  def list_all do
    Repo.all(WindowState)
  end

  def list_open do
    WindowState
    |> where([w], w.is_open == true)
    |> Repo.all()
  end

  def get_by_app_id(app_id) do
    Repo.get_by(WindowState, app_id: app_id)
  end

  def upsert(app_id, attrs) do
    case get_by_app_id(app_id) do
      nil ->
        %WindowState{}
        |> WindowState.changeset(Map.put(attrs, :app_id, app_id))
        |> Repo.insert()

      existing ->
        existing
        |> WindowState.changeset(attrs)
        |> Repo.update()
    end
  end

  def mark_open(app_id, attrs \\ %{}) do
    upsert(app_id, Map.put(attrs, :is_open, true))
  end

  def mark_closed(app_id, attrs \\ %{}) do
    upsert(app_id, Map.put(attrs, :is_open, false))
  end

  def close_all do
    from(w in WindowState, where: w.is_open == true)
    |> Repo.update_all(set: [is_open: false, updated_at: DateTime.utc_now()])
  end
end
```

- [ ] **Step 5: Write workspace tests**

Create `daemon/test/ema/workspace_test.exs`:

```elixir
defmodule Ema.WorkspaceTest do
  use Ema.DataCase

  alias Ema.Workspace

  describe "upsert/2" do
    test "creates a new window state" do
      assert {:ok, ws} = Workspace.upsert("brain-dump", %{x: 100, y: 200, width: 600, height: 700})
      assert ws.app_id == "brain-dump"
      assert ws.x == 100
      assert ws.is_open == false
    end

    test "updates existing window state" do
      {:ok, _} = Workspace.upsert("habits", %{x: 0, y: 0})
      {:ok, ws} = Workspace.upsert("habits", %{x: 500, y: 300})
      assert ws.x == 500
      assert ws.y == 300
    end
  end

  describe "mark_open/2 and mark_closed/2" do
    test "toggles is_open flag" do
      {:ok, ws} = Workspace.mark_open("journal", %{x: 100, y: 100, width: 800, height: 700})
      assert ws.is_open == true

      {:ok, ws} = Workspace.mark_closed("journal", %{x: 150, y: 120})
      assert ws.is_open == false
      assert ws.x == 150
    end
  end

  describe "list_open/0" do
    test "returns only open windows" do
      {:ok, _} = Workspace.mark_open("brain-dump")
      {:ok, _} = Workspace.mark_closed("habits")
      {:ok, _} = Workspace.mark_open("journal")

      open = Workspace.list_open()
      app_ids = Enum.map(open, & &1.app_id) |> Enum.sort()
      assert app_ids == ["brain-dump", "journal"]
    end
  end

  describe "close_all/0" do
    test "marks all windows as closed" do
      {:ok, _} = Workspace.mark_open("brain-dump")
      {:ok, _} = Workspace.mark_open("journal")

      Workspace.close_all()

      assert Workspace.list_open() == []
    end
  end
end
```

- [ ] **Step 6: Run migration and tests**

```bash
cd /home/trajan/Projects/ema/daemon
mix ecto.migrate
mix test test/ema/workspace_test.exs
```

Expected: Migration runs, all 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Workspace context for window state persistence"
```

---

## Task 3: Add Workspace REST Controller and Channel

Wire up HTTP endpoints and WebSocket channel for workspace state.

**Files:**
- Create: `daemon/lib/ema_web/controllers/workspace_controller.ex`
- Create: `daemon/lib/ema_web/channels/workspace_channel.ex`
- Modify: `daemon/lib/ema_web/router.ex`
- Modify: `daemon/lib/ema_web/user_socket.ex`

- [ ] **Step 1: Write the workspace controller**

Create `daemon/lib/ema_web/controllers/workspace_controller.ex`:

```elixir
defmodule EmaWeb.WorkspaceController do
  use EmaWeb, :controller

  alias Ema.Workspace

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    windows = Workspace.list_all()
    json(conn, %{data: Enum.map(windows, &window_json/1)})
  end

  def update(conn, %{"app_id" => app_id} = params) do
    attrs =
      params
      |> Map.take(["is_open", "x", "y", "width", "height", "is_maximized"])
      |> Map.new(fn {k, v} -> {String.to_existing_atom(k), v} end)

    with {:ok, window} <- Workspace.upsert(app_id, attrs) do
      EmaWeb.Endpoint.broadcast("workspace:state", "window_updated", window_json(window))
      json(conn, %{data: window_json(window)})
    end
  end

  defp window_json(window) do
    %{
      app_id: window.app_id,
      is_open: window.is_open,
      x: window.x,
      y: window.y,
      width: window.width,
      height: window.height,
      is_maximized: window.is_maximized
    }
  end
end
```

- [ ] **Step 2: Write the workspace channel**

Create `daemon/lib/ema_web/channels/workspace_channel.ex`:

```elixir
defmodule EmaWeb.WorkspaceChannel do
  use Phoenix.Channel

  alias Ema.Workspace

  def join("workspace:state", _payload, socket) do
    windows = Workspace.list_all()

    data =
      Enum.map(windows, fn w ->
        %{
          app_id: w.app_id,
          is_open: w.is_open,
          x: w.x,
          y: w.y,
          width: w.width,
          height: w.height,
          is_maximized: w.is_maximized
        }
      end)

    {:ok, %{windows: data}, socket}
  end
end
```

- [ ] **Step 3: Add routes and channel to router/socket**

In `daemon/lib/ema_web/router.ex`, add inside the `/api` scope:

```elixir
    get "/workspace", WorkspaceController, :index
    put "/workspace/:app_id", WorkspaceController, :update
```

In `daemon/lib/ema_web/user_socket.ex`, add:

```elixir
    channel "workspace:*", EmaWeb.WorkspaceChannel
```

- [ ] **Step 4: Verify compilation**

```bash
cd /home/trajan/Projects/ema/daemon
mix compile
```

Expected: Clean compilation.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add workspace REST endpoints and WebSocket channel"
```

---

## Task 4: Rename Frontend Project Config

Rename the Tauri app from ema to ema and update identifiers.

**Files:**
- Modify: `app/package.json`
- Modify: `app/src-tauri/tauri.conf.json`
- Modify: `app/src-tauri/Cargo.toml`
- Modify: `app/src/components/layout/AmbientStrip.tsx`
- Modify: `app/src/styles/globals.css`

- [ ] **Step 1: Update package.json name**

In `app/package.json`, change the `name` field (if present) to `"ema"`. If there's no name field, add one:

```json
{
  "name": "ema",
  ...
}
```

- [ ] **Step 2: Update tauri.conf.json**

Replace the contents of `app/src-tauri/tauri.conf.json` with:

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "ema",
  "version": "0.1.0",
  "identifier": "org.ema.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "label": "launchpad",
        "title": "EMA",
        "width": 900,
        "height": 650,
        "minWidth": 700,
        "minHeight": 500,
        "resizable": true,
        "fullscreen": false,
        "decorations": false,
        "transparent": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

Key changes: `productName` → `"ema"`, `identifier` → `"org.ema.app"`, window gets `label: "launchpad"`, smaller default size (900x650), and the `title` becomes `"EMA"`.

- [ ] **Step 3: Update Cargo.toml package name**

In `app/src-tauri/Cargo.toml`, change:

```toml
[package]
name = "ema"
```

And update the lib name:

```toml
[lib]
name = "ema_lib"
```

- [ ] **Step 4: Update lib.rs to match new crate name**

In `app/src-tauri/src/main.rs`, change:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ema_lib::run();
}
```

- [ ] **Step 5: Update AmbientStrip brand text**

In `app/src/components/layout/AmbientStrip.tsx`, change the brand text from `"place"` to `"ema"`:

```tsx
      <span
        className="text-[0.65rem] font-medium tracking-wider"
        style={{ color: "var(--color-pn-secondary-400)" }}
      >
        ema
      </span>
```

- [ ] **Step 6: Verify frontend compiles**

```bash
cd /home/trajan/Projects/ema/app
pnpm build
```

Expected: Successful build (Vite + TypeScript compile).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename frontend from ema to ema"
```

---

## Task 5: Add Workspace Types and Store

Frontend types and Zustand store for workspace state.

**Files:**
- Create: `app/src/types/workspace.ts`
- Create: `app/src/stores/workspace-store.ts`

- [ ] **Step 1: Write workspace types**

Create `app/src/types/workspace.ts`:

```typescript
export interface WindowState {
  readonly app_id: string;
  readonly is_open: boolean;
  readonly x: number | null;
  readonly y: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly is_maximized: boolean;
}

export interface WindowConfig {
  readonly title: string;
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly accent: string;
  readonly icon: string;
}

export const APP_CONFIGS: Record<string, WindowConfig> = {
  "brain-dump": {
    title: "Brain Dump",
    defaultWidth: 600,
    defaultHeight: 700,
    minWidth: 480,
    minHeight: 400,
    accent: "#6b95f0",
    icon: "◎",
  },
  habits: {
    title: "Habits",
    defaultWidth: 650,
    defaultHeight: 700,
    minWidth: 500,
    minHeight: 400,
    accent: "#2dd4a8",
    icon: "↻",
  },
  journal: {
    title: "Journal",
    defaultWidth: 800,
    defaultHeight: 700,
    minWidth: 600,
    minHeight: 500,
    accent: "#f59e0b",
    icon: "✎",
  },
  settings: {
    title: "Settings",
    defaultWidth: 600,
    defaultHeight: 600,
    minWidth: 500,
    minHeight: 400,
    accent: "rgba(255,255,255,0.50)",
    icon: "⚙",
  },
} as const;
```

- [ ] **Step 2: Write workspace store**

Create `app/src/stores/workspace-store.ts`:

```typescript
import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "@/lib/ws";
import type { WindowState } from "@/types/workspace";

interface WorkspaceStore {
  windows: WindowState[];
  channel: Channel | null;
  load: () => Promise<void>;
  connect: () => Promise<void>;
  updateWindow: (appId: string, state: Partial<WindowState>) => Promise<void>;
  isOpen: (appId: string) => boolean;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  windows: [],
  channel: null,

  load: async () => {
    const res = await api.get<{ data: WindowState[] }>("/workspace");
    set({ windows: res.data });
  },

  connect: async () => {
    const { channel } = await joinChannel("workspace:state");
    channel.on("window_updated", (payload: WindowState) => {
      set((state) => {
        const idx = state.windows.findIndex((w) => w.app_id === payload.app_id);
        const updated = [...state.windows];
        if (idx >= 0) {
          updated[idx] = payload;
        } else {
          updated.push(payload);
        }
        return { windows: updated };
      });
    });
    set({ channel });
  },

  updateWindow: async (appId, attrs) => {
    await api.put(`/workspace/${appId}`, attrs);
  },

  isOpen: (appId) => {
    return get().windows.some((w) => w.app_id === appId && w.is_open);
  },
}));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/trajan/Projects/ema/app
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add workspace types and Zustand store"
```

---

## Task 6: Create Window Manager Module

The core module that opens, closes, and focuses app windows using Tauri's `WebviewWindow` API.

**Files:**
- Create: `app/src/lib/window-manager.ts`

- [ ] **Step 1: Install Tauri API dependency**

```bash
cd /home/trajan/Projects/ema/app
pnpm add @tauri-apps/api
```

- [ ] **Step 2: Write the window manager**

Create `app/src/lib/window-manager.ts`:

```typescript
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { WindowState } from "@/types/workspace";

export async function openApp(appId: string, savedState?: WindowState | null): Promise<void> {
  const existing = await WebviewWindow.getByLabel(appId);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const config = APP_CONFIGS[appId];
  if (!config) return;

  const x = savedState?.x ?? undefined;
  const y = savedState?.y ?? undefined;
  const width = savedState?.width ?? config.defaultWidth;
  const height = savedState?.height ?? config.defaultHeight;

  const webview = new WebviewWindow(appId, {
    url: `/${appId}`,
    title: config.title,
    width,
    height,
    x,
    y,
    decorations: false,
    transparent: true,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
  });

  webview.once("tauri://created", () => {
    useWorkspaceStore.getState().updateWindow(appId, { is_open: true });
  });

  webview.once("tauri://error", (e) => {
    console.error(`Failed to create window for ${appId}:`, e);
  });
}

export async function closeApp(appId: string): Promise<void> {
  const existing = await WebviewWindow.getByLabel(appId);
  if (existing) {
    await existing.close();
  }
}

export async function restoreWorkspace(): Promise<void> {
  const store = useWorkspaceStore.getState();
  await store.load();

  const openWindows = store.windows.filter((w) => w.is_open);
  for (const windowState of openWindows) {
    if (windowState.app_id === "launchpad") continue;
    await openApp(windowState.app_id, windowState);
  }
}

export async function saveWindowState(appId: string): Promise<void> {
  const existing = await WebviewWindow.getByLabel(appId);
  if (!existing) return;

  const position = await existing.outerPosition();
  const size = await existing.outerSize();
  const maximized = await existing.isMaximized();

  await useWorkspaceStore.getState().updateWindow(appId, {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    is_maximized: maximized,
    is_open: false,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/trajan/Projects/ema/app
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add window manager for multi-window lifecycle"
```

---

## Task 7: Create AppWindowChrome Component

Shared custom title bar used by all app windows. Handles drag, close, minimize, maximize.

**Files:**
- Create: `app/src/components/layout/AppWindowChrome.tsx`

- [ ] **Step 1: Write the AppWindowChrome component**

Create `app/src/components/layout/AppWindowChrome.tsx`:

```tsx
import { useEffect, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { saveWindowState } from "@/lib/window-manager";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface AppWindowChromeProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly breadcrumb?: string;
  readonly children: ReactNode;
}

export function AppWindowChrome({
  appId,
  title,
  icon,
  accent,
  breadcrumb,
  children,
}: AppWindowChromeProps) {
  useEffect(() => {
    const win = getCurrentWindow();

    const unlistenClose = win.onCloseRequested(async (event) => {
      event.preventDefault();
      await saveWindowState(appId);
      await useWorkspaceStore.getState().updateWindow(appId, { is_open: false });
      await win.destroy();
    });

    return () => {
      unlistenClose.then((fn) => fn());
    };
  }, [appId]);

  async function handleMinimize() {
    await getCurrentWindow().minimize();
  }

  async function handleMaximize() {
    const win = getCurrentWindow();
    const maximized = await win.isMaximized();
    if (maximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  }

  async function handleClose() {
    await saveWindowState(appId);
    await useWorkspaceStore.getState().updateWindow(appId, { is_open: false });
    await getCurrentWindow().destroy();
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-pn-base)" }}>
      {/* Custom title bar */}
      <div
        className="glass-surface flex items-center justify-between px-3.5 shrink-0"
        style={{
          height: "36px",
          borderBottom: "1px solid var(--pn-border-subtle)",
        }}
        data-tauri-drag-region=""
      >
        <div className="flex items-center gap-2" data-tauri-drag-region="">
          <span style={{ color: accent, fontSize: "14px" }}>{icon}</span>
          <span
            className="text-[0.7rem] font-semibold tracking-wide"
            style={{ color: accent, letterSpacing: "0.06em" }}
          >
            {title}
          </span>
          {breadcrumb && (
            <span
              className="text-[0.6rem] font-mono"
              style={{ color: "var(--pn-text-muted)" }}
            >
              · {breadcrumb}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "#EAB308" }}
          />
          <button
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "#22C55E" }}
          />
          <button
            onClick={handleClose}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "#E24B4A" }}
          />
        </div>
      </div>

      {/* App content */}
      <main className="flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/trajan/Projects/ema/app
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add AppWindowChrome shared title bar component"
```

---

## Task 8: Create Dock and AppTile Components

The dock (evolved sidebar) with running indicators, and the app tile for the Launchpad grid.

**Files:**
- Create: `app/src/components/layout/Dock.tsx`
- Create: `app/src/components/layout/AppTile.tsx`

- [ ] **Step 1: Write the Dock component**

Create `app/src/components/layout/Dock.tsx`:

```tsx
import { Tooltip } from "@/components/ui/Tooltip";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";
import { openApp } from "@/lib/window-manager";

const DOCK_APPS = [
  { id: "brain-dump", icon: "◎", label: "Brain Dump" },
  { id: "habits", icon: "↻", label: "Habits" },
  { id: "journal", icon: "✎", label: "Journal" },
] as const;

export function Dock() {
  const isOpen = useWorkspaceStore((s) => s.isOpen);
  const windows = useWorkspaceStore((s) => s.windows);

  function handleClick(appId: string) {
    const saved = windows.find((w) => w.app_id === appId) ?? null;
    openApp(appId, saved);
  }

  return (
    <div
      className="glass-surface flex flex-col items-center py-3 shrink-0"
      style={{ width: "56px", borderRight: "1px solid var(--pn-border-subtle)" }}
    >
      <nav className="flex flex-col gap-1 flex-1">
        {/* Launchpad icon — always active */}
        <Tooltip label="Launchpad">
          <button
            className="relative flex items-center justify-center rounded-md"
            style={{
              width: "40px",
              height: "40px",
              color: "var(--color-pn-primary-400)",
              background: "rgba(45, 212, 168, 0.08)",
              fontSize: "1.1rem",
            }}
          >
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
              style={{
                width: "2px",
                height: "20px",
                background: "var(--color-pn-primary-400)",
              }}
            />
            ◉
          </button>
        </Tooltip>

        <div
          className="my-1"
          style={{ width: "24px", height: "1px", background: "var(--pn-border-default)", alignSelf: "center" }}
        />

        {DOCK_APPS.map(({ id, icon, label }) => {
          const running = isOpen(id);
          const config = APP_CONFIGS[id];
          return (
            <Tooltip key={id} label={label}>
              <button
                onClick={() => handleClick(id)}
                className="relative flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
                style={{
                  width: "40px",
                  height: "40px",
                  color: running ? (config?.accent ?? "var(--pn-text-tertiary)") : "var(--pn-text-tertiary)",
                  fontSize: "1.1rem",
                }}
              >
                {icon}
                {running && (
                  <span
                    className="absolute bottom-0.5 right-0.5 rounded-full"
                    style={{
                      width: "6px",
                      height: "6px",
                      background: "#22C55E",
                      border: "1px solid var(--color-pn-base)",
                    }}
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
      </nav>

      <div
        className="my-2"
        style={{ width: "24px", height: "1px", background: "var(--pn-border-default)" }}
      />

      <Tooltip label="Settings">
        <button
          onClick={() => {
            const saved = windows.find((w) => w.app_id === "settings") ?? null;
            openApp("settings", saved);
          }}
          className="flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
          style={{
            width: "40px",
            height: "40px",
            color: isOpen("settings") ? "rgba(255,255,255,0.60)" : "var(--pn-text-tertiary)",
            fontSize: "1rem",
          }}
        >
          ⚙
          {isOpen("settings") && (
            <span
              className="absolute bottom-0.5 right-0.5 rounded-full"
              style={{
                width: "6px",
                height: "6px",
                background: "#22C55E",
                border: "1px solid var(--color-pn-base)",
              }}
            />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
```

- [ ] **Step 2: Write the AppTile component**

Create `app/src/components/layout/AppTile.tsx`:

```tsx
import type { ReactNode } from "react";

interface AppTileProps {
  readonly appId: string;
  readonly name: string;
  readonly icon: string;
  readonly accent: string;
  readonly status?: string;
  readonly badge?: number;
  readonly progress?: number;
  readonly scaffolded?: boolean;
  readonly onClick: () => void;
  readonly children?: ReactNode;
}

export function AppTile({
  name,
  icon,
  accent,
  status,
  badge,
  progress,
  scaffolded = false,
  onClick,
}: AppTileProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col text-left rounded-xl p-4 transition-all hover:-translate-y-px"
      style={{
        background: "rgba(14, 16, 23, 0.55)",
        backdropFilter: "blur(20px) saturate(150%)",
        border: scaffolded
          ? "1px dashed rgba(255,255,255,0.06)"
          : "1px solid rgba(255,255,255,0.06)",
        borderTop: scaffolded ? undefined : `2px solid ${accent}`,
        opacity: scaffolded ? 0.45 : 1,
      }}
    >
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute top-2.5 right-2.5 text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
          style={{ background: "#2dd4a8", color: "#08090E" }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <span className="text-[1.4rem] mb-2.5" style={{ color: scaffolded ? "var(--pn-text-tertiary)" : accent }}>
        {icon}
      </span>
      <span className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
        {name}
      </span>
      {status && (
        <span
          className="text-[0.65rem] font-mono mt-1"
          style={{ color: scaffolded ? "rgba(255,255,255,0.25)" : "var(--pn-text-muted)" }}
        >
          {status}
        </span>
      )}
      {progress !== undefined && (
        <div className="mt-auto pt-2.5">
          <div
            className="h-[3px] rounded-sm overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-sm transition-all"
              style={{ width: `${Math.min(progress, 100)}%`, background: accent }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/trajan/Projects/ema/app
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Dock and AppTile components for Launchpad"
```

---

## Task 9: Create Launchpad Component

The main Launchpad view that replaces DashboardPage. Shows greeting, one thing, app tiles, and wires up window launching.

**Files:**
- Create: `app/src/components/layout/Launchpad.tsx`

- [ ] **Step 1: Write the Launchpad component**

Create `app/src/components/layout/Launchpad.tsx`:

```tsx
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHabitsStore } from "@/stores/habits-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useJournalStore } from "@/stores/journal-store";
import { openApp } from "@/lib/window-manager";
import { APP_CONFIGS } from "@/types/workspace";
import { AppTile } from "./AppTile";
import { OneThingCard } from "@/components/dashboard/OneThingCard";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

const SCAFFOLDED_APPS = [
  { id: "tasks", name: "Tasks", icon: "☐" },
  { id: "goals", name: "Goals", icon: "◎" },
  { id: "focus", name: "Focus", icon: "⏱" },
  { id: "notes", name: "Notes", icon: "✦" },
] as const;

export function Launchpad() {
  const inboxItems = useBrainDumpStore((s) => s.items);
  const habits = useHabitsStore((s) => s.habits);
  const todayLogs = useHabitsStore((s) => s.todayLogs);
  const entry = useJournalStore((s) => s.currentEntry);
  const windows = useWorkspaceStore((s) => s.windows);

  const unprocessedCount = inboxItems.filter((i) => !i.processed).length;
  const completedToday = todayLogs.filter((l) => l.completed).length;
  const habitCount = habits.length;
  const habitProgress = habitCount > 0 ? Math.round((completedToday / habitCount) * 100) : 0;

  const journalStatus = entry?.updated_at
    ? `last entry ${formatRelativeTime(entry.updated_at)}`
    : "no entry today";

  function handleOpenApp(appId: string) {
    const saved = windows.find((w) => w.app_id === appId) ?? null;
    openApp(appId, saved);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Greeting */}
      <div className="flex justify-between items-baseline">
        <h1 className="text-[1.2rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          {getGreeting()},{" "}
          <span style={{ color: "var(--color-pn-primary-400)" }}>Trajan</span>
        </h1>
        <span
          className="text-[0.7rem] font-mono"
          style={{ color: "var(--pn-text-muted)" }}
        >
          {formatDate()}
        </span>
      </div>

      {/* One Thing */}
      <OneThingCard />

      {/* App Tile Grid */}
      <div className="grid grid-cols-4 gap-3">
        {/* V1 Apps */}
        <AppTile
          appId="brain-dump"
          name="Brain Dump"
          icon={APP_CONFIGS["brain-dump"].icon}
          accent={APP_CONFIGS["brain-dump"].accent}
          badge={unprocessedCount}
          status={`${unprocessedCount} unprocessed`}
          onClick={() => handleOpenApp("brain-dump")}
        />
        <AppTile
          appId="habits"
          name="Habits"
          icon={APP_CONFIGS.habits.icon}
          accent={APP_CONFIGS.habits.accent}
          status={`${completedToday}/${habitCount} today`}
          progress={habitProgress}
          onClick={() => handleOpenApp("habits")}
        />
        <AppTile
          appId="journal"
          name="Journal"
          icon={APP_CONFIGS.journal.icon}
          accent={APP_CONFIGS.journal.accent}
          status={journalStatus}
          onClick={() => handleOpenApp("journal")}
        />
        <AppTile
          appId="settings"
          name="Settings"
          icon={APP_CONFIGS.settings.icon}
          accent={APP_CONFIGS.settings.accent}
          status="workspace · apps · data"
          onClick={() => handleOpenApp("settings")}
        />

        {/* Scaffolded Apps */}
        {SCAFFOLDED_APPS.map((app) => (
          <AppTile
            key={app.id}
            appId={app.id}
            name={app.name}
            icon={app.icon}
            accent="var(--pn-text-tertiary)"
            status="coming soon"
            scaffolded
            onClick={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/trajan/Projects/ema/app
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Launchpad component with greeting, tiles, and live data"
```

---

## Task 10: Create App Window Wrappers

Each app gets a thin wrapper component that loads its data and renders inside `AppWindowChrome`.

**Files:**
- Create: `app/src/components/brain-dump/BrainDumpApp.tsx`
- Create: `app/src/components/habits/HabitsApp.tsx`
- Create: `app/src/components/journal/JournalApp.tsx`
- Create: `app/src/components/settings/SettingsApp.tsx`

- [ ] **Step 1: Write BrainDumpApp**

Create `app/src/components/brain-dump/BrainDumpApp.tsx`:

```tsx
import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { BrainDumpPage } from "./BrainDumpPage";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["brain-dump"];

export function BrainDumpApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useBrainDumpStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useBrainDumpStore.getState().connect().catch(() => {
        console.warn("Brain Dump WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="brain-dump" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="brain-dump" title={config.title} icon={config.icon} accent={config.accent} breadcrumb="Queue">
      <BrainDumpPage />
    </AppWindowChrome>
  );
}
```

- [ ] **Step 2: Write HabitsApp**

Create `app/src/components/habits/HabitsApp.tsx`:

```tsx
import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { HabitsPage } from "./HabitsPage";
import { useHabitsStore } from "@/stores/habits-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.habits;

export function HabitsApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useHabitsStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useHabitsStore.getState().connect().catch(() => {
        console.warn("Habits WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="habits" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="habits" title={config.title} icon={config.icon} accent={config.accent} breadcrumb="Today">
      <HabitsPage />
    </AppWindowChrome>
  );
}
```

- [ ] **Step 3: Write JournalApp**

Create `app/src/components/journal/JournalApp.tsx`:

```tsx
import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { JournalPage } from "./JournalPage";
import { useJournalStore } from "@/stores/journal-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.journal;

export function JournalApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useJournalStore.getState().loadEntry();
      if (!cancelled) setReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="journal" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="journal" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}>
      <JournalPage />
    </AppWindowChrome>
  );
}
```

- [ ] **Step 4: Write SettingsApp**

Create `app/src/components/settings/SettingsApp.tsx`:

```tsx
import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SettingsPage } from "./SettingsPage";
import { useSettingsStore } from "@/stores/settings-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.settings;

export function SettingsApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useSettingsStore.getState().load();
      if (!cancelled) setReady(true);
      useSettingsStore.getState().connect().catch(() => {
        console.warn("Settings WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="settings" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="settings" title={config.title} icon={config.icon} accent={config.accent}>
      <SettingsPage />
    </AppWindowChrome>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/trajan/Projects/ema/app
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add app window wrappers for all V1 apps"
```

---

## Task 11: Rewrite App.tsx with Route-Based Rendering

Replace the page-swapping `App.tsx` with route-based rendering. The URL path determines which app to render.

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/layout/Shell.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire contents of `app/src/App.tsx` with:

```tsx
import { Shell } from "@/components/layout/Shell";
import { Launchpad } from "@/components/layout/Launchpad";
import { BrainDumpApp } from "@/components/brain-dump/BrainDumpApp";
import { HabitsApp } from "@/components/habits/HabitsApp";
import { JournalApp } from "@/components/journal/JournalApp";
import { SettingsApp } from "@/components/settings/SettingsApp";

function getRoute(): string {
  return window.location.pathname.replace(/^\/+/, "") || "launchpad";
}

export default function App() {
  const route = getRoute();

  switch (route) {
    case "brain-dump":
      return <BrainDumpApp />;
    case "habits":
      return <HabitsApp />;
    case "journal":
      return <JournalApp />;
    case "settings":
      return <SettingsApp />;
    default:
      return (
        <Shell>
          <Launchpad />
        </Shell>
      );
  }
}
```

- [ ] **Step 2: Simplify Shell.tsx for Launchpad only**

Replace the entire contents of `app/src/components/layout/Shell.tsx` with:

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { AmbientStrip } from "./AmbientStrip";
import { Dock } from "./Dock";
import { CommandBar } from "./CommandBar";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHabitsStore } from "@/stores/habits-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { restoreWorkspace } from "@/lib/window-manager";

interface ShellProps {
  readonly children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await Promise.all([
          useDashboardStore.getState().loadViaRest(),
          useBrainDumpStore.getState().loadViaRest(),
          useHabitsStore.getState().loadViaRest(),
          useSettingsStore.getState().load(),
          useWorkspaceStore.getState().load(),
        ]);
        if (!cancelled) setReady(true);

        // Connect WebSockets in background
        Promise.all([
          useDashboardStore.getState().connect(),
          useBrainDumpStore.getState().connect(),
          useHabitsStore.getState().connect(),
          useSettingsStore.getState().connect(),
          useWorkspaceStore.getState().connect(),
        ]).catch(() => {
          console.warn("WebSocket connection failed, using REST fallback");
        });

        // Restore previously open windows
        await restoreWorkspace();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Connection failed");
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: "var(--color-pn-base)" }}
      >
        <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
          {error ? `Connection error: ${error}` : "Connecting to daemon..."}
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-pn-base)" }}>
      <AmbientStrip />
      <div className="flex flex-1 min-h-0">
        <Dock />
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
      <CommandBar />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/trajan/Projects/ema/app
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: rewrite App.tsx with route-based rendering for multi-window"
```

---

## Task 12: Configure Tauri for Multi-Window + Tray

Set up Tauri capabilities, tray icon in Rust, and required permissions.

**Files:**
- Create: `app/src-tauri/capabilities/default.json`
- Modify: `app/src-tauri/Cargo.toml`
- Modify: `app/src-tauri/src/lib.rs`

- [ ] **Step 1: Create capabilities file**

Create `app/src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window and spawned app windows",
  "windows": ["launchpad", "brain-dump", "habits", "journal", "settings"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-create",
    "core:window:allow-close",
    "core:window:allow-set-focus",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-is-maximized",
    "core:window:allow-outer-position",
    "core:window:allow-outer-size",
    "core:window:allow-destroy",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:webview:default",
    "core:webview:allow-create-webview-window",
    "core:webview:allow-set-webview-focus",
    "http:default"
  ]
}
```

- [ ] **Step 2: Add tray dependencies to Cargo.toml**

In `app/src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
tauri-plugin-shell = "2"
```

Note: Tray icon support is built into Tauri 2 core — no extra crate needed. The `menu` feature is already included by default.

- [ ] **Step 3: Update lib.rs with tray icon**

Replace the contents of `app/src-tauri/src/lib.rs` with:

```rust
use tauri::{
    Manager,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Build tray menu
            let show = MenuItemBuilder::with_id("show", "Show Launchpad").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit EMA").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show, &quit])
                .build()?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .tooltip("EMA")
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("launchpad") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("launchpad") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify Rust compiles**

```bash
cd /home/trajan/Projects/ema/app
pnpm tauri build --debug 2>&1 | tail -5
```

If there are compilation issues, check the Cargo.toml dependencies match the Tauri version. If you get a linker error about missing system libraries, that's a system dependency issue — the code itself should compile.

Alternatively, just check the Rust compilation:

```bash
cd /home/trajan/Projects/ema/app/src-tauri
cargo check
```

Expected: No Rust compilation errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: configure Tauri multi-window capabilities and tray icon"
```

---

## Task 13: Handle Launchpad Close → Minimize to Tray

The Launchpad should minimize to tray on close rather than exiting. Add a close handler in the AmbientStrip.

**Files:**
- Modify: `app/src/components/layout/AmbientStrip.tsx`

- [ ] **Step 1: Update AmbientStrip with window controls and close-to-tray**

Replace the contents of `app/src/components/layout/AmbientStrip.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function Clock() {
  const [time, setTime] = useState(() => formatTime());

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-[0.65rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
      {time}
    </span>
  );
}

function formatTime(): string {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${time} · ${date}`;
}

export function AmbientStrip() {
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async (event) => {
      event.preventDefault();
      await win.hide();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  async function handleMinimize() {
    await getCurrentWindow().minimize();
  }

  async function handleMaximize() {
    const win = getCurrentWindow();
    if (await win.isMaximized()) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  }

  async function handleClose() {
    await getCurrentWindow().hide();
  }

  return (
    <div
      className="glass-ambient flex items-center justify-between px-4 shrink-0"
      style={{ height: "32px", borderBottom: "1px solid var(--pn-border-subtle)" }}
      data-tauri-drag-region=""
    >
      <span
        className="text-[0.65rem] font-semibold tracking-wider uppercase"
        style={{ color: "var(--color-pn-primary-400)", letterSpacing: "0.12em" }}
      >
        ema
      </span>
      <Clock />
      <div className="flex items-center gap-2">
        <button
          onClick={handleMinimize}
          className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
          style={{ background: "#EAB308" }}
        />
        <button
          onClick={handleMaximize}
          className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
          style={{ background: "#22C55E" }}
        />
        <button
          onClick={handleClose}
          className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
          style={{ background: "#E24B4A" }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/trajan/Projects/ema/app
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Launchpad minimizes to tray on close, add window controls"
```

---

## Task 14: Update Dev Scripts and Service

Rename scripts and systemd service for EMA.

**Files:**
- Modify: `scripts/dev.sh`
- Rename: `scripts/ema.service` → `scripts/ema.service`

- [ ] **Step 1: Update dev.sh**

Read `scripts/dev.sh` and replace all references to `ema` with `ema` and `place` with `ema`. Update the data directory path to `~/.local/share/ema/`.

- [ ] **Step 2: Rename and update systemd service**

```bash
cd /home/trajan/Projects/ema
mv scripts/ema.service scripts/ema.service 2>/dev/null || true
```

Update `scripts/ema.service` — change the Description, ExecStart paths, and any `ema` references to `ema`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: rename dev scripts and systemd service to ema"
```

---

## Task 15: Verify End-to-End

Smoke test the full stack.

- [ ] **Step 1: Ensure data directory exists**

```bash
mkdir -p ~/.local/share/ema
```

- [ ] **Step 2: Start the daemon**

```bash
cd /home/trajan/Projects/ema/daemon
mix ecto.create
mix ecto.migrate
mix phx.server &
```

Expected: Phoenix server starts on `localhost:4488`.

- [ ] **Step 3: Verify daemon API**

```bash
curl -s http://localhost:4488/api/workspace | python3 -m json.tool
curl -s http://localhost:4488/api/dashboard/today | python3 -m json.tool
```

Expected: JSON responses with `data` arrays/objects.

- [ ] **Step 4: Run all daemon tests**

```bash
cd /home/trajan/Projects/ema/daemon
mix test
```

Expected: All tests pass.

- [ ] **Step 5: Build frontend**

```bash
cd /home/trajan/Projects/ema/app
pnpm build
```

Expected: Clean build.

- [ ] **Step 6: Test Tauri window**

```bash
cd /home/trajan/Projects/ema/app
pnpm tauri dev
```

Expected: Launchpad window opens with EMA brand, dock with running indicators, app tile grid with live data from daemon. Clicking a tile spawns a new OS window. Closing an app window saves its state. Closing the Launchpad hides it to tray.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "test: verify end-to-end multi-window EMA stack"
```
