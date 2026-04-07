import { useEffect, type ReactNode } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Are we inside the launchpad (Shell) or a standalone window? */
function isInsideLaunchpad(): boolean {
  if (typeof window === "undefined") return true;
  // Standalone windows get ?standalone in the URL
  return !window.location.search.includes("standalone");
}

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

  const embedded = isInsideLaunchpad();

  // When embedded in launchpad: minimal chrome, no traffic lights, transparent bg
  if (embedded) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Thin app header — no traffic lights */}
        <div
          className="flex items-center gap-2 px-3 shrink-0"
          style={{
            height: "32px",
            background: "var(--pn-window-header)",
            backdropFilter: "blur(12px) saturate(130%)",
            WebkitBackdropFilter: "blur(12px) saturate(130%)",
            borderBottom: "1px solid var(--pn-border-subtle)",
          }}
        >
          <span style={{ color: accent, fontSize: "13px" }}>{icon}</span>
          <span
            className="text-[0.65rem] font-semibold tracking-wide"
            style={{ color: accent, letterSpacing: "0.06em" }}
          >
            {title}
          </span>
          {breadcrumb && (
            <span className="text-[0.55rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
              · {breadcrumb}
            </span>
          )}
        </div>
        <main className="flex-1 overflow-auto p-3">{children}</main>
      </div>
    );
  }

  // Standalone window: full chrome with traffic lights and glass background
  return (
    <div
      className="h-screen flex flex-col rounded-xl overflow-hidden"
      style={{
        background: [
          "radial-gradient(circle at top, rgba(45, 212, 168, 0.08), transparent 24%)",
          "radial-gradient(circle at 85% 0%, rgba(107, 149, 240, 0.07), transparent 22%)",
          "linear-gradient(180deg, var(--pn-window-core), var(--pn-window-deep))",
          "var(--pn-window-wash)",
        ].join(", "),
        backdropFilter: "blur(20px) saturate(128%)",
        WebkitBackdropFilter: "blur(20px) saturate(128%)",
      }}
    >
      {/* Custom title bar with traffic lights */}
      <div
        className="flex items-center justify-between px-3.5 shrink-0"
        style={{
          height: "36px",
          background: "var(--pn-window-header)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
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
            <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
              · {breadcrumb}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "var(--color-pn-warning, #EAB308)" }}
          />
          <button
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "var(--color-pn-success, #22C55E)" }}
          />
          <button
            onClick={handleClose}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "var(--color-pn-error, #E24B4A)" }}
          />
        </div>
      </div>

      {/* App content */}
      <main className="flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
}
