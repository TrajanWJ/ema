import { useEffect, type ReactNode } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
    if (!isTauri) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const { saveWindowState } = await import("@/lib/window-manager");
        const win = getCurrentWindow();
        const unlistenClose = await win.onCloseRequested(async (event) => {
          event.preventDefault();
          await saveWindowState(appId);
          await useWorkspaceStore.getState().updateWindow(appId, { is_open: false });
          await win.destroy();
        });
        cleanup = unlistenClose;
      } catch {
        // Not in Tauri — no-op
      }
    })();
    return () => { cleanup?.(); };
  }, [appId]);

  async function handleMinimize() {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch { /* browser */ }
  }

  async function handleMaximize() {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      if (maximized) { await win.unmaximize(); } else { await win.maximize(); }
    } catch { /* browser */ }
  }

  async function handleClose() {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const { saveWindowState } = await import("@/lib/window-manager");
      await saveWindowState(appId);
      await useWorkspaceStore.getState().updateWindow(appId, { is_open: false });
      await getCurrentWindow().destroy();
    } catch { /* browser */ }
  }

  return (
    <div
      className="h-screen flex flex-col rounded-xl overflow-hidden"
      style={{
        background: [
          "radial-gradient(circle at top, rgba(45, 212, 168, 0.08), transparent 24%)",
          "radial-gradient(circle at 85% 0%, rgba(107, 149, 240, 0.07), transparent 22%)",
          "linear-gradient(180deg, rgba(8, 9, 14, 0.78), rgba(6, 6, 16, 0.84))",
          "rgba(7, 9, 15, 0.58)",
        ].join(", "),
        backdropFilter: "blur(20px) saturate(128%)",
        WebkitBackdropFilter: "blur(20px) saturate(128%)",
      }}
    >
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
      <main
        className="flex-1 overflow-auto p-4"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0)), rgba(14, 16, 23, 0.46)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
