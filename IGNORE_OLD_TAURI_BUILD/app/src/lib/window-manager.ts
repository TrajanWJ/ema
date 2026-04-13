import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { WindowState } from "@/types/workspace";

export async function openApp(appId: string, savedState?: WindowState | null): Promise<void> {
  // Never open a second launchpad
  if (appId === "launchpad") return;

  const existing = await WebviewWindow.getByLabel(appId).catch(() => null);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const config = APP_CONFIGS[appId];
  if (!config) return;

  const x = savedState?.x ?? undefined;
  const y = savedState?.y ?? undefined;
  const width = savedState?.width ?? config.defaultWidth;
  const height = savedState?.height ?? config.defaultHeight;

  const webview = new WebviewWindow(appId, {
    url: `/${appId}?standalone`,
    title: config.title,
    width,
    height,
    x,
    y,
    decorations: false,
    transparent: true,
    shadow: false,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
  });

  webview.once("tauri://created", () => {
    useWorkspaceStore.getState().updateWindow(appId, { is_open: true });
  });

  webview.once("tauri://error", (e) => {
    console.error(`Failed to create window for ${appId}:`, e);
  });
}

export async function closeApp(appId: string): Promise<void> {
  const existing = await WebviewWindow.getByLabel(appId).catch(() => null);
  if (existing) {
    await existing.close();
  }
}

/** Restore previously open windows — disabled to prevent artifact windows */
export async function restoreWorkspace(): Promise<void> {
  // Reset all is_open flags on startup to prevent stale windows
  const store = useWorkspaceStore.getState();
  await store.load().catch(() => {});

  for (const w of store.windows) {
    if (w.is_open && w.app_id !== "launchpad") {
      await store.updateWindow(w.app_id, { is_open: false }).catch(() => {});
    }
  }
}

export async function saveWindowState(appId: string): Promise<void> {
  const existing = await WebviewWindow.getByLabel(appId).catch(() => null);
  if (!existing) return;

  const position = await existing.outerPosition();
  const size = await existing.outerSize();
  const maximized = await existing.isMaximized();

  await useWorkspaceStore.getState().updateWindow(appId, {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    is_maximized: maximized,
    is_open: false,
  });
}
