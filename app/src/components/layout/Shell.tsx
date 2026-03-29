import { useEffect, useState, type ReactNode } from "react";
import { AmbientStrip } from "./AmbientStrip";
import { Dock } from "./Dock";
import { CommandBar } from "./CommandBar";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHabitsStore } from "@/stores/habits-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { restoreWorkspace } from "@/lib/window-manager";

interface ShellProps {
  readonly children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await Promise.all([
          useDashboardStore.getState().loadViaRest(),
          useBrainDumpStore.getState().loadViaRest(),
          useHabitsStore.getState().loadViaRest(),
          useSettingsStore.getState().load(),
          useWorkspaceStore.getState().load(),
        ]);
        if (!cancelled) setReady(true);

        // Connect WebSockets in background
        Promise.all([
          useDashboardStore.getState().connect(),
          useBrainDumpStore.getState().connect(),
          useHabitsStore.getState().connect(),
          useSettingsStore.getState().connect(),
          useWorkspaceStore.getState().connect(),
        ]).catch(() => {
          console.warn("WebSocket connection failed, using REST fallback");
        });

        // Restore previously open windows
        await restoreWorkspace();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Connection failed");
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div
        className="h-screen flex items-center justify-center rounded-xl overflow-hidden"
        style={{ background: "rgba(8, 9, 14, 0.85)" }}
      >
        <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
          {error ? `Connection error: ${error}` : "Connecting to daemon..."}
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col rounded-xl overflow-hidden" style={{ background: "rgba(8, 9, 14, 0.85)" }}>
      <AmbientStrip />
      <div className="flex flex-1 min-h-0">
        <Dock />
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
      <CommandBar />
    </div>
  );
}
