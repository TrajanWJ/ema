import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  shell,
  type Rectangle,
} from "electron";
import * as path from "path";

import { getAppRegistration, isKnownAppId, type KnownAppId } from "./windows/registry";
import { getWindowPlacement, trackWindowState } from "./windows/state";
import { startManagedRuntime, stopManagedRuntime } from "./runtime";

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:1420";
const useFileRenderer = app.isPackaged || process.env.EMA_RENDERER_MODE === "file";
const isLinux = process.platform === "linux";
const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

const PRELOAD_PATH = path.join(__dirname, "preload.js");
const RENDERER_INDEX_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "renderer", "index.html")
  : path.join(__dirname, "../../renderer/dist/index.html");

if (isLinux) {
  app.commandLine.appendSwitch("enable-transparent-visuals");
  app.disableHardwareAcceleration();
}

if (isLinux && isDev) {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}

let launchpad: BrowserWindow | null = null;
const appWindows = new Map<string, BrowserWindow>();
const windowStateCleanup = new WeakMap<BrowserWindow, () => void>();
const WINDOW_RESIZE_EDGES = [
  "top",
  "right",
  "bottom",
  "left",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
type ResizeEdge = (typeof WINDOW_RESIZE_EDGES)[number];
interface WindowResizeSession {
  edge: ResizeEdge;
  minHeight: number;
  minWidth: number;
  startBounds: Rectangle;
  startScreenX: number;
  startScreenY: number;
}
const activeResizeSessions = new WeakMap<BrowserWindow, WindowResizeSession>();

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function validateAppId(value: unknown): KnownAppId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return isKnownAppId(normalized) ? normalized : null;
}

function validateResizeEdge(value: unknown): ResizeEdge | null {
  if (typeof value !== "string") return null;
  return WINDOW_RESIZE_EDGES.includes(value as ResizeEdge) ? (value as ResizeEdge) : null;
}

function readPointerPosition(value: unknown): { screenX: number; screenY: number } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const { screenX, screenY } = value as Record<string, unknown>;
  if (typeof screenX !== "number" || typeof screenY !== "number") {
    return null;
  }

  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
    return null;
  }

  return { screenX, screenY };
}

function computeResizedBounds(
  session: WindowResizeSession,
  pointer: { screenX: number; screenY: number },
): Rectangle {
  const dx = pointer.screenX - session.startScreenX;
  const dy = pointer.screenY - session.startScreenY;

  let { x, y, width, height } = session.startBounds;

  if (session.edge.includes("left")) {
    x = session.startBounds.x + dx;
    width = session.startBounds.width - dx;
  } else if (session.edge.includes("right")) {
    width = session.startBounds.width + dx;
  }

  if (session.edge.includes("top")) {
    y = session.startBounds.y + dy;
    height = session.startBounds.height - dy;
  } else if (session.edge.includes("bottom")) {
    height = session.startBounds.height + dy;
  }

  if (width < session.minWidth) {
    if (session.edge.includes("left")) {
      x = session.startBounds.x + (session.startBounds.width - session.minWidth);
    }
    width = session.minWidth;
  }

  if (height < session.minHeight) {
    if (session.edge.includes("top")) {
      y = session.startBounds.y + (session.startBounds.height - session.minHeight);
    }
    height = session.minHeight;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function loadRenderer(
  win: BrowserWindow,
  options: {
    route?: string;
    standalone?: boolean;
  } = {},
): Promise<void> {
  const route = options.route ?? "";
  const standalone = options.standalone ?? false;

  if (isDev && !useFileRenderer) {
    const url = new URL(DEV_URL);
    url.hash = route;
    if (standalone) {
      url.searchParams.set("standalone", "1");
    }
    return win.loadURL(url.toString());
  }

  const loadOptions = {
    hash: route,
    ...(standalone ? { query: { standalone: "1" } } : {}),
  };

  return win.loadFile(RENDERER_INDEX_PATH, loadOptions);
}

function getBaseWindowOptions() {
  return {
    show: false,
    frame: false,
    transparent: true,
    hasShadow: true,
    ...(isMac ? {
      titleBarStyle: "hidden" as const,
      trafficLightPosition: { x: 18, y: 18 },
      vibrancy: "under-window" as const,
      visualEffectState: "active" as const,
    } : {}),
    ...(isWindows ? { backgroundMaterial: "mica" as const } : {}),
    thickFrame: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  } as const;
}

function attachCommonWindowBehavior(win: BrowserWindow, stateKey: string): void {
  win.removeMenu();
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(DEV_URL)) return;
    if (url.startsWith("file://")) return;
    event.preventDefault();
    void shell.openExternal(url).catch(() => {});
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("renderer process exited", {
      reason: details.reason,
      exitCode: details.exitCode,
      stateKey,
    });
  });

  const cleanup = trackWindowState(stateKey, win);
  windowStateCleanup.set(win, cleanup);
  win.on("closed", () => {
    windowStateCleanup.get(win)?.();
    windowStateCleanup.delete(win);
  });
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

  const placement = getWindowPlacement("launchpad", {
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
  });

  launchpad = new BrowserWindow({
    ...getBaseWindowOptions(),
    title: "EMA",
    width: placement.width,
    height: placement.height,
    ...(placement.x !== undefined ? { x: placement.x } : {}),
    ...(placement.y !== undefined ? { y: placement.y } : {}),
    minWidth: 700,
    minHeight: 500,
  });

  attachCommonWindowBehavior(launchpad, "launchpad");

  launchpad.once("ready-to-show", () => {
    if (!launchpad || launchpad.isDestroyed()) return;
    if (placement.isMaximized) {
      launchpad.maximize();
    }
    revealWindow(launchpad);
  });

  launchpad.on("closed", () => {
    launchpad = null;
  });

  void loadRenderer(launchpad, { route: "" }).catch((error) => {
    console.error("failed to load launchpad renderer", error);
  });
  return launchpad;
}

