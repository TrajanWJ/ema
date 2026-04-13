import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useServiceStore } from "@/stores/service-store";
import { useVmHealthStore } from "@/stores/vm-health-store";
import { useTokenStore } from "@/stores/token-store";
import type { Service } from "@/stores/service-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["service-dashboard"];

const STATUS_COLORS: Record<Service["status"], string> = {
  running: "#22C55E",
  stopped: "#6b7280",
  error: "#f87171",
};

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "--";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function ServiceDashboardApp() {
  const serviceStore = useServiceStore();
  const vmStore = useVmHealthStore();
  const tokenStore = useTokenStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await Promise.all([
          serviceStore.loadServices(),
          vmStore.loadViaRest(),
          tokenStore.loadViaRest(),
        ]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load services");
      }
      if (!cancelled) setReady(true);
      vmStore.connect().catch(() => {});
      tokenStore.connect().catch(() => {});
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="service-dashboard" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const services = serviceStore.services;
  const runningCount = services.filter((s) => s.status === "running").length;
  const errorCount = services.filter((s) => s.status === "error").length;
  const vmHealth = vmStore.health;
  const vmStatus = vmHealth?.status ?? "unknown";
  const vmStatusColor = vmStatus === "online" ? "#22C55E" : vmStatus === "degraded" ? "#f59e0b" : "#EF4444";
  const tokenSummary = tokenStore.summary;

  return (
    <AppWindowChrome appId="service-dashboard" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ padding: 24, color: "var(--pn-text-primary)", height: "100%", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Service Dashboard</h2>
          <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
            <span style={{ color: "#22C55E" }}>{runningCount} running</span>
            {errorCount > 0 && <span style={{ color: "#f87171" }}>{errorCount} error</span>}
            <span style={{ color: "var(--pn-text-muted)" }}>{services.length} total</span>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Overview cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          {/* VM Health */}
          <div style={{
            background: "rgba(14, 16, 23, 0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: vmStatusColor,
                boxShadow: `0 0 6px ${vmStatusColor}`,
                display: "inline-block",
              }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>VM Health</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: vmStatusColor, textTransform: "capitalize" }}>
              {vmStatus}
            </div>
            {vmHealth?.latency_ms != null && (
              <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>
                Latency: {vmHealth.latency_ms}ms
              </div>
            )}
          </div>

          {/* Token Usage */}
          <div style={{
            background: "rgba(14, 16, 23, 0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Token Usage</div>
            {tokenSummary ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                  ${tokenSummary.today_cost.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>
                  today / ${tokenSummary.monthly_budget} budget
                </div>
                <div style={{ width: "100%", height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)", marginTop: 6 }}>
                  <div style={{
                    height: "100%",
                    borderRadius: 999,
                    width: `${Math.min(tokenSummary.percent_used, 100)}%`,
                    background: tokenSummary.percent_used > 80 ? "#f59e0b" : "#2dd4a8",
                  }} />
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--pn-text-muted)" }}>No data</div>
            )}
          </div>

          {/* Services summary */}
          <div style={{
            background: "rgba(14, 16, 23, 0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Services</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#22C55E" }}>{runningCount}</div>
            <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>
              {services.length} configured, {errorCount > 0 ? `${errorCount} errors` : "all healthy"}
            </div>
          </div>
        </div>

        {/* Service list */}
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "var(--pn-text-secondary)" }}>Services</h3>
        {services.length === 0 && !serviceStore.loading ? (
          <div style={{ fontSize: 12, color: "var(--pn-text-muted)", textAlign: "center", padding: 32 }}>
            No services configured
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {services.map((svc) => {
              const color = STATUS_COLORS[svc.status];
              return (
                <div
                  key={svc.id}
                  style={{
                    background: "rgba(14, 16, 23, 0.55)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                        boxShadow: svc.status === "running" ? `0 0 6px ${color}` : "none",
                        display: "inline-block",
                      }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{svc.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color, textTransform: "capitalize" }}>{svc.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 8, color: "var(--pn-text-muted)", fontSize: 12 }}>
                    {svc.port && <span>Port: {svc.port}</span>}
                    {svc.pid && <span>PID: {svc.pid}</span>}
                    <span>Uptime: {formatUptime(svc.uptime_seconds)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {svc.status === "stopped" && (
                      <button
                        onClick={() => serviceStore.startService(svc.id)}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(34,197,94,0.12)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)", cursor: "pointer" }}
                      >
                        Start
                      </button>
                    )}
                    {svc.status === "running" && (
                      <>
                        <button
                          onClick={() => serviceStore.stopService(svc.id)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}
                        >
                          Stop
                        </button>
                        <button
                          onClick={() => serviceStore.restartService(svc.id)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", color: "var(--pn-text-secondary)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
                        >
                          Restart
                        </button>
                      </>
                    )}
                    {svc.status === "error" && (
                      <>
                        <button
                          onClick={() => serviceStore.restartService(svc.id)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", cursor: "pointer" }}
                        >
                          Restart
                        </button>
                        <button
                          onClick={() => serviceStore.stopService(svc.id)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}
                        >
                          Stop
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
