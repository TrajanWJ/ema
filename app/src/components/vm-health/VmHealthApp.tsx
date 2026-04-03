import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useVmHealthStore } from "@/stores/vm-health-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["vm-health"];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  online: { color: "#22C55E", bg: "rgba(34,197,94,0.15)", label: "Online" },
  degraded: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "Degraded" },
  offline: { color: "#EF4444", bg: "rgba(239,68,68,0.15)", label: "Offline" },
  unknown: { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)", label: "Unknown" },
};

interface Container {
  readonly ID?: string;
  readonly Names?: string;
  readonly Image?: string;
  readonly Status?: string;
  readonly State?: string;
  readonly Ports?: string;
}

export function VmHealthApp() {
  const store = useVmHealthStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await store.loadViaRest();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load VM health");
      }
      if (!cancelled) setReady(true);
      store.connect().catch(() => {
        console.warn("VM Health WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function handleCheck() {
    setChecking(true);
    try {
      await store.triggerCheck();
      await store.loadViaRest();
    } catch {
      // handled by store
    }
    setChecking(false);
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="vm-health" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const h = store.health;
  const status = h?.status ?? "unknown";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  const containers = (h?.containers ?? []) as Container[];

  return (
    <AppWindowChrome appId="vm-health" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ padding: 24, color: "var(--pn-text-primary)", height: "100%", overflow: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>VM Health</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleCheck}
              disabled={checking}
              style={{
                fontSize: 12,
                padding: "6px 14px",
                borderRadius: 6,
                background: "rgba(45,212,168,0.15)",
                color: "#2dd4a8",
                border: "none",
                cursor: checking ? "default" : "pointer",
                opacity: checking ? 0.5 : 1,
              }}
            >
              {checking ? "Checking..." : "Run Check"}
            </button>
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-muted)" }}>
              {h?.checked_at ? new Date(h.checked_at).toLocaleTimeString() : "never"}
            </span>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Status card */}
        <div style={{
          background: "rgba(14, 16, 23, 0.55)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: cfg.color,
            boxShadow: `0 0 10px ${cfg.color}`,
            display: "inline-block",
            animation: status === "online" ? "pulse 2s infinite" : undefined,
          }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: cfg.color }}>
            agent-vm {cfg.label}
          </span>
          {h?.latency_ms != null && (
            <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)", marginLeft: "auto" }}>
              {h.latency_ms}ms
            </span>
          )}
        </div>

        {/* Service checks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Ping (192.168.122.10)", ok: status !== "offline" },
            { label: "OpenClaw Gateway", ok: h?.openclaw_up ?? false },
            { label: "SSH (port 22)", ok: h?.ssh_up ?? false },
          ].map((check) => (
            <div
              key={check.label}
              style={{
                background: check.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                borderRadius: 8,
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: check.ok ? "#22C55E" : "#EF4444" }}>{check.ok ? "\u2713" : "\u2717"}</span>
              <span style={{ fontSize: 11, color: "var(--pn-text-secondary)" }}>{check.label}</span>
            </div>
          ))}
        </div>

        {/* Network info */}
        <div style={{
          background: "rgba(14, 16, 23, 0.55)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 11, fontWeight: 500, marginBottom: 12, color: "var(--pn-text-secondary)" }}>Network</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
            <div>
              <span style={{ color: "var(--pn-text-tertiary)" }}>VM IP: </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>192.168.122.10</span>
            </div>
            <div>
              <span style={{ color: "var(--pn-text-tertiary)" }}>Gateway: </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>:18789/gateway</span>
            </div>
            <div>
              <span style={{ color: "var(--pn-text-tertiary)" }}>Latency: </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {h?.latency_ms != null ? `${h.latency_ms}ms` : "\u2014"}
              </span>
            </div>
            <div>
              <button
                onClick={() => navigator.clipboard.writeText("ssh trajan@192.168.122.10")}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 4,
                  background: "rgba(107,149,240,0.15)",
                  color: "#6b95f0",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Copy SSH command
              </button>
            </div>
          </div>
        </div>

        {/* Containers */}
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 500, marginBottom: 12, color: "var(--pn-text-secondary)" }}>
            Containers ({containers.length})
          </h3>
          {containers.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--pn-text-muted)", textAlign: "center", padding: 24 }}>
              {status === "offline" ? "VM unreachable \u2014 cannot fetch containers" : "No containers running"}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {containers.map((c, i) => {
                const running = c.State === "running";
                return (
                  <div
                    key={c.ID ?? i}
                    style={{
                      background: "rgba(14, 16, 23, 0.55)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: 12,
                      borderLeft: `2px solid ${running ? "#22C55E" : "#EF4444"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                        {c.Names ?? c.ID?.slice(0, 12) ?? "unknown"}
                      </span>
                      <span style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: running ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                        color: running ? "#22C55E" : "#EF4444",
                      }}>
                        {c.State ?? "unknown"}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.Image ?? ""}
                    </div>
                    {c.Status && (
                      <div style={{ fontSize: 10, marginTop: 4, color: "var(--pn-text-muted)" }}>{c.Status}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
