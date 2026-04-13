/**
 * Login item / autostart management.
 *
 * Sets or clears the app as a login item so it starts on boot.
 * Electron: uses app.setLoginItemSettings()
 * Tauri: would use platform-specific autostart plugin
 */

import { createRequire } from "node:module";

interface LoginItemSettings {
  openAtLogin: boolean;
  openAsHidden?: boolean;
}

interface ElectronApp {
  setLoginItemSettings(settings: LoginItemSettings): void;
  getLoginItemSettings(): LoginItemSettings;
  getName(): string;
}

const require = createRequire(import.meta.url);

function getApp(): ElectronApp | null {
  try {
    const electron = require("electron") as { app: ElectronApp };
    return electron.app;
  } catch {
    return null;
  }
}

export function setAutostart(enabled: boolean): boolean {
  const app = getApp();
  if (!app) {
    console.warn("[autostart] Electron not available — cannot set login item");
    return false;
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
  });

  console.log(`[autostart] ${app.getName()} login item ${enabled ? "enabled" : "disabled"}`);
  return true;
}

export function getAutostart(): boolean {
  const app = getApp();
  if (!app) return false;

  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
}
