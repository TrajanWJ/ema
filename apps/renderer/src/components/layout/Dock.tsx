import type { CSSProperties } from "react";

import { DOCK_APPS } from "@/config/app-catalog";
import { isDesktopEnvironment } from "@/lib/electron-bridge";
import { navigateToRoute } from "@/lib/router";
import { openApp } from "@/lib/window-manager";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";
import { Tooltip } from "@/components/ui/Tooltip";

export function Dock() {
  const isOpen = useWorkspaceStore((s) => s.isOpen);

  function handleClick(appId: string) {
    if (isDesktopEnvironment()) {
      void openApp(appId);
      return;
    }
    navigateToRoute(appId);
  }

  return (
    <div
      className="glass-elevated flex flex-col items-center py-3 shrink-0"
      style={{ width: "52px", borderRight: "1px solid var(--pn-border-subtle)" }}
    >
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto scrollbar-none">
        <Tooltip label="Launchpad">
          <button
            onClick={() => {
              navigateToRoute("launchpad");
            }}
            className="dock-icon active"
            style={{ color: "var(--color-pn-primary-400)" }}
          >
            <span className="dock-indicator" style={{ background: "var(--color-pn-primary-400)" }} />
            ◉
          </button>
        </Tooltip>

        <div className="dock-sep" />

        {DOCK_APPS.filter((app) => app.id !== "settings").map((app) => {
          const running = isOpen(app.id);
          const config = APP_CONFIGS[app.id];
          const accent = config?.accent ?? "var(--pn-text-tertiary)";
          const icon = config?.icon ?? "□";
          const isPreview = app.readiness === "preview";

          return (
            <Tooltip key={app.id} label={`${app.name} · ${app.readiness}`}>
              <button
                onClick={() => handleClick(app.id)}
                className={`dock-icon ${running ? "active" : ""}`}
                style={{
                  "--dock-accent": accent,
                  color: running ? accent : "var(--pn-text-tertiary)",
                  opacity: isPreview ? 0.64 : 1,
                } as CSSProperties}
              >
                {icon}
                {running && <span className="dock-dot" />}
                {!running && app.readiness === "partial" && (
                  <span
                    className="dock-dot"
                    style={{
                      width: 4,
                      height: 4,
                      bottom: 8,
                      background: "#fbbf24",
                      opacity: 0.85,
                    }}
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
      </nav>

      <div className="dock-sep" />

      <Tooltip label="Settings">
        <button
          onClick={() => handleClick("settings")}
          className="dock-icon"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          ⚙
        </button>
      </Tooltip>
    </div>
  );
}
