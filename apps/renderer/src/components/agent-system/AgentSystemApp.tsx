import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

interface HealthStatus {
  status: string;
  uptime?: number;
  version?: string;
}

interface VMHealth {
  status: string;
  cpu_percent?: number;
  memory_percent?: number;
}

interface TokenSummary {
  total_tokens?: number;
  total_cost?: number;
  period?: string;
}

interface ServiceTile {
  label: string;
  status: "ok" | "degraded" | "down" | "loading";
  detail: string;
}

const STATUS_COLORS: Record<string, string> = {
  ok: "#22c55e",
  degraded: "#f59e0b",
  down: "#ef4444",
  loading: "rgba(255,255,255,0.2)",
};

export function AgentSystemApp() {
  const [tiles, setTiles] = useState<ServiceTile[]>([
    { label: "Daemon", status: "loading", detail: "Checking..." },
    { label: "VM", status: "loading", detail: "Checking..." },
    { label: "Tokens", status: "loading", detail: "Checking..." },
    { label: "Bridge", status: "loading", detail: "Checking..." },
  ]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<HealthStatus>("/health").then((h): ServiceTile => ({
        label: "Daemon",
        status: h.status === "ok" ? "ok" : "degraded",
        detail: h.uptime != null ? `Up ${Math.round(h.uptime / 60)}m` : h.status,
      })).catch((): ServiceTile => ({ label: "Daemon", status: "down", detail: "Unreachable" })),

      api.get<VMHealth>("/vm/health").then((v): ServiceTile => ({
        label: "VM",
        status: v.status === "ok" ? "ok" : "degraded",
        detail: v.cpu_percent != null ? `CPU ${v.cpu_percent}% · Mem ${v.memory_percent}%` : v.status,
      })).catch((): ServiceTile => ({ label: "VM", status: "down", detail: "Unreachable" })),

      api.get<TokenSummary>("/tokens/summary").then((t): ServiceTile => ({
        label: "Tokens",
        status: "ok",
        detail: t.total_tokens != null ? `${t.total_tokens.toLocaleString()} tokens` : "No data",
      })).catch((): ServiceTile => ({ label: "Tokens", status: "degraded", detail: "No data" })),

      api.get<HealthStatus>("/bridge/health").then((b): ServiceTile => ({
        label: "Bridge",
        status: b.status === "ok" ? "ok" : "degraded",
        detail: b.status,
      })).catch((): ServiceTile => ({ label: "Bridge", status: "degraded", detail: "Not running" })),
    ]).then(setTiles).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <AppWindowChrome appId="agent-system" title="System Pulse" icon="⚙️" accent="#22C55E">
      <div style={{ padding: "16px 20px", overflowY: "auto", height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>System Pulse</div>
          <button onClick={load} disabled={loading}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
            {loading ? "Checking..." : "Refresh"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {tiles.map((tile) => (
            <div key={tile.label}
              style={{
                padding: 20, borderRadius: 12,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: STATUS_COLORS[tile.status],
                  boxShadow: tile.status === "ok" ? `0 0 8px ${STATUS_COLORS.ok}66` : undefined,
                }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.87)" }}>{tile.label}</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>{tile.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </AppWindowChrome>
  );
}
