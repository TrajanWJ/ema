import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
} from "electron";
import * as path from "path";

import { APP_WINDOW_DEFAULTS } from "./windows/config";
import { startManagedRuntime, stopManagedRuntime } from "./runtime";

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:1420";
const useFileRenderer = app.isPackaged || process.env.EMA_RENDERER_MODE === "file";
const useTransparentWindows = process.platform !== "linux";
const useFramelessWindows = process.platform !== "linux";

const PRELOAD_PATH = path.join(__dirname, "preload.js");
const RENDERER_INDEX_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "renderer", "index.html")
  : path.join(__dirname, "../../renderer/dist/index.html");

if (process.platform === "linux" && isDev) {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}

let launchpad: BrowserWindow | null = null;
const appWindows = new Map<string, BrowserWindow>();

function loadRenderer(win: BrowserWindow, route = ""): void {
  if (isDev && !useFileRenderer) {
    void win.loadURL(`${DEV_URL}/${route}`);
    return;
  }

  void win.loadFile(RENDERER_INDEX_PATH, {
    hash: route,
  });
}

function getBaseWindowOptions() {
  return {
    show: false,
    frame: !useFramelessWindows,
    transparent: useTransparentWindows,
    backgroundColor: useTransparentWindows ? "#00000000" : "#0b1020",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  } as const;
}

function revealWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;

  win.show();
  if (win.isMinimized()) {
    win.restore();
  }
  win.focus();
  win.moveTop();
}

function createLaunchpad(): BrowserWindow {
  if (launchpad && !launchpad.isDestroyed()) {
    revealWindow(launchpad);
    return launchpad;
  }

  launchpad = new BrowserWindow({
    ...getBaseWindowOptions(),
    title: "EMA",
    width: 900,
    height: 650,
  });

  launchpad.once("ready-to-show", () => {
    if (!launchpad || launchpad.isDestroyed()) return;
    revealWindow(launchpad);
  });

  launchpad.on("closed", () => {
    launchpad = null;
  });

  loadRenderer(launchpad);
  return launchpad;
}

function createAppWindow(appId: string): BrowserWindow {
  const existing = appWindows.get(appId);
  if (existing && !existing.isDestroyed()) {
    revealWindow(existing);
    return existing;
  }

  const defaults = APP_WINDOW_DEFAULTS.standard;
  const win = new BrowserWindow({
    ...getBaseWindowOptions(),
    title: `EMA · ${appId}`,
    width: defaults.width,
    height: defaults.height,
    ...(defaults.minWidth !== undefined && { minWidth: defaults.minWidth }),
    ...(defaults.minHeight !== undefined && { minHeight: defaults.minHeight }),
  });

  win.once("ready-to-show", () => {
    revealWindow(win);
  });

  win.on("closed", () => {
    appWindows.delete(appId);
  });

  loadRenderer(win, appId);
  appWindows.set(appId, win);
  return win;
}

function setupIPC(): void {
  ipcMain.handle("ema:open-app", (_event, appId: string) => {
    createAppWindow(appId);
  });

  ipcMain.handle("ema:close-app", (_event, appId: string) => {
    const win = appWindows.get(appId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });

  ipcMain.on("ema:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on("ema:maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.on("ema:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

function registerShortcuts(): void {
  globalShortcut.register("Super+Shift+C", () => {
    revealWindow(createAppWindow("brain-dump"));
  });

  globalShortcut.register("Super+Shift+Space", () => {
    const win = createLaunchpad();
    revealWindow(win);
    win.webContents.send("ema:navigate", "command-palette");
  });
}

app.whenReady().then(async () => {
  await startManagedRuntime();
  setupIPC();
  registerShortcuts();
  createLaunchpad();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLaunchpad();
    return;
  }

  if (launchpad && !launchpad.isDestroyed()) {
    revealWindow(launchpad);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  void stopManagedRuntime();
});
