import { useEffect, type MouseEvent, type ReactNode } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";

function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

async function getCurrentWindowOrNull(): Promise<any | null> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch {
    return null;
  }
}

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
    if (!isTauriEnvironment()) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const win = await getCurrentWindowOrNull();
      if (!win) return;
      try {
        const { saveWindowState } = await import("@/lib/window-manager");
        const unlistenClose = await win.onCloseRequested(async (event: { preventDefault: () => void }) => {
          event.preventDefault();
          await saveWindowState(appId);
          await useWorkspaceStore.getState().updateWindow(appId, { is_open: false });
          if (win.destroy) {
            await win.destroy();
          } else if (win.close) {
            await win.close();
          }
        });
        cleanup = unlistenClose;
      } catch {
        // Not in Tauri — no-op
      }
    })();
    return () => { cleanup?.(); };
  }, [appId]);

  async function handleMinimize() {
    const win = await getCurrentWindowOrNull();
    await win?.minimize?.();
  }

  async function handleMaximize() {
    const win = await getCurrentWindowOrNull();
    if (!win?.isMaximized) return;
    const maximized = await win.isMaximized();
    if (maximized) {
      await win.unmaximize?.();
    } else {
      await win.maximize?.();
    }
  }

  async function handleClose() {
    const win = await getCurrentWindowOrNull();
    if (!win) return;
    const { saveWindowState } = await import("@/lib/window-manager");
    await saveWindowState(appId);
    await useWorkspaceStore.getState().updateWindow(appId, { is_open: false });
    if (win.destroy) {
      await win.destroy();
    } else if (win.close) {
      await win.close();
    }
  }

  async function handleStartDrag(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || !isTauriEnvironment()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("button,[data-tauri-no-drag]")) return;
    const win = await getCurrentWindowOrNull();
    if (win?.startDragging) {
      event.preventDefault();
      await win.startDragging();
    }
  }

  const embedded = isInsideLaunchpad();
  const standalone = !embedded;

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
      className="h-full flex flex-col rounded-none overflow-hidden"
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
        onMouseDown={handleStartDrag}
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
        <div className="flex items-center gap-2" data-tauri-no-drag="">
          <button
            type="button"
            data-tauri-no-drag=""
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "var(--color-pn-warning, #EAB308)" }}
          />
          <button
            type="button"
            data-tauri-no-drag=""
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "var(--color-pn-success, #22C55E)" }}
          />
          <button
            type="button"
            data-tauri-no-drag=""
            onClick={handleClose}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-100 opacity-80"
            style={{ background: "var(--color-pn-error, #E24B4A)" }}
          />
        </div>
      </div>

      {/* App content */}
      <main className={`flex-1 overflow-auto ${standalone ? "p-2" : "p-4"}`}>{children}</main>
    </div>
  );
}
