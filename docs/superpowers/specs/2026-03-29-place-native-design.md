# place-native — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Stack:** Tauri 2 + React 19 + TypeScript + Tailwind v4 + Zustand + Motion | Elixir Phoenix + Ecto + exqlite
**Target:** KDE Neon (Ubuntu 24.04), Plasma 6.6, Wayland

---

## 1. Architecture

Elixir daemon (persistent, systemd user service) + Tauri shell (native window, system tray).

```
                    ┌─────────────────────────────────┐
                    │         KDE Autostart            │
                    └──────┬──────────┬────────────────┘
                           │          │
              systemd user unit    .desktop entry
                           │          │
                           ▼          ▼
              ┌────────────────┐  ┌──────────────────┐
              │  Elixir Daemon │  │   Tauri Shell     │
              │  (Phoenix)     │  │   (React/TS)      │
              │  Port 4488     │◄─┤   WebSocket +     │
              │                │  │   REST             │
              └───────┬────────┘  └──────────────────┘
                      │
         ┌────────────┼─────────────┐
         ▼            ▼             ▼
    ┌─────────┐  ┌─────────┐  ┌──────────┐
    │ SQLite  │  │ Vault   │  │ Future:  │
    │ (local) │  │ Watcher │  │ Claude   │
    │         │  │ (fswatch)│  │ Agent    │
    └─────────┘  └─────────┘  └──────────┘
```

**Data location:** `~/.local/share/place-native/`
- `place.db` — SQLite database
- `config.toml` — daemon configuration
- `logs/` — structured logs

---

## 2. Apps — V1 (Fully Built)

### 2.1 Executive Dashboard (Central Hub)

Home screen. Opens on launch. Single-surface command center.

**Layout:** Full-window, no chrome. Three zones:

```
┌─────────────────────────────────────────────────────────┐
│  ░░ Ambient Strip ░░░░░░░░░░░░░░░░░░░░░░░░░░░ 32px ░░  │
├───────────┬─────────────────────────────────────────────┤
│           │                                             │
│  Sidebar  │           Main Canvas                       │
│  56px     │                                             │
│  icons    │   Cards in responsive grid                  │
│  only     │                                             │
│           │   ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  ● dash   │   │ One     │ │ Habits  │ │ Brain   │     │
│  ● brain  │   │ Thing   │ │ Today   │ │ Dump    │     │
│  ● habits │   │         │ │         │ │ Queue   │     │
│  ● journal│   └─────────┘ └─────────┘ └─────────┘     │
│  ● ···    │   ┌─────────┐ ┌───────────────────┐       │
│           │   │ Mood +  │ │ Journal Preview   │       │
│  ─────    │   │ Energy  │ │                   │       │
│  ● (gear) │   │         │ │                   │       │
│           │   └─────────┘ └───────────────────┘       │
├───────────┴─────────────────────────────────────────────┤
│  ░░ Command Bar ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 40px ░░  │
└─────────────────────────────────────────────────────────┘
```

**Ambient Strip (32px):**
- Left: "place" in secondary-400, 600 weight, 0.65rem
- Center: Clock (time + date), text-muted
- Right: System sparklines (CPU/RAM, 40x12px), notification bell, tray dot

**Sidebar (56px, icons only):**
- Vertical icon rail, glass-surface background
- Icons: 20x20, text-tertiary, hover → text-primary + glow
- Active: left 2px accent border, icon primary-400
- Bottom: settings gear, separated by divider
- Tooltip on hover (200ms delay)

**Command Bar (40px):**
- Glass-ambient background
- Left: search input "Search everything..." with Ctrl+K hint
- Right: quick action buttons (+capture, +journal, focus mode)
- Searches across all app data

**Dashboard Cards (shared shell):**
```
Glass: rgba(14, 16, 23, 0.55), blur 20px, saturate 150%
Border: 1px solid rgba(255,255,255, 0.06)
Radius: 12px
Hover: border → 0.10 opacity, translateY(-1px), shadow expand
Header: 0.6rem, tertiary text, arrow → opens full app
```

**Card: One Thing** — single line, 1.1rem, editable inline, tertiary-400 left accent bar
**Card: Habits Today** — habit list with colored checkboxes, streak counts, progress bar
**Card: Brain Dump Queue** — last 5 items, quick actions on hover, mini capture input, count badge
**Card: Mood + Energy** — 5 mood circles + 3 energy bars, today's values, editable
**Card: Journal Preview** — today's entry preview (~150 chars), click to open
**Card: Quick Links** — 2x2 action buttons (New Capture, Journal, Vault Search, Settings)

Cards reflow: 3-col wide, 2-col narrow, 1-col small. Masonry layout.

**Backend:** WebSocket `dashboard:lobby` pushes full snapshot on connect, deltas on mutations. REST fallback `GET /api/dashboard/today`.

---

### 2.2 Brain Dump

Two views: Queue (default) and Kanban. Segmented control toggle.

**Capture Input:**
- Text field + submit
- Global shortcut: `Super+Shift+C` (Tauri global shortcut → daemon → creates item)
- Floating mini-input when app in tray (small borderless Tauri window, auto-dismiss after capture)
- Source tracking: "text", "shortcut", "clipboard"

