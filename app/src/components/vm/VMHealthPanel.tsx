import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useVmHealthStore } from "@/stores/vm-health-store";
import { APP_CONFIGS } from "@/types/workspace";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  online: { color: "#22C55E", bg: "rgba(34,197,94,0.15)", label: "Online" },
  degraded: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "Degraded" },
  offline: { color: "#EF4444", bg: "rgba(239,68,68,0.15)", label: "Offline" },
  unknown: { color: "var(--pn-text-tertiary)", bg: "rgba(255,255,255,0.06)", label: "Unknown" },
};

function StatusIndicator({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block rounded-full"
        style={{
          width: 12,
          height: 12,
          background: cfg.color,
          boxShadow: `0 0 8px ${cfg.color}`,
          animation: status === "online" ? "pulse 2s infinite" : undefined,
        }}
      />
      <span className="text-lg font-semibold" style={{ color: cfg.color }}>
        agent-vm {cfg.label}
      </span>
    </div>
  );
}

function CheckBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}
    >
      <span style={{ color: ok ? "#22C55E" : "#EF4444" }}>{ok ? "\u2713" : "\u2717"}</span>
      <span className="text-xs" style={{ color: "var(--pn-text-secondary)" }}>{label}</span>
    </div>
  );
}

interface Container {
  readonly ID?: string;
  readonly Names?: string;
  readonly name?: string;
  readonly Image?: string;
  readonly Status?: string;
  readonly State?: string;
  readonly state?: string;
  readonly status?: string;
  readonly Ports?: string;
  readonly health?: string;
}

function getContainerHealth(container: Container): { color: string; bg: string; label: string } {
  const state = container.state ?? container.State ?? "unknown";
  const health = container.health ?? "";
  const running = state === "running";

  if (!running || state === "exited" || state === "dead") {
    return { color: "#EF4444", bg: "rgba(239,68,68,0.15)", label: "stopped" };
  }
  if (health === "unhealthy" || state === "restarting") {
    return { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: health || state };
  }
  return { color: "#22C55E", bg: "rgba(34,197,94,0.15)", label: health || "running" };
}

function ContainerCard({ container }: { container: Container }) {
  const displayName = container.name ?? container.Names ?? container.ID?.slice(0, 12) ?? "unknown";
  const displayStatus = container.status ?? container.Status ?? "";
  const displayState = container.state ?? container.State ?? "unknown";
  const h = getContainerHealth(container);
  const isUnhealthy = h.color !== "#22C55E";

  return (
    <div
      className="glass-surface rounded-lg p-3"
      style={{ borderLeft: `2px solid ${h.color}` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full shrink-0"
            style={{ width: 8, height: 8, background: h.color, boxShadow: `0 0 6px ${h.color}` }}
          />
          <span className="text-xs font-mono font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
            {displayName}
          </span>
        </div>
        <span
          className="text-[0.6rem] px-1.5 py-0.5 rounded"
          style={{ background: h.bg, color: h.color }}
        >
          {h.label}
        </span>
      </div>
      <div className="text-[0.6rem] font-mono truncate" style={{ color: "var(--pn-text-tertiary)" }}>
        {container.Image ?? ""}
      </div>
      {displayStatus && (
        <div className="text-[0.6rem] mt-1" style={{ color: "var(--pn-text-muted)" }}>
          {displayStatus}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[0.55rem]" style={{ color: "var(--pn-text-muted)" }}>{displayState}</span>
        {isUnhealthy && (
          <button
            disabled
            title="Coming soon"
            className="text-[0.55rem] px-2 py-0.5 rounded opacity-50 cursor-not-allowed"
            style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            Restart
          </button>
        )}
      </div>
    </div>
  );
}

const vmConfig = APP_CONFIGS["vm-health"];

export function VMHealthApp() {
  const { health, loadViaRest, connect, triggerCheck } = useVmHealthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      await loadViaRest().catch(() => {});
      setReady(true);
      connect().catch(() => {});
    }
    init();
  }, [loadViaRest, connect]);

  if (!ready) {
    return (
      <AppWindowChrome appId="vm-health" title={vmConfig.title} icon={vmConfig.icon} accent={vmConfig.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-sm" style={{ color: "var(--pn-text-secondary)" }}>Checking VM health...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const h = health;
  const status = h?.status ?? "unknown";
  const containers = (h?.containers ?? []) as Container[];

  return (
    <AppWindowChrome appId="vm-health" title={vmConfig.title} icon={vmConfig.icon} accent={vmConfig.accent}>
      <div className="flex flex-col gap-4 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <StatusIndicator status={status} />
          <div className="flex items-center gap-2">
            <button
              onClick={triggerCheck}
              className="text-xs px-3 py-1.5 rounded transition-colors hover:opacity-80"
              style={{ background: "rgba(45,212,168,0.15)", color: "#2dd4a8" }}
            >
              Check Now
            </button>
            <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
              {h?.checked_at ? new Date(h.checked_at).toLocaleTimeString() : "never"}
            </span>
          </div>
        </div>

        {/* Service checks */}
        <div className="grid grid-cols-3 gap-3">
          <CheckBadge label="Ping (192.168.122.10)" ok={status !== "offline"} />
          <CheckBadge label="OpenClaw Gateway" ok={h?.openclaw_up ?? false} />
          <CheckBadge label="SSH (port 22)" ok={h?.ssh_up ?? false} />
        </div>

        {/* Network info */}
        <div className="glass-surface rounded-lg p-4">
          <h3 className="text-xs font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
            Network
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span style={{ color: "var(--pn-text-tertiary)" }}>VM IP: </span>
              <span className="font-mono" style={{ color: "rgba(255,255,255,0.87)" }}>192.168.122.10</span>
            </div>
            <div>
              <span style={{ color: "var(--pn-text-tertiary)" }}>Gateway: </span>
              <span className="font-mono" style={{ color: "rgba(255,255,255,0.87)" }}>:18789/gateway</span>
            </div>
            <div>
              <span style={{ color: "var(--pn-text-tertiary)" }}>Latency: </span>
              <span className="font-mono" style={{ color: "rgba(255,255,255,0.87)" }}>
                {h?.latency_ms != null ? `${h.latency_ms}ms` : "\u2014"}
              </span>
            </div>
            <div>
              <button
                onClick={() => navigator.clipboard.writeText("ssh trajan@192.168.122.10")}
                className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                style={{ background: "rgba(107,149,240,0.15)", color: "#6b95f0" }}
              >
                Copy SSH command
              </button>
            </div>
          </div>
        </div>

        {/* Containers */}
        <div>
          <h3 className="text-xs font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
            Containers ({containers.length})
          </h3>
          {containers.length === 0 ? (
            <div className="text-xs text-center py-6" style={{ color: "var(--pn-text-muted)" }}>
              {status === "offline" ? "VM unreachable \u2014 cannot fetch containers" : "No containers running"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {containers.map((c, i) => (
                <ContainerCard key={c.ID ?? i} container={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
