# EMA Frontend

React 19 + TypeScript + Tauri 2 frontend for EMA.

**Dev server:** `localhost:1420` (HMR on 1421)
**Daemon connection:** `http://localhost:4488/api` (REST) + `ws://localhost:4488/socket` (WebSocket)

## Quick Start

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build (production)
npx tauri dev      # Full desktop app with hot reload
```

## Architecture

```
src/
  ├── App.tsx               # Route switch — maps app IDs to components
  ├── components/
  │   ├── layout/
  │   │   ├── Shell.tsx     # Main wrapper, loads all stores on mount
  │   │   ├── Dock.tsx      # Vertical app launcher
  │   │   ├── Launchpad.tsx # Home dashboard with app tiles
  │   │   └── AmbientStrip.tsx  # Custom titlebar
  │   ├── executions/       # Execution tracking (HQ surface)
  │   ├── proposals/        # Proposal pipeline UI
  │   ├── tasks/            # Task management
  │   ├── agents/           # Agent fleet + chat
  │   └── ...               # 50+ app components
  ├── stores/               # 60+ Zustand stores
  ├── lib/
  │   ├── api.ts            # REST client (Tauri HTTP plugin, fallback fetch)
  │   └── ws.ts             # Phoenix WebSocket singleton
  ├── types/                # TypeScript interfaces
  │   └── workspace.ts      # APP_CONFIGS — app metadata, dimensions, accents
  └── styles/
      └── globals.css       # Glass morphism design system
```

## Store Pattern

Every store follows the same contract:
1. `loadViaRest()` — fetch initial state via REST
2. `connect()` — join Phoenix WebSocket channel for real-time updates
3. Domain-specific actions (CRUD, transitions)

```typescript
export const useXxxStore = create<XxxState>((set) => ({
  items: [],
  async loadViaRest() {
    const data = await api.get<{ items: Item[] }>('/xxx');
    set({ items: data.items });
  },
  async connect() {
    const { channel } = await joinChannel('xxx:lobby');
    channel.on('item_created', (item) => set(s => ({ items: [item, ...s.items] })));
  },
}));
```

## Design System

Glass morphism on dark void backgrounds:
- **Void:** `#060610` — page background
- **Surfaces:** `rgba(14,16,23, 0.40/0.55/0.65)` with `backdrop-filter: blur()`
- **Text:** primary 0.87 opacity, secondary 0.60, tertiary 0.40
- **Accents:** teal `#2DD4A8`, blue `#6B95F0`, amber `#F59E0B`
- **Fonts:** system-ui (sans), JetBrains Mono (mono)

## Tauri Integration

- `ensure_daemon()` — spawns Phoenix daemon if not running
- `check_daemon()` — checks daemon reachability on :4488
- Tauri HTTP plugin bypasses CORS for daemon API calls
- Desktop windows: Launchpad (main) + Jarvis Orb (floating)