**Queue View:**
- Scrollable list, newest first
- Per item: content, relative timestamp (text-muted, 0.6rem)
- Action row (hover): → Task (primary), → Note (secondary), → Journal (tertiary), Archive (tertiary text), ✕ (error)
- Empty state: icon + "Your mind is clear" + shortcut hint
- Animations: enter top (y -8, 200ms), exit right (x 20, 200ms)

**Kanban View:**
- 3 columns: INBOX → PROCESSING → DONE
- Drag-and-drop between columns
- Compact cards (80 char), quick actions
- Column headers with count badges
- Dashed border on drag-over

**Backend:**
- Context: `Place.BrainDump`
- Table: `inbox_items` (id, content, source, processed, action, timestamps)
- Channel: `brain_dump:queue`
- REST: CRUD on `/api/brain-dump/items`

---

### 2.3 Habits

Four tabs: Today | Week | Month | Streaks

**Today:** Habit rows with colored checkboxes, name, target, streak (🔥 N), 30-day StreakGrid. Add form (name, frequency daily/weekly, target, auto-color). Max 7 habits. Milestone celebrations at 7/30/100 days.

**Week:** 7-column grid (Mon-Sun), per-habit rows, colored squares, today highlighted, prev/next navigation.

**Month:** Calendar grid (6x7), colored dots per completed habit, today border, month navigation.

**Streaks:** Card per habit sorted by streak. Stats: current, longest, rate %, total. Visual bar (current vs longest).

**Backend:**
- Context: `Place.Habits`
- Tables: `habits` (id, name, frequency, target, active, sort_order, color, timestamps), `habit_logs` (id, habit_id, date, completed, notes, timestamps)
- Channel: `habits:tracker`
- REST: CRUD habits, `POST /api/habits/:id/toggle`
- Server-side streak calculation

---

### 2.4 Journal

**Layout:** CalendarStrip → One Thing → Editor → Mood/Energy

**CalendarStrip:** Week view (7 days), prev/next arrows, Today jump button, date label, indicator dots on dates with entries.

**One Thing Input:** Single-line, label adapts to date context, debounced 800ms.

**Editor:** Three modes (Edit/Preview/Split), markdown, monospace edit, sans-serif preview, synced scroll in split, debounced 600ms, template on new entry.

**Mood Picker:** 5 circles (1=Rough/red → 5=Great/green), immediate save.

**Energy Tracker:** 3 sliders 1-10 (Physical/green, Mental/blue, Emotional/amber), debounced 400ms.

**Cross-app:** Brain Dump "→ Journal" appends `[HH:MM] {text}`. Dashboard shows preview.

**Backend:**
- Context: `Place.Journal`
- Table: `journal_entries` (id, date UNIQUE, content, one_thing, mood, energy_p/m/e, gratitude, tags, timestamps)
- Channel: `journal:today`
- REST: `GET/PUT /api/journal/:date`, `GET /api/journal/search?q=`
- Full-text search on content + one_thing

---

### 2.5 Settings

Sidebar page.

**Sections:** Appearance (color mode, accent, glass, font), Startup (launch on boot, start minimized), Shortcuts (global bindings), Notifications (enable, DND), Data (export/import/clear), About (version, daemon status).

**Backend:** `settings` table (key-value), channel `settings:sync`.

---

## 3. Scaffolded Future Apps (Backend Contexts + Schemas Only)

### 3.1 Tasks
- Context: `Place.Tasks`, table: `tasks` (id, title, description, status, priority, due_date, goal_id)
- Statuses: todo | in_progress | done | archived

### 3.2 Goals
- Context: `Place.Goals`, table: `goals` (id, title, description, timeframe, status, parent_id)
- Timeframes: weekly | monthly | quarterly | yearly | 3year

### 3.3 Focus Timer
- Context: `Place.Focus`, tables: `focus_sessions`, `focus_blocks`

### 3.4 Notes
- Context: `Place.Notes`, table: `notes` (id, title, content, source_type, source_id)

### 3.5 Vault Bridge
- Context: `Place.Vault`
- FileSystem watcher on `~/Documents/obsidian_first_stuff/twj1/`
- Table: `vault_index` (path, title, tags, modified_at) — read-only index
- REST: `GET /api/vault/search?q=`, `GET /api/vault/file?path=`

### 3.6 App Launcher
- Context: `Place.AppLauncher`
- Table: `app_shortcuts` (id, name, exec_command, icon_path, category, sort_order)
- Scans .desktop files, launches via xdg-open

### 3.7 System Monitor
- Context: `Place.System`
- No schema, live data from /proc/
- Channel: `system:metrics` (2s interval)

### 3.8 Claude Sessions
- Context: `Place.Claude`
- Watches `~/.claude/projects/` for session data
- Table: `claude_sessions` (id, project_path, started_at, last_active, summary, token_count, status)

### 3.9 Agent Dispatch
- Context: `Place.Agents`
- Tables: `agent_runs`, `agent_templates`
- DynamicSupervisor for agent processes

