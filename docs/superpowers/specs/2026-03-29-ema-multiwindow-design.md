# EMA — Multi-Window Architecture Redesign

**Date:** 2026-03-29
**Status:** Approved
**Replaces:** place-native single-window design
**Stack:** Tauri 2 + React 19 + TypeScript + Tailwind v4 + Zustand + Motion | Elixir Phoenix + Ecto + exqlite

---

## 1. Core Concept

EMA is a native Linux command center where each app runs as its own OS-level window. A central Launchpad provides glanceable status and workspace management. The Elixir daemon remains the single source of truth — all windows connect to it independently via WebSocket + REST.

**Key change from place-native:** The single-window sidebar-navigation model is replaced by a multi-window model using Tauri 2's `WebviewWindow` API. One Tauri process spawns multiple independent OS windows, each with its own webview and route.

---

## 2. Architecture

```
┌─── KDE Desktop ───────────────────────────────────────────────┐
│                                                                │
│  ┌─ Launchpad ──┐  ┌─ Habits ──┐  ┌─ Journal ──┐            │
│  │ EMA     ─ □ ✕│  │ Habits ─□✕│  │ Journal ─□✕│            │
│  │ [tiles]      │  │ [full UI] │  │ [full UI]  │            │
│  └──────────────┘  └───────────┘  └────────────┘            │
│                                                                │
│  ┌─ System Tray ──────────────────────────────────────────────┐│
│  │  ... [EMA icon] ...                                        ││
│  └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
                         │ WebSocket + REST │
                         ▼
           ┌─────────────────────────────────┐
           │  Elixir Daemon (port 4488)      │
           │  Phoenix Channels + REST API    │
           │  SQLite: ~/.local/share/ema/    │
           │                                  │
           │  + Workspace State Context       │
           │  (tracks open windows, pos/size) │
           └─────────────────────────────────┘
```

**Single Tauri process, multiple OS windows.** Each window:
- Has its own webview pointed at a route (e.g., `/habits`, `/journal`)
- Appears as a separate entry in KDE taskbar and Alt+Tab
- Can be tiled, snapped, minimized, and closed independently
- Connects to the daemon via its own WebSocket channel

---

## 3. Startup Flow

1. **systemd user service** starts Elixir daemon → runs migrations → binds localhost:4488
2. **KDE autostart .desktop** launches EMA Tauri binary
3. Tauri reads **saved workspace state** from daemon (`GET /api/workspace`)
4. Opens **Launchpad window** (always)
5. **Restores previously open app windows** at their saved positions/sizes
6. Each window connects to the daemon and loads its data via REST, then upgrades to WebSocket

---

## 4. Launchpad Window

