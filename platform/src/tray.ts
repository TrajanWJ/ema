/**
 * System tray integration.
 *
 * This module targets Electron's Tray API. When running under Tauri,
 * tray setup is handled in Rust (src-tauri/src/tray.rs) instead.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

interface TrayMenuItem {
  label: string;
  click?: () => void;
}

interface TrayMenuSeparator {
  type: "separator";
}

type TrayMenu = TrayMenuItem | TrayMenuSeparator;

interface BrowserWindow {
  show(): void;
  focus(): void;
  isDestroyed(): boolean;
}

interface TrayInstance {
  setContextMenu(menu: unknown): void;
  setToolTip(tip: string): void;
  destroy(): void;
}

const require = createRequire(import.meta.url);
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

// Lazy-loaded to avoid crashes when Electron is not available
function getElectron(): {
  Tray: new (iconPath: string) => TrayInstance;
  Menu: { buildFromTemplate(items: TrayMenu[]): unknown };
  app: { quit(): void };
} | null {
  try {
    // Dynamic require — Electron must be the host process
    return require("electron") as ReturnType<typeof getElectron>;
  } catch {
    return null;
  }
}

export function createTray(mainWindow: BrowserWindow): TrayInstance | null {
  const electron = getElectron();
  if (!electron) {
    console.warn("[tray] Electron not available — skipping tray setup");
    return null;
  }

  const iconPath = join(MODULE_DIR, "../../assets/icon.png");
  const tray = new electron.Tray(iconPath);

  const menuItems: TrayMenu[] = [
    {
      label: "Show Launchpad",
      click: () => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        electron.app.quit();
      },
    },
  ];

  const contextMenu = electron.Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
  tray.setToolTip("EMA — Executive Management Assistant");

  return tray;
}
