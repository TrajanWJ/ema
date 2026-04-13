/**
 * Global keyboard shortcuts.
 *
 * Registers system-wide hotkeys via Electron's globalShortcut API.
 * Under Tauri, shortcuts are handled in Rust instead.
 */

import { createRequire } from "node:module";

export interface ShortcutHandlers {
  onBrainDump: () => void;
  onCommandPalette: () => void;
}

interface GlobalShortcutAPI {
  register(accelerator: string, callback: () => void): boolean;
  unregisterAll(): void;
}

const require = createRequire(import.meta.url);

function getGlobalShortcut(): GlobalShortcutAPI | null {
  try {
    const electron = require("electron") as {
      globalShortcut: GlobalShortcutAPI;
    };
    return electron.globalShortcut;
  } catch {
    return null;
  }
}

const SHORTCUTS = {
  brainDump: "Super+Shift+C",
  commandPalette: "Super+Shift+Space",
} as const;

export function registerShortcuts(handlers: ShortcutHandlers): boolean {
  const gs = getGlobalShortcut();
  if (!gs) {
    console.warn("[shortcuts] Electron not available — skipping global shortcuts");
    return false;
  }

  const dumpOk = gs.register(SHORTCUTS.brainDump, handlers.onBrainDump);
  if (!dumpOk) {
    console.warn(`[shortcuts] Failed to register ${SHORTCUTS.brainDump}`);
  }

  const paletteOk = gs.register(SHORTCUTS.commandPalette, handlers.onCommandPalette);
  if (!paletteOk) {
    console.warn(`[shortcuts] Failed to register ${SHORTCUTS.commandPalette}`);
  }

  return dumpOk && paletteOk;
}

export function unregisterShortcuts(): void {
  const gs = getGlobalShortcut();
  gs?.unregisterAll();
}