The Launchpad evolves from the current Shell + DashboardPage. It is the primary window and always opens on startup.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ ░░ EMA ░░░░░░░░░░░ 14:32 · Sat 29 Mar ░░░ ─ □ ✕ ░ │  ← Ambient strip (drag region, 32px)
├──────┬──────────────────────────────────────────────┤
│      │ Good afternoon, Trajan          SAT 29 MAR   │
│ Dock │                                               │
│      │ ┌─ One Thing ──────────────────────────────┐ │
│ ◉ LP │ │ Finish EMA multi-window architecture     │ │
│      │ └─────────────────────────────────────────┘ │
│ ◎ BD │                                               │
│ ↻ Hb │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│ ✎ Jr │ │🧠 3  │ │✅5/7 │ │📓 2h │ │⚙     │       │
│      │ │Dump  │ │Habits│ │Jrnl  │ │Setts │       │
│      │ ├──────┤ ├──────┤ ├──────┤ ├──────┤       │
│ ───  │ │☐ Task│ │◎ Goal│ │⏱ Fcs │ │✦ Note│       │
│ ⚙    │ │soon  │ │soon  │ │soon  │ │soon  │       │
│      │ └──────┘ └──────┘ └──────┘ └──────┘       │
├──────┴──────────────────────────────────────────────┤
│ ░░ Search everything... Ctrl+K ░░ +Capture +Journal │  ← Command bar (40px)
└─────────────────────────────────────────────────────┘
```

### Components

**Ambient Strip (32px):** Glass-ambient background. Left: "ema" brand in primary-400. Center: clock + date. Right: custom min/max/close buttons. Entire strip is a Tauri drag region.

**Dock (56px, evolved from Sidebar):** Vertical icon rail. Shows all apps. Green running indicator dot on icons whose windows are currently open. Click behavior:
- If app window is open → focus it (bring to front)
- If app window is closed → spawn new window
- Launchpad icon always first, settings gear at bottom with separator

**Greeting:** Personalized "Good [time], [name]" with date.

**One Thing Banner:** Amber left accent border, editable inline. Shared data — changes here reflect in Journal and vice versa.

**App Tile Grid (4 columns):**
- V1 tiles (full color, accent top border): Brain Dump, Habits, Journal, Settings
- Scaffolded tiles (dashed border, dimmed): Tasks, Goals, Focus, Notes
- Each V1 tile shows live glanceable data from daemon:
  - Brain Dump: unprocessed count badge
  - Habits: "X/Y today" + progress bar
  - Journal: "last entry Xh ago"
  - Settings: "workspace · apps · data"
- Click any tile → spawns or focuses its window

**Command Bar (40px):** Glass-ambient background. Search input with Ctrl+K hint. Quick action buttons (+Capture, +Journal).

---

## 5. App Windows

Each app opens as a separate OS window with shared chrome but independent content.

### Shared Window Chrome

Every app window has:
- **Custom title bar (36px):** Glass-surface background. Left: app icon + app name in the app's accent color + breadcrumb showing current view (e.g., "· Today"). Right: custom min/max/close buttons. Title bar is the Tauri drag region.
- **No OS decorations** (`decorations: false` in Tauri config), but proper drag regions and resize handles that KDE can work with.
- **Transparent background** for glass effects.

### Per-App Accent Colors

| App | Accent | Hex |
|-----|--------|-----|
| Brain Dump | Blue | #6b95f0 |
| Habits | Teal | #2dd4a8 |
| Journal | Amber | #f59e0b |
| Settings | Neutral | rgba(255,255,255,0.50) |

The accent color carries through: title bar name, active states, primary action buttons, progress indicators.

### Window Defaults

| App | Default Size | Min Size |
|-----|-------------|----------|
| Launchpad | 900×650 | 700×500 |
| Brain Dump | 600×700 | 480×400 |
| Habits | 650×700 | 500×400 |
| Journal | 800×700 | 600×500 |
| Settings | 600×600 | 500×400 |

### App Content

Each app's content is the existing V1 page component, extracted from the Shell:
- **Brain Dump:** CaptureInput, InboxQueue/KanbanView with segmented toggle
- **Habits:** Tab bar (Today/Week/Month/Streaks), habit rows with streak grids
- **Journal:** CalendarStrip, OneThingInput, JournalEditor (edit/preview/split), MoodPicker, EnergyTracker
- **Settings:** Sections for appearance, startup, workspace, shortcuts, data, about

No sidebar or command bar in app windows — those are Launchpad-only. App windows are focused, single-purpose.

---

## 6. Window Lifecycle

### Opening
Clicking a tile in the Launchpad or a dock icon:
1. Check if window is already open (Tauri window label registry)
2. If open → `window.setFocus()` (bring to front)
3. If closed → `new WebviewWindow(label, config)` with saved or default position/size
4. New window loads its route, connects to daemon, fetches data via REST, upgrades to WebSocket

### Closing
- Closing an app window destroys the webview. State persists in the daemon.
- Launchpad dock updates: running indicator dot removed.
- Window position/size saved to daemon before close.

### Minimizing to Tray
- Closing the **Launchpad** window minimizes to system tray (not destroyed).
- Clicking tray icon restores the Launchpad.
- Tray right-click menu: Show Launchpad, Quick Capture, Quit EMA.
- "Quit EMA" closes all app windows and exits the Tauri process. Daemon keeps running.

---

## 7. Workspace State

New daemon context: `Place.Workspace` (or `Ema.Workspace`).

### Schema: `workspace_windows`

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Primary key |
| app_id | string | Unique app identifier (e.g., "brain-dump", "habits") |
| is_open | boolean | Was this window open when EMA last ran? |
| x | integer | Window X position |
| y | integer | Window Y position |
| width | integer | Window width |
| height | integer | Window height |
| is_maximized | boolean | Was the window maximized? |
| inserted_at | datetime | Created |
| updated_at | datetime | Last modified |

### REST Endpoints

- `GET /api/workspace` — returns all window states (used on startup)
- `PUT /api/workspace/:app_id` — update window state (called on move/resize/close)

### Channel

- `workspace:state` — pushes window state changes (so Launchpad dock can update running indicators in real-time when windows are opened/closed)

---

## 8. Tauri Configuration

### Multi-Window Setup

The main Tauri config defines only the Launchpad window. App windows are created dynamically via the `WebviewWindow` API in the frontend.

```json
{
  "productName": "ema",
  "identifier": "org.ema.app",
  "app": {
    "windows": [
      {
        "label": "launchpad",
        "title": "EMA",
        "width": 900,
        "height": 650,
        "minWidth": 700,
        "minHeight": 500,
        "decorations": false,
        "transparent": true,
        "url": "/"
      }
    ],
    "trayIcon": {
      "iconPath": "icons/tray.png",
      "tooltip": "EMA"
    }
  }
}
```

### Frontend Routing

The React app uses a route parameter to determine which app to render:
- `/` → Launchpad (with Shell, dock, tiles, command bar)
- `/brain-dump` → Brain Dump app (with app window chrome)
- `/habits` → Habits app
- `/journal` → Journal app
- `/settings` → Settings app

Each `WebviewWindow` is created with a `url` pointing to the correct route.

### Window Creation (Frontend)

```typescript
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

