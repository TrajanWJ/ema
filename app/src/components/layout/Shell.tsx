import { useEffect, useState, type ReactNode } from "react";
import { AmbientStrip } from "./AmbientStrip";
import { Dock } from "./Dock";
import { CommandBar } from "./CommandBar";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHabitsStore } from "@/stores/habits-store";
import { useProposalsStore } from "@/stores/proposals-store";
import { useProjectsStore } from "@/stores/projects-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useResponsibilitiesStore } from "@/stores/responsibilities-store";
import { useAgentsStore } from "@/stores/agents-store";
import { useVaultStore } from "@/stores/vault-store";
import { useCanvasStore } from "@/stores/canvas-store";
import { usePipesStore } from "@/stores/pipes-store";
import { useChannelsStore } from "@/stores/channels-store";
import { useGoalsStore } from "@/stores/goals-store";
import { useFocusStore } from "@/stores/focus-store";
import { restoreWorkspace } from "@/lib/window-manager";

interface ShellProps {
  readonly children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAllStores() {
      await Promise.all([
        useDashboardStore.getState().loadViaRest(),
        useBrainDumpStore.getState().loadViaRest(),
        useHabitsStore.getState().loadViaRest(),
        useProposalsStore.getState().loadViaRest().catch(() => {}),
        useProjectsStore.getState().loadViaRest().catch(() => {}),
        useTasksStore.getState().loadViaRest().catch(() => {}),
        useSettingsStore.getState().load(),
        useWorkspaceStore.getState().load(),
        useResponsibilitiesStore.getState().loadViaRest().catch(() => {}),
        useAgentsStore.getState().loadViaRest().catch(() => {}),
        useVaultStore.getState().loadViaRest().catch(() => {}),
        useCanvasStore.getState().loadViaRest().catch(() => {}),
        usePipesStore.getState().loadViaRest().catch(() => {}),
        useChannelsStore.getState().loadViaRest().catch(() => {}),
        useGoalsStore.getState().loadViaRest().catch(() => {}),
        useFocusStore.getState().loadViaRest().catch(() => {}),
      ]);
    }

    async function connectAllChannels() {
      await Promise.all([
        useDashboardStore.getState().connect(),
        useBrainDumpStore.getState().connect(),
        useHabitsStore.getState().connect(),
        useProposalsStore.getState().connect().catch(() => {}),
        useProjectsStore.getState().connect().catch(() => {}),
        useTasksStore.getState().connect().catch(() => {}),
        useSettingsStore.getState().connect(),
        useWorkspaceStore.getState().connect(),
        useResponsibilitiesStore.getState().connect().catch(() => {}),
        useAgentsStore.getState().connect().catch(() => {}),
        useVaultStore.getState().connect().catch(() => {}),
        useCanvasStore.getState().connect().catch(() => {}),
        usePipesStore.getState().connect().catch(() => {}),
        useChannelsStore.getState().connect().catch(() => {}),
        useGoalsStore.getState().connect().catch(() => {}),
        useFocusStore.getState().connect().catch(() => {}),
      ]);
    }

    async function init() {
      const maxRetries = 20;
      const retryDelay = 1000;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (cancelled) return;
        try {
          await loadAllStores();
          if (!cancelled) setReady(true);

          // Connect WebSockets in background
          connectAllChannels().catch(() => {
            console.warn("WebSocket connection failed, using REST fallback");
          });

          // Restore previously open windows
          await restoreWorkspace();
          return;
        } catch {
          if (cancelled) return;
          const remaining = maxRetries - attempt - 1;
          if (remaining > 0) {
            setError(`Waiting for daemon... (${remaining}s)`);
            await new Promise((r) => setTimeout(r, retryDelay));
          } else {
            setError("Could not connect to daemon on :4488");
          }
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