function createAppWindow(appId: KnownAppId): BrowserWindow {
  const existing = appWindows.get(appId);
  if (existing && !existing.isDestroyed()) {
    revealWindow(existing);
    return existing;
  }

  const registration = getAppRegistration(appId);
  const placement = getWindowPlacement(`app:${appId}`, registration);
  const win = new BrowserWindow({
    ...getBaseWindowOptions(),
    title: `EMA · ${registration.title}`,
    hasShadow: false,
    width: placement.width,
    height: placement.height,
    ...(placement.x !== undefined ? { x: placement.x } : {}),
    ...(placement.y !== undefined ? { y: placement.y } : {}),
    ...(registration.minWidth !== undefined && { minWidth: registration.minWidth }),
    ...(registration.minHeight !== undefined && { minHeight: registration.minHeight }),
  });

  attachCommonWindowBehavior(win, `app:${appId}`);

  win.once("ready-to-show", () => {
    if (placement.isMaximized) {
      win.maximize();
    }
    revealWindow(win);
  });

  win.on("closed", () => {
    appWindows.delete(appId);
  });

  void loadRenderer(win, { route: appId, standalone: true }).catch((error) => {
    console.error(`failed to load renderer for app ${appId}`, error);
  });
  appWindows.set(appId, win);
  return win;
}

function setupIPC(): void {
  ipcMain.handle("ema:open-app", (_event, rawAppId: unknown) => {
    const appId = validateAppId(rawAppId);
    if (!appId) {
      throw new Error("Invalid app id");
    }
    createAppWindow(appId);
  });

  ipcMain.handle("ema:close-app", (_event, rawAppId: unknown) => {
    const appId = validateAppId(rawAppId);
    if (!appId) {
      return;
    }
    const win = appWindows.get(appId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });

  ipcMain.handle("ema:window-resize-start", (event, payload: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) {
      return false;
    }

    if (!win.isResizable()) {
      return false;
    }

    if (!payload || typeof payload !== "object") {
      return false;
    }

    const { edge: rawEdge, ...rawPointer } = payload as Record<string, unknown>;
    const edge = validateResizeEdge(rawEdge);
    const pointer = readPointerPosition(rawPointer);
    if (!edge || !pointer) {
      return false;
    }

    const [minWidth = 0, minHeight = 0] = win.getMinimumSize();
    activeResizeSessions.set(win, {
      edge,
      minHeight: Math.max(minHeight, 220),
      minWidth: Math.max(minWidth, 320),
      startBounds: win.getBounds(),
      startScreenX: pointer.screenX,
      startScreenY: pointer.screenY,
    });
    return true;
  });

  ipcMain.on("ema:window-resize-update", (event, payload: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) {
      return;
    }

    const session = activeResizeSessions.get(win);
    const pointer = readPointerPosition(payload);
    if (!session || !pointer) {
      return;
    }

    win.setBounds(computeResizedBounds(session, pointer));
  });

  ipcMain.on("ema:window-resize-end", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    activeResizeSessions.delete(win);
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
  const brainDumpRegistered = globalShortcut.register("CommandOrControl+Shift+C", () => {
    revealWindow(createAppWindow("brain-dump"));
  });
  if (!brainDumpRegistered) {
    console.warn("failed to register shortcut CommandOrControl+Shift+C");
  }

  const launchpadRegistered = globalShortcut.register("CommandOrControl+Shift+Space", () => {
    const win = createLaunchpad();
    revealWindow(win);
    win.webContents.send("ema:navigate", "command-palette");
  });
  if (!launchpadRegistered) {
    console.warn("failed to register shortcut CommandOrControl+Shift+Space");
  }
}

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    app.setAppUserModelId("com.ema.desktop");
    await startManagedRuntime();
    setupIPC();
    registerShortcuts();
    createLaunchpad();
  });

  app.on("second-instance", () => {
    const win = createLaunchpad();
    revealWindow(win);
  });
}

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
