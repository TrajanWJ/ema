# place.org Companion

A lightweight desktop companion for [place.org](https://place.org) that enables virtual desktop apps to pop out as truly transparent, frameless native windows on your real desktop.

## How It Works

1. Install the companion — it runs as a system tray icon (~5 MB, ~50 MB idle RAM)
2. Open place.org in any browser — the site detects the companion automatically
3. Drag any virtual window past the browser edge — it becomes a transparent native window
4. Click "Desktop" in the native window to return it to the virtual desktop

The companion is **completely optional** — place.org works fully without it, using standard browser popups as fallback.

## Install

### Windows 10/11

1. Download `place-companion_x64-setup.exe` from [Releases](https://github.com/TrajanWJ/place-companion/releases)
2. Run the installer — if SmartScreen appears, click "More info" → "Run anyway"
3. A system tray icon appears (click ^ in the taskbar to find it)
4. Auto-starts on boot

**Notes:**
- Windows Firewall may prompt for network access — allow it (localhost only, no internet)
- Windows Defender may briefly flag the installer — this is normal for new open-source apps

### macOS

1. Download `place-companion_aarch64.dmg` (Apple Silicon) or `_x64.dmg` (Intel) from [Releases](https://github.com/TrajanWJ/place-companion/releases)
2. Open the DMG, drag to Applications
3. First launch:
   - **macOS Sequoia (15+):** System Settings → Privacy & Security → scroll down → "Open Anyway"
   - **Older macOS:** Right-click the app → "Open" → "Open" again
4. Menu bar icon appears — no dock icon (pure background app)
5. Auto-starts on boot via LaunchAgent

### Linux

1. Download `place-companion_amd64.AppImage` from [Releases](https://github.com/TrajanWJ/place-companion/releases)
2. `chmod +x place-companion_*.AppImage && ./place-companion_*.AppImage`
3. System tray icon appears
4. Add to startup applications in your desktop settings

**Requirements:**
- WebKitGTK 4.1 (Ubuntu 22.04+, Fedora 36+, Arch)
- **GNOME:** Install the [AppIndicator extension](https://extensions.gnome.org/extension/615/appindicator-support/) for tray icon
- **Transparency:** Requires a compositor (KWin, Mutter, picom)
- **Wayland:** Supported on GNOME and KDE

## Architecture

```
src-tauri/src/
  main.rs           App entry, system tray, platform-specific fixes
  ws_server.rs      WebSocket server on localhost:27182-27189
  protocol.rs       Message types (serde JSON)
  window_mgr.rs     Transparent webview window lifecycle
  commands.rs       Tauri IPC commands (reattach)
  origin_check.rs   WebSocket origin validation
```

### Platform Behavior

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Transparency | WebView2 + DWM | wry + objc2 NSWindow fix | X11 compositor / Wayland |
| Window drag | `data-tauri-drag-region` | `data-tauri-drag-region` | `start_dragging` IPC |
| System tray | Notification area | Menu bar (no dock icon) | AppIndicator / SNI |
| Auto-start | Registry | LaunchAgent | XDG .desktop |

### Security

- **Network:** Localhost only. Never connects to the internet.
- **Origin checking:** WebSocket connections validated against allowlist.
- **URL validation:** Only opens webviews for place.org and localhost dev servers.
- **Open source:** MIT license.

## Development

```bash
pnpm install
pnpm tauri dev      # development
pnpm tauri build    # production
```

### Release

```bash
git tag v0.2.0 && git push --tags
# GitHub Actions builds all platforms → draft release
```

## License

MIT
