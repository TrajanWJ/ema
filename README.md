# place.org Companion

A lightweight desktop companion for [place.org](https://place.org) that enables virtual desktop apps to pop out as truly transparent, frameless native windows on your real desktop.

## How It Works

1. The companion runs as a system tray icon
2. It listens for commands from place.org via a local WebSocket server
3. When you drag a virtual window outside the browser, the companion spawns a transparent native window
4. The window loads the same app content — but without browser chrome, URL bars, or opaque backgrounds

## Requirements

- **Windows 10/11**, **macOS 12+**, or **Linux** (X11 with compositor, or Wayland)
- Any modern browser (Chrome, Firefox, Safari, Edge)
- place.org running in the browser

## Install

### Windows

1. Download `place-companion_x.x.x_x64-setup.exe` from [Releases](https://github.com/trajan/place-companion/releases)
2. Run the installer
3. Windows SmartScreen may warn about an unsigned app — click "More info" → "Run anyway"
4. The companion starts automatically and appears in your system tray
5. **Firewall:** Windows may ask to allow network access — this is the local WebSocket server (localhost only, no internet access)

### macOS

1. Download `place-companion_x.x.x_aarch64.dmg` from [Releases](https://github.com/trajan/place-companion/releases)
2. Open the DMG and drag to Applications
3. On first launch, macOS Gatekeeper may block it — right-click the app → "Open" → "Open" again
4. The companion appears in your menu bar
5. **Note:** macOS transparency in release builds has a known upstream issue. The app will use a dark opaque background as fallback.

### Linux

1. Download `place-companion_x.x.x_amd64.AppImage` from [Releases](https://github.com/trajan/place-companion/releases)
2. Make it executable: `chmod +x place-companion_*.AppImage`
3. Run it: `./place-companion_*.AppImage`
4. The companion appears in your system tray
5. **X11 without compositor:** Transparency requires a compositor (picom, compiz, etc.). Without one, windows use a dark opaque background.

## Development

### Prerequisites

- Rust 1.77.2+ (`rustup default stable`)
- Node.js 18+ with pnpm
- Platform-specific deps: see [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Build

```bash
pnpm install
pnpm tauri dev      # development mode
pnpm tauri build    # production build
```

### Architecture

```
src-tauri/src/
  main.rs           # app entry, tray, plugin registration
  ws_server.rs      # WebSocket server on localhost:27182-27189
  protocol.rs       # message types (serde)
  window_mgr.rs     # transparent webview window lifecycle
  commands.rs       # Tauri IPC (reattach from webview)
  origin_check.rs   # WebSocket origin validation
```

### WebSocket Protocol

The companion listens on the first available port in 27182–27189. Browser discovers it by trying each port.

See `docs/superpowers/specs/2026-03-24-companion-app-design.md` in the place.org repo for the full protocol spec.

## License

MIT