### 3.10 Context Bridge
- Context: `Place.ContextBridge`
- REST: `GET /api/context/executive-summary` — structured JSON of current state for LLM consumption
- Future: MCP server tool

---

## 4. Design Language

### Tokens
```
Surfaces: #060610 (void) → #08090E (base) → #0E1017 (surface-1) → #141620 (surface-2) → #1A1D2A (surface-3)
Text: rgba(255,255,255) at 0.87 / 0.60 / 0.40 / 0.25
Primary (teal): #0D9373 (500) → #2DD4A8 (400)
Secondary (blue): #4B7BE5 (500) → #6B95F0 (400)
Tertiary (amber): #D97706 (500) → #F59E0B (400)
Error: #E24B4A, Success: #22C55E, Warning: #EAB308
Borders: rgba(255,255,255) at 0.04 / 0.08 / 0.15
```

### Glass Tiers
```
ambient:   rgba(14,16,23, 0.40), blur 6px,  saturate 120%
surface:   rgba(14,16,23, 0.55), blur 20px, saturate 150%
elevated:  rgba(14,16,23, 0.65), blur 28px, saturate 180%
```

### Animation
```
Springs: default (300/25), snappy (500/30), gentle (200/20), bouncy (400/15)
Mount: opacity 0→1, scale 0.95→1, 150ms
Exit: opacity 1→0, scale 1→0.95, 100ms
Hover: translateY(-1px), border brighten, 100ms
Easing: cubic-bezier(0.65, 0.05, 0, 1)
Reduced motion: respect prefers-reduced-motion
```

### Typography
```
Sans: system-ui, -apple-system, "Segoe UI", sans-serif
Mono: "JetBrains Mono", "Cascadia Code", "Fira Code", ui-monospace
Headers: 600 weight, text-primary
Body: 400 weight, text-secondary
Labels: 0.6-0.7rem, uppercase, letter-spacing 0.05em, text-tertiary
```

### Component Conventions
- Radius: 12px cards, 8px inputs, 4px small
- Touch targets: min 44x44px
- Cards: glass-surface, 1px border-default, 12px radius
- Inputs: surface-3 background, border-default, 8px radius
- Buttons: glass-ambient or accent fill, 8px radius

---

## 5. File Structure

```
place-native/
├── daemon/                          # Elixir Phoenix
│   ├── lib/place/                   # Domain contexts
│   │   ├── application.ex
│   │   ├── repo.ex
│   │   ├── brain_dump/
│   │   ├── habits/
│   │   ├── journal/
│   │   ├── settings/
│   │   ├── tasks/          (scaffold)
│   │   ├── goals/          (scaffold)
│   │   ├── focus/          (scaffold)
│   │   ├── notes/          (scaffold)
│   │   ├── vault/          (scaffold)
│   │   ├── claude/         (scaffold)
│   │   ├── agents/         (scaffold)
│   │   ├── context_bridge/ (scaffold)
│   │   ├── app_launcher/   (scaffold)
│   │   └── system/         (scaffold)
│   ├── lib/place_web/
│   │   ├── endpoint.ex
│   │   ├── router.ex
│   │   ├── channels/
│   │   └── controllers/
│   ├── priv/repo/migrations/
│   ├── config/
│   └── mix.exs
├── app/                             # Tauri + React
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/      (Shell, AmbientStrip, Sidebar, CommandBar)
│   │   │   ├── dashboard/   (DashboardPage + 6 cards)
│   │   │   ├── brain-dump/  (BrainDumpPage, CaptureInput, InboxQueue, InboxItem, KanbanView)
│   │   │   ├── habits/      (HabitsPage, HabitRow, AddHabitForm, StreakGrid, WeekView, MonthView, StreaksView)
│   │   │   ├── journal/     (JournalPage, CalendarStrip, OneThingInput, JournalEditor, MoodPicker, EnergyTracker)
│   │   │   ├── settings/    (SettingsPage)
│   │   │   └── ui/          (GlassCard, SegmentedControl, Badge, Tooltip)
│   │   ├── stores/          (dashboard, brain-dump, habits, journal, settings)
│   │   ├── lib/             (ws, api, date-utils, springs)
│   │   └── types/
│   ├── src-tauri/
│   │   ├── src/main.rs
│   │   ├── tauri.conf.json
│   │   └── Cargo.toml
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── scripts/
│   ├── install.sh
│   ├── dev.sh
│   └── place-native.service
└── docs/
```

---

## 6. Startup Flow

1. systemd user service starts Elixir daemon → migrations → SQLite → supervision tree → binds localhost:4488
2. KDE autostart .desktop → launches Tauri binary → window + tray
3. React mounts → WebSocket connects → dashboard snapshot loads → ready (<2s)

**Tray:** Left-click toggle window, right-click menu (Show, Quick Capture, Quit)
**Global shortcuts:** Super+Shift+C (capture), Super+Shift+Space (toggle), Ctrl+K (search when focused)

---

## 7. Implementation Strategy

Use Kiro-style three-file spec pattern. Each implementation step is self-contained with its own context. Parallel agent execution for independent modules. Test at boundaries. Ship incrementally — daemon first, then frontend pages one at a time.
