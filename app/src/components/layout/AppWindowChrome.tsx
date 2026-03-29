import { useEffect, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { saveWindowState } from "@/lib/window-manager";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface AppWindowChromeProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly breadcrumb?: string;
  readonly children: ReactNode;
}

export function AppWindowChrome({
  appId,
  title,
  icon,
  accent,
  breadcrumb,
  children,
}: AppWindowChromeProps) {
  useEffect(() => {
    const win = getCurrentWindow();

    const unlistenClose = win.onCloseRequested(async (event) => {
      event.preventDefault();
      await saveWindowState(appId);
      await useWorkspaceStore.getState().updateWindow(appId, { is_open: false });
      await win.destroy();
    });

    return () => {
      unlistenClose.then((fn) => fn());
    };
  }, [appId]);

  async function handleMinimize() {
    await getCurrentWindow().minimize();
  }

  async function handleMaximize() {
    const win = getCurrentWindow();
    const maximized = await win.isMaximized();
    if (maximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  }

  async function handleClose() {
    await saveWindowState(appId);
    await useWorkspaceStore.getState().updateWindow(appId, { is_open: false });
    await getCurrentWindow().destroy();
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-pn-base)" }}>
      {/* Custom title bar */}
      <div
        className="glass-surface flex items-center justify-between px-3.5 shrink-0"
        style={{
          height: "36px",
          borderBottom: "1px solid var(--pn-border-subtle)",
        }}
        data-tauri-drag-region=""
      >
        <div className="flex items-center gap-2" data-tauri-drag-region="">
          <span style={{ color: accent, fontSize: "14px" }}>{icon}</span>
          <span
            className="text-[0.7rem] font-semibold tracking-wide"
            style={{ color: accent, letterSpacing: "0.06em" }}
          >
            {title}
          </span>
          {breadcrumb && (
            <span
              className="text-[0.6rem] font-mono"
              style={{ color: "var(--pn-text-muted)" }}
            >
              · {breadcrumb}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "#EAB308" }}
          />
          <button
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "#22C55E" }}
          />
          <button
            onClick={handleClose}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "#E24B4A" }}
          />
        </div>
      </div>

      {/* App content */}
      <main className="flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
}
