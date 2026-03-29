import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { WindowState } from "@/types/workspace";

export async function openApp(appId: string, savedState?: WindowState | null): Promise<void> {
  const existing = await WebviewWindow.getByLabel(appId);
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
    url: `/${appId}`,
    title: config.title,
    width,
    height,
    x,
    y,
    decorations: false,
    transparent: true,
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
  const existing = await WebviewWindow.getByLabel(appId);
  if (existing) {
    await existing.close();
  }
}

export async function restoreWorkspace(): Promise<void> {
  const store = useWorkspaceStore.getState();
  await store.load();

  const openWindows = store.windows.filter((w) => w.is_open);
  for (const windowState of openWindows) {
    if (windowState.app_id === "launchpad") continue;
    await openApp(windowState.app_id, windowState);
  }
}

export async function saveWindowState(appId: string): Promise<void> {
  const existing = await WebviewWindow.getByLabel(appId);
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
