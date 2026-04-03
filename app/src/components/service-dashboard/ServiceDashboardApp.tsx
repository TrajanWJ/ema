import { useEffect } from "react";
import { useServiceStore } from "@/stores/service-store";
import type { Service } from "@/stores/service-store";

const card = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "10px",
  padding: "16px",
};
const btnStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "6px",
  color: "var(--pn-text-secondary)",
  padding: "4px 10px",
  fontSize: 11,
  cursor: "pointer" as const,
};

const STATUS_COLORS: Record<Service["status"], string> = {
  running: "#34d399",
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

function ServiceCard({ service, onStart, onStop, onRestart }: {
  readonly service: Service;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly onRestart: () => void;
}) {
  const color = STATUS_COLORS[service.status];

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: color,
            boxShadow: service.status === "running" ? `0 0 6px ${color}` : "none",
            display: "inline-block",
          }} />
          <span style={{ color: "var(--pn-text-primary)", fontSize: 14, fontWeight: 500 }}>{service.name}</span>
        </div>
        <span style={{ fontSize: 11, color, textTransform: "capitalize" }}>{service.status}</span>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 12, color: "var(--pn-text-muted)", fontSize: 12 }}>
        {service.port && <span>Port: {service.port}</span>}
        {service.pid && <span>PID: {service.pid}</span>}
        <span>Uptime: {formatUptime(service.uptime_seconds)}</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {service.status === "stopped" && (
          <button onClick={onStart} style={{ ...btnStyle, color: "#34d399" }}>Start</button>
        )}
        {service.status === "running" && (
          <>
            <button onClick={onStop} style={{ ...btnStyle, color: "#f87171" }}>Stop</button>
            <button onClick={onRestart} style={btnStyle}>Restart</button>
          </>
        )}
        {service.status === "error" && (
          <>
            <button onClick={onRestart} style={{ ...btnStyle, color: "#fbbf24" }}>Restart</button>
            <button onClick={onStop} style={{ ...btnStyle, color: "#f87171" }}>Stop</button>
          </>
        )}
      </div>
    </div>
  );
}

export function ServiceDashboardApp() {
  const { services, loading, error, loadServices, startService, stopService, restartService } = useServiceStore();

  useEffect(() => { loadServices(); }, [loadServices]);

  const running = services.filter((s) => s.status === "running").length;
  const errored = services.filter((s) => s.status === "error").length;

  return (
    <div style={{ background: "rgba(8, 9, 14, 0.95)", height: "100%", display: "flex", flexDirection: "column" }}>
      <div data-tauri-drag-region style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ color: "var(--pn-text-primary)", fontSize: 16, fontWeight: 600, margin: 0 }}>Service Dashboard</h2>
        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
          <span style={{ color: "#34d399" }}>{running} running</span>
          {errored > 0 && <span style={{ color: "#f87171" }}>{errored} error</span>}
          <span style={{ color: "var(--pn-text-muted)" }}>{services.length} total</span>
        </div>
      </div>

      {error && <div style={{ padding: "0 20px", color: "#f87171", fontSize: 12 }}>{error}</div>}

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && services.length === 0 && (
          <div style={{ color: "var(--pn-text-muted)", fontSize: 12, textAlign: "center", marginTop: 24 }}>Loading services...</div>
        )}
        {services.map((s) => (
          <ServiceCard
            key={s.id}
            service={s}
            onStart={() => startService(s.id)}
            onStop={() => stopService(s.id)}
            onRestart={() => restartService(s.id)}
          />
        ))}
        {!loading && services.length === 0 && (
          <div style={{ color: "var(--pn-text-muted)", fontSize: 13, textAlign: "center", marginTop: 32 }}>No services configured</div>
        )}
      </div>
    </div>
  );
}
