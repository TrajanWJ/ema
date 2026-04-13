import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { AmbientStrip } from "./AmbientStrip";
import { Dock } from "./Dock";
import { CommandBar } from "./CommandBar";
import { QuickCapture } from "./QuickCapture";
// EMA UI 2.0 — only stores for the 22 active apps
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
import { useGoalsStore } from "@/stores/goals-store";
import { useFocusStore } from "@/stores/focus-store";
import { useIntentStore } from "@/stores/intent-store";
import { useExecutionStore } from "@/stores/execution-store";
import { useDecisionLogStore } from "@/stores/decision-log-store";
import { useActorsStore } from "@/stores/actors-store";
import { restoreWorkspace } from "@/lib/window-manager";
import { doFetch, ensureReady } from "@/lib/api";
import { DAEMON_HEALTH_URL } from "@/lib/daemon-config";
import { ToastOverlay } from "@/components/ui/ToastOverlay";
import { subscribeExecutionNotifications } from "@/lib/execution-notifications";
import { isDesktopEnvironment } from "@/lib/electron-bridge";

const PING_INTERVAL = 1500;
const INITIAL_RETRY_DELAY = 200;
const MAX_RETRY_DELAY = 2000;

const isDesktop = isDesktopEnvironment();
const isStandaloneWindow = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("standalone");
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

interface ShellProps {
  readonly children: ReactNode;
  readonly hideDock?: boolean;
}

async function pingDaemon(): Promise<boolean> {
  try {
    const res = await doFetch(DAEMON_HEALTH_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function requestDaemonStart(): Promise<void> {
  if (!isDesktop) return;
  try {
    // In Electron, daemon startup is handled by the main process
  } catch (e) {
    console.warn("ensure_daemon failed:", e);
  }
}

export function Shell({ children, hideDock }: ShellProps) {
  const standaloneWindow = isDesktop && isStandaloneWindow();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"connecting" | "waiting" | "error">("connecting");
  const [attempt, setAttempt] = useState(0);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const cancelledRef = useRef(false);
  const connectingRef = useRef(false);

  const loadAllStores = useCallback(async () => {
    await Promise.all([
      useDashboardStore.getState().loadViaRest().catch(() => {}),
      useBrainDumpStore.getState().loadViaRest().catch(() => {}),
      useHabitsStore.getState().loadViaRest().catch(() => {}),
      useProposalsStore.getState().loadViaRest().catch(() => {}),
      useProjectsStore.getState().loadViaRest().catch(() => {}),
      useTasksStore.getState().loadViaRest().catch(() => {}),
      useSettingsStore.getState().load().catch(() => {}),
      useWorkspaceStore.getState().load().catch(() => {}),
      useResponsibilitiesStore.getState().loadViaRest().catch(() => {}),
      useAgentsStore.getState().loadViaRest().catch(() => {}),
      useVaultStore.getState().loadViaRest().catch(() => {}),
      useCanvasStore.getState().loadViaRest().catch(() => {}),
      usePipesStore.getState().loadViaRest().catch(() => {}),
      useGoalsStore.getState().loadViaRest().catch(() => {}),
      useFocusStore.getState().loadViaRest().catch(() => {}),
      useIntentStore.getState().loadViaRest().catch(() => {}),
      useExecutionStore.getState().loadViaRest().catch(() => {}),
      useDecisionLogStore.getState().loadViaRest().catch(() => {}),
      useActorsStore.getState().loadViaRest().catch(() => {}),
    ]);
  }, []);

  const connectAllChannels = useCallback(async () => {
    await Promise.all([
      useDashboardStore.getState().connect().catch(() => {}),
      useBrainDumpStore.getState().connect().catch(() => {}),
      useHabitsStore.getState().connect().catch(() => {}),
      useProposalsStore.getState().connect().catch(() => {}),
      useProjectsStore.getState().connect().catch(() => {}),
      useTasksStore.getState().connect().catch(() => {}),
      useSettingsStore.getState().connect().catch(() => {}),
      useWorkspaceStore.getState().connect().catch(() => {}),
      useResponsibilitiesStore.getState().connect().catch(() => {}),
      useAgentsStore.getState().connect().catch(() => {}),
      useVaultStore.getState().connect().catch(() => {}),
      useCanvasStore.getState().connect().catch(() => {}),
      usePipesStore.getState().connect().catch(() => {}),
      useGoalsStore.getState().connect().catch(() => {}),
      useFocusStore.getState().connect().catch(() => {}),
      useIntentStore.getState().connect().catch(() => {}),
      useExecutionStore.getState().connect().catch(() => {}),
      useDecisionLogStore.getState().connect().catch(() => {}),
      useActorsStore.getState().connect().catch(() => {}),
    ]);
  }, []);

  const tryConnect = useCallback(async () => {
    if (connectingRef.current || cancelledRef.current) return;
    connectingRef.current = true;

    // Wait for Tauri HTTP plugin to load, then ensure daemon
    await ensureReady();
    await requestDaemonStart();

    let delay = INITIAL_RETRY_DELAY;
    let tries = 0;

    while (!cancelledRef.current) {
      tries++;
      setAttempt(tries);
      setStatus("connecting");

      const alive = await pingDaemon();
      if (!alive) {
        setStatus("waiting");
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

  useEffect(() => {
    cancelledRef.current = false;
    tryConnect();
    return () => { cancelledRef.current = true; };
  }, [tryConnect]);

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.code !== "Space") {
        return;
      }
      if (!quickCaptureOpen && isEditableTarget(event.target)) return;
      event.preventDefault();
      setQuickCaptureOpen((current) => !current);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quickCaptureOpen]);

  if (!ready) {
    const isStandalone = standaloneWindow;
    const isWaiting = status === "waiting";
    const label = isWaiting
      ? `Waiting for daemon on :4488\u2026 (attempt ${attempt})`
      : status === "error"
        ? "Daemon responded but stores failed to load"
        : "Connecting to daemon\u2026";

    return (
      <div
        className={`h-screen flex flex-col items-center justify-center gap-3 overflow-hidden ${isStandalone ? "rounded-none" : "rounded-xl"}`}
        style={{ background: "rgba(8, 9, 14, 0.85)" }}
      >
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
            Electron should start local services automatically. If you launched only the renderer, run `pnpm dev` from the repo root.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${standaloneWindow ? "rounded-none" : "rounded-xl"}`}>
      {!standaloneWindow && <AmbientStrip onOpenQuickCapture={() => setQuickCaptureOpen(true)} />}
      <div className="flex flex-1 min-h-0">
        {!hideDock && <Dock />}
        <main className={`flex-1 overflow-auto ${standaloneWindow ? "p-0" : "p-4"}`}>{children}</main>
      </div>
      {!standaloneWindow && <CommandBar />}
      {!standaloneWindow && (
        <QuickCapture isOpen={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />
      )}
      <ToastOverlay />
    </div>
  );
}
