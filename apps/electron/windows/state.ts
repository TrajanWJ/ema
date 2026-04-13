import { app, screen, type BrowserWindow, type Rectangle } from "electron";
import fs from "node:fs";
import path from "node:path";

type PersistedWindowState = {
  readonly x?: number;
  readonly y?: number;
  readonly width: number;
  readonly height: number;
  readonly isMaximized: boolean;
};

type WindowStateStore = Record<string, PersistedWindowState>;

type WindowFallback = {
  readonly width: number;
  readonly height: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
};

type WindowPlacement = PersistedWindowState & {
  readonly x?: number;
  readonly y?: number;
};

const STATE_FILE_NAME = "window-state.json";
const SAVE_DEBOUNCE_MS = 180;

function stateFilePath(): string {
  return path.join(app.getPath("userData"), STATE_FILE_NAME);
}

function readStateStore(): WindowStateStore {
  try {
    const raw = fs.readFileSync(stateFilePath(), "utf8");
    const parsed = JSON.parse(raw) as WindowStateStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStateStore(store: WindowStateStore): void {
  const target = stateFilePath();
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });

  const tempPath = `${target}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tempPath, target);
}

function clampPlacement(
  state: PersistedWindowState,
  fallback: WindowFallback,
): WindowPlacement {
  const nearestDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = nearestDisplay.workArea;

  const width = Math.min(
    Math.max(state.width || fallback.width, fallback.minWidth ?? 320),
    workArea.width,
  );
  const height = Math.min(
    Math.max(state.height || fallback.height, fallback.minHeight ?? 240),
    workArea.height,
  );

  const centeredX = workArea.x + Math.round((workArea.width - width) / 2);
  const centeredY = workArea.y + Math.round((workArea.height - height) / 2);

  const rawX = typeof state.x === "number" ? state.x : centeredX;
  const rawY = typeof state.y === "number" ? state.y : centeredY;

  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  const x = Math.min(Math.max(rawX, workArea.x), maxX);
  const y = Math.min(Math.max(rawY, workArea.y), maxY);

  return {
    x,
    y,
    width,
    height,
    isMaximized: state.isMaximized,
  };
}

function serializeWindowState(win: BrowserWindow): PersistedWindowState {
  const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: win.isMaximized(),
  };
}

export function getWindowPlacement(
  key: string,
  fallback: WindowFallback,
): WindowPlacement {
  const existing = readStateStore()[key];
  if (!existing) {
    return {
      width: fallback.width,
      height: fallback.height,
      isMaximized: false,
    };
  }

  return clampPlacement(existing, fallback);
}

export function trackWindowState(key: string, win: BrowserWindow): () => void {
  let timer: NodeJS.Timeout | null = null;

  const persist = (): void => {
    const store = readStateStore();
    store[key] = serializeWindowState(win);
    writeStateStore(store);
  };

  const schedulePersist = (): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      if (!win.isDestroyed()) {
        persist();
      }
    }, SAVE_DEBOUNCE_MS);
  };

  win.on("move", schedulePersist);
  win.on("resize", schedulePersist);
  win.on("maximize", schedulePersist);
  win.on("unmaximize", schedulePersist);
  win.on("close", () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    persist();
  });

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    win.removeListener("move", schedulePersist);
    win.removeListener("resize", schedulePersist);
    win.removeListener("maximize", schedulePersist);
    win.removeListener("unmaximize", schedulePersist);
  };
}