async function openApp(appId: string, config: WindowConfig) {
  const existing = await WebviewWindow.getByLabel(appId);
  if (existing) {
    await existing.setFocus();
    return;
  }

  new WebviewWindow(appId, {
    url: `/${appId}`,
    title: config.title,
    width: config.width,
    height: config.height,
    x: config.x,
    y: config.y,
    decorations: false,
    transparent: true,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
  });
}
```

---

## 9. Naming Migration

| Old | New |
|-----|-----|
| place-native | ema |
| place | ema |
| Place (Elixir modules) | Ema |
| PlaceWeb | EmaWeb |
| ~/.local/share/place-native/ | ~/.local/share/ema/ |
| place.db | ema.db |
| org.place.native | org.ema.app |
| place-native.service | ema.service |

---

## 10. Data Directory

`~/.local/share/ema/`
- `ema.db` — SQLite database
- `config.toml` — daemon configuration
- `logs/` — structured logs

---

## 11. Global Shortcuts

| Shortcut | Action |
|----------|--------|
| Super+Shift+C | Quick capture (Brain Dump) — works even when EMA windows are closed |
| Super+Shift+Space | Toggle Launchpad visibility |
| Ctrl+K | Search (when any EMA window is focused) |

---

## 12. Design Language

Unchanged from the original spec. All tokens, glass tiers, animation springs, and typography carry over. The only visual additions:

- **App window title bar:** 36px, glass-surface, app accent color for icon + name
- **Dock running indicators:** 6px green dot with 1px base-color border, positioned bottom-right of dock icon
- **Tile badges:** Primary-400 background, base-color text, 0.55rem, pill shape, positioned top-right of tile

---

## 13. What Changes vs. Current Codebase

### Daemon
- Rename all `Place`/`PlaceWeb` modules to `Ema`/`EmaWeb`
- Add `Ema.Workspace` context (schema, migration, REST controller, channel)
- Update data directory paths
- Update systemd service name

### Frontend
- Rename project from place-native to ema
- Replace `Shell` + page-swapping `App.tsx` with route-based rendering
- Extract shared `AppWindowChrome` component (custom title bar)
- `Launchpad` component replaces `DashboardPage` (adds greeting, tiles, dock)
- Add `window-manager.ts` module for `WebviewWindow` lifecycle
- Add `workspace-store.ts` for tracking open windows
- Update Tauri config for multi-window + tray
- Page components (BrainDumpPage, HabitsPage, etc.) stay largely unchanged — they just render inside `AppWindowChrome` instead of `Shell`

### Scripts
- Rename service, update paths
- Update dev.sh for new project name

---

## 14. Implementation Strategy

1. Rename daemon (Place → Ema) and frontend (place-native → ema)
2. Add Workspace context to daemon
3. Restructure frontend: route-based rendering, AppWindowChrome, Launchpad
4. Wire multi-window lifecycle (open/close/focus/save state)
5. Tray icon + workspace restore on startup
6. Port each app page into its own window route
7. End-to-end smoke test
