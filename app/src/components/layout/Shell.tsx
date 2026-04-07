import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
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
import { useOrgStore } from "@/stores/org-store";
import { useMemoryStore } from "@/stores/memory-store";
import { useGapStore } from "@/stores/gap-store";
import { useIntentStore } from "@/stores/intent-store";
import { useExecutionStore } from "@/stores/execution-store";
import { useTokenMonitorStore } from "@/stores/token-monitor-store";
import { useVmHealthStore } from "@/stores/vm-health-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useDecisionLogStore } from "@/stores/decision-log-store";
import { usePromptWorkshopStore } from "@/stores/prompt-workshop-store";
import { useProjectGraphStore } from "@/stores/project-graph-store";
import { useCodeHealthStore } from "@/stores/code-health-store";
import { useActorsStore } from "@/stores/actors-store";
import { restoreWorkspace } from "@/lib/window-manager";
import { doFetch } from "@/lib/api";
import { ToastOverlay } from "@/components/ui/ToastOverlay";
import { subscribeExecutionNotifications } from "@/lib/execution-notifications";
import { invoke } from "@tauri-apps/api/core";

const DAEMON_URL = "http://localhost:4488/api/health";
const PING_INTERVAL = 3000;
const INITIAL_RETRY_DELAY = 500;
const MAX_RETRY_DELAY = 5000;

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface ShellProps {
  readonly children: ReactNode;
}

async function pingDaemon(): Promise<boolean> {
  try {
    const res = await doFetch(DAEMON_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function requestDaemonStart(): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("ensure_daemon");
  } catch (e) {
    console.warn("ensure_daemon failed:", e);
  }
}

export function Shell({ children }: ShellProps) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"connecting" | "waiting" | "error">("connecting");
  const [attempt, setAttempt] = useState(0);
  const cancelledRef = useRef(false);
  const connectingRef = useRef(false);

  const loadAllStores = useCallback(async () => {
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
      useOrgStore.getState().loadViaRest().catch(() => {}),
      useMemoryStore.getState().loadViaRest().catch(() => {}),
      useGapStore.getState().loadViaRest().catch(() => {}),
      useIntentStore.getState().loadViaRest().catch(() => {}),
      useExecutionStore.getState().loadViaRest().catch(() => {}),
      useTokenMonitorStore.getState().loadViaRest().catch(() => {}),
      useVmHealthStore.getState().loadViaRest().catch(() => {}),
      usePipelineStore.getState().loadViaRest().catch(() => {}),
      useDecisionLogStore.getState().loadViaRest().catch(() => {}),
      usePromptWorkshopStore.getState().loadViaRest().catch(() => {}),
      useProjectGraphStore.getState().loadViaRest().catch(() => {}),
      useCodeHealthStore.getState().loadViaRest().catch(() => {}),
      useActorsStore.getState().loadViaRest().catch(() => {}),
    ]);
  }, []);

  const connectAllChannels = useCallback(async () => {
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
      useOrgStore.getState().connect().catch(() => {}),
      useMemoryStore.getState().connect().catch(() => {}),
      useGapStore.getState().connect().catch(() => {}),
      useIntentStore.getState().connect().catch(() => {}),
      useExecutionStore.getState().connect().catch(() => {}),
      useTokenMonitorStore.getState().connect().catch(() => {}),
      usePipelineStore.getState().connect().catch(() => {}),
      useDecisionLogStore.getState().connect().catch(() => {}),
      usePromptWorkshopStore.getState().connect().catch(() => {}),
      useProjectGraphStore.getState().connect().catch(() => {}),
      useCodeHealthStore.getState().connect().catch(() => {}),
      useActorsStore.getState().connect().catch(() => {}),
    ]);
  }, []);

  const tryConnect = useCallback(async () => {
    if (connectingRef.current || cancelledRef.current) return;
    connectingRef.current = true;

    let delay = INITIAL_RETRY_DELAY;
    let tries = 0;

    while (!cancelledRef.current) {
      tries++;
      setAttempt(tries);
      setStatus("connecting");

      const alive = await pingDaemon();
      if (!alive) {
        setStatus("waiting");
        // Ask Tauri to start the daemon if we're in the desktop app
        if (tries === 1) await requestDaemonStart();
        delay = Math.min(delay * 1.5, MAX_RETRY_DELAY);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      try {
        await loadAllStores();
        if (cancelledRef.current) break;

        setReady(true);
        setStatus("connecting");

        connectAllChannels().catch(() => {
          console.warn("WebSocket connection failed, using REST fallback");
        });

        subscribeExecutionNotifications();

        await restoreWorkspace();
        break;
      } catch {
        setStatus("error");
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 1.5, MAX_RETRY_DELAY);
      }
    }

    connectingRef.current = false;
  }, [loadAllStores, connectAllChannels]);

  // Initial connection
  useEffect(() => {
    cancelledRef.current = false;
    tryConnect();
    return () => { cancelledRef.current = true; };
  }, [tryConnect]);

  // Background health-check: auto-reconnect if daemon comes back after losing connection
  useEffect(() => {
    if (ready) return;

    const interval = setInterval(async () => {
      if (connectingRef.current) return;
      const alive = await pingDaemon();
      if (alive && !ready && !connectingRef.current) {
        tryConnect();
      }
    }, PING_INTERVAL);

    return () => clearInterval(interval);
  }, [ready, tryConnect]);

  if (!ready) {
    const isWaiting = status === "waiting";
    const label = isWaiting
      ? `Waiting for daemon on :4488\u2026 (attempt ${attempt})`
      : status === "error"
        ? "Daemon responded but stores failed to load"
        : "Connecting to daemon\u2026";

    return (
      <div
        className="h-screen flex flex-col items-center justify-center gap-3 rounded-xl overflow-hidden"
        style={{ background: "rgba(8, 9, 14, 0.85)" }}
      >
        {/* spinner */}
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            borderTopColor: "var(--pn-accent, #5eead4)",
          }}
        />
        <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
          {label}
        </span>
        {(isWaiting || status === "error") && (
          <button
            type="button"
            onClick={() => {
              cancelledRef.current = true;
              connectingRef.current = false;
              setTimeout(() => {
                cancelledRef.current = false;
                tryConnect();
              }, 50);
            }}
            className="mt-1 px-3 py-1 text-[0.75rem] rounded-md transition-all duration-200 hover:bg-white/10 active:scale-95"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "var(--pn-text-secondary)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Retry now
          </button>
        )}
        {isWaiting && (
          <span className="text-[0.65rem] mt-1" style={{ color: "var(--pn-text-muted)" }}>
            Make sure the daemon is running: cd daemon && mix phx.server
          </span>
        )}
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
      <ToastOverlay />
    </div>
  );
}
