import { openAppWindow, closeAppWindow } from "@/lib/electron-bridge";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { WindowState } from "@/types/workspace";

export async function openApp(appId: string, _savedState?: WindowState | null): Promise<void> {
  if (appId === "launchpad") return;
  await openAppWindow(appId);
  useWorkspaceStore.getState().updateWindow(appId, { is_open: true });
}

export async function closeApp(appId: string): Promise<void> {
  await closeAppWindow(appId);
}

export async function restoreWorkspace(): Promise<void> {
  const store = useWorkspaceStore.getState();
  await store.load().catch(() => {});

  for (const w of store.windows) {
    if (w.is_open && w.app_id !== "launchpad") {
      await store.updateWindow(w.app_id, { is_open: false }).catch(() => {});
    }
  }
}

export async function saveWindowState(_appId: string): Promise<void> {
  // Window state persistence handled by Electron main process
}
