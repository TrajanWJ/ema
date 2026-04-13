import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  globalShortcut,
} from "electron";
import * as path from "path";
import { APP_WINDOW_DEFAULTS } from "./windows/config";
import { startManagedRuntime, stopManagedRuntime } from "./runtime";

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:1420";
const PRELOAD_PATH = path.join(__dirname, "preload.js");
const RENDERER_INDEX_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "renderer", "index.html")
  : path.join(__dirname, "../../renderer/dist/index.html");
const TRAY_ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "assets", "icons", "ema-32.png")
  : path.join(__dirname, "../../../assets/icons/ema-32.png");

let launchpad: BrowserWindow | null = null;
let tray: Tray | null = null;
const appWindows = new Map<string, BrowserWindow>();

function loadURL(win: BrowserWindow, urlPath = "") {
  if (isDev) {
    win.loadURL(`${DEV_URL}/${urlPath}`);
  } else {
    win.loadFile(RENDERER_INDEX_PATH, {
      hash: urlPath,
    });
  }
}

function createLaunchpad(): BrowserWindow {
  launchpad = new BrowserWindow({
    width: 900,
    height: 650,
    transparent: true,
    frame: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadURL(launchpad);

  launchpad.on("close", (e) => {
    e.preventDefault();
    launchpad?.hide();
  });

  return launchpad;
}

function createAppWindow(appId: string): BrowserWindow {
  const existing = appWindows.get(appId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }

  const defaults = APP_WINDOW_DEFAULTS.standard;

  const win = new BrowserWindow({
    width: defaults.width,
    height: defaults.height,
    ...(defaults.minWidth !== undefined && { minWidth: defaults.minWidth }),
    ...(defaults.minHeight !== undefined && { minHeight: defaults.minHeight }),
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadURL(win, appId);

  appWindows.set(appId, win);
  win.on("closed", () => appWindows.delete(appId));

  return win;
}

function createTray() {
  const icon = nativeImage.createFromPath(TRAY_ICON_PATH);
  tray = new Tray(icon);
  tray.setToolTip("EMA");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Launchpad",
      click: () => {
        launchpad?.show();
        launchpad?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit EMA",
      click: () => {
        launchpad?.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    launchpad?.show();
    launchpad?.focus();
  });
}

function registerShortcuts() {
  globalShortcut.register("Super+Shift+C", () => {
    const win = createAppWindow("brain-dump");
    win.show();
    win.focus();
  });

  globalShortcut.register("Super+Shift+Space", () => {
    launchpad?.show();
    launchpad?.focus();
    launchpad?.webContents.send("ema:navigate", "command-palette");
  });
}

function setupIPC() {
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
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });

  ipcMain.on("ema:close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win === launchpad) {
      win.hide();
    } else {
      win.close();
    }
  });
}

app.whenReady().then(async () => {
  await startManagedRuntime();
  setupIPC();
  createLaunchpad();
  createTray();
  registerShortcuts();
});

app.on("window-all-closed", () => {
  // Don't quit — tray app stays alive
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  void stopManagedRuntime();
});
