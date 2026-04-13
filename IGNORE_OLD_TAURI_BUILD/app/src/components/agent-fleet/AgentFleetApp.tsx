import { useEffect } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useAgentFleetStore } from "@/stores/agent-fleet-store";
import type { FleetAgent } from "@/stores/agent-fleet-store";

const STATUS_COLORS: Record<FleetAgent["status"], string> = {
  active: "#2dd4a8",
  idle: "#6b7280",
  crashed: "#ef4444",
  completed: "#6b95f0",
};

const STATUS_LABELS: Record<FleetAgent["status"], string> = {
  active: "Active",
  idle: "Idle",
  crashed: "Crashed",
  completed: "Completed",
};

function formatRuntime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m < 60 ? `${m}m ${s}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function HealthBar() {
  const health = useAgentFleetStore((s) => s.health);
  const total = health.active + health.idle + health.crashed + health.completed;
  const segments: Array<{ key: FleetAgent["status"]; count: number }> = [
    { key: "active", count: health.active },
    { key: "idle", count: health.idle },
    { key: "crashed", count: health.crashed },
    { key: "completed", count: health.completed },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: "0.75rem" }}>
        {segments.map((s) => (
          <span key={s.key} style={{ color: STATUS_COLORS[s.key] }}>
            {STATUS_LABELS[s.key]}: {s.count}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
        {total > 0 && segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              style={{ flex: s.count, background: STATUS_COLORS[s.key], opacity: 0.8 }}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, selected, onSelect }: {
  readonly agent: FleetAgent;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const color = STATUS_COLORS[agent.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        background: selected ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${selected ? "rgba(45,212,168,0.3)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 10,
        padding: 14,
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.15s",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block",
            boxShadow: agent.status === "active" ? `0 0 6px ${color}` : "none",
            animation: agent.status === "active" ? "pulse 2s ease-in-out infinite" : "none",
          }}
        />
        <span style={{ color: "var(--pn-text-primary)", fontSize: "0.85rem", fontWeight: 500 }}>
          {agent.name}
        </span>
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--pn-text-secondary)", marginBottom: 4 }}>
        {agent.current_task ?? "Idle"}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: "0.7rem", color: "var(--pn-text-muted)" }}>
        <span>{formatRuntime(agent.runtime_seconds)}</span>
        <span>{formatTokens(agent.token_count)} tokens</span>
      </div>
      {agent.trust_score && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{
            fontSize: "0.65rem", fontWeight: 600, padding: "2px 6px",
            borderRadius: 4, background: `${agent.trust_score.color}20`, color: agent.trust_score.color,
          }}>
            Trust: {agent.trust_score.score}
          </span>
          <span style={{ fontSize: "0.6rem", color: "var(--pn-text-muted)" }}>
            {agent.trust_score.session_count} sessions
          </span>
        </div>
      )}
      {agent.project && (
        <span style={{
          display: "inline-block", marginTop: 8, fontSize: "0.65rem", padding: "2px 8px",
          borderRadius: 4, background: "rgba(107,149,240,0.15)", color: "#6b95f0",
        }}>
          {agent.project}
        </span>
      )}
    </button>
  );
}

function ControlsRow() {
  const btnStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: "0.75rem",
    color: "var(--pn-text-secondary)",
    cursor: "pointer",
    transition: "background 0.15s",
  };

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button type="button" style={{ ...btnStyle, color: "#2dd4a8" }}>Dispatch All Pending</button>
      <button type="button" style={{ ...btnStyle, color: "#f59e0b" }}>Pause All</button>
      <button type="button" style={{ ...btnStyle, color: "#ef4444" }}>Kill All Idle</button>
    </div>
  );
}

function DetailPanel({ agent, onClose }: { readonly agent: FleetAgent; readonly onClose: () => void }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: 16, marginTop: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: "var(--pn-text-primary)", fontWeight: 500 }}>{agent.name}</span>
        <button
          type="button" onClick={onClose}
          style={{ background: "none", border: "none", color: "var(--pn-text-muted)", cursor: "pointer", fontSize: "0.85rem" }}
        >
          Close
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: "0.75rem", color: "var(--pn-text-secondary)", marginBottom: 12, flexWrap: "wrap" }}>
        <span>Status: <span style={{ color: STATUS_COLORS[agent.status] }}>{STATUS_LABELS[agent.status]}</span></span>
        <span>Runtime: {formatRuntime(agent.runtime_seconds)}</span>
        <span>Tokens: {formatTokens(agent.token_count)}</span>
        {agent.trust_score && (
          <span>Trust: <span style={{ color: agent.trust_score.color }}>{agent.trust_score.score} ({agent.trust_score.label})</span></span>
        )}
        {agent.model && <span>Model: {agent.model}</span>}
      </div>
      <div style={{
        background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: 12, height: 180, overflowY: "auto",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "0.7rem",
        color: "var(--pn-text-muted)", whiteSpace: "pre-wrap",
      }}>
        Agent logs will appear here...
      </div>
    </div>
  );
}

export function AgentFleetApp() {
  const agents = useAgentFleetStore((s) => s.agents);
  const loading = useAgentFleetStore((s) => s.loading);
  const selectedAgent = useAgentFleetStore((s) => s.selectedAgent);
  const selectAgent = useAgentFleetStore((s) => s.selectAgent);

  useEffect(() => {
    useAgentFleetStore.getState().loadFleet();
    const interval = setInterval(() => {
      useAgentFleetStore.getState().loadFleet();
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  const selected = agents.find((a) => a.id === selectedAgent) ?? null;

  return (
    <AppWindowChrome appId="agent-fleet" title="Agent Fleet" icon="⬡" accent="#2dd4a8">
      <div style={{ padding: 20, height: "100%", overflowY: "auto", background: "rgba(8,9,14,0.95)" }}>
        <HealthBar />
        <ControlsRow />
        {loading && agents.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--pn-text-secondary)", fontSize: "0.8rem" }}>
            Loading fleet...
          </div>
        )}
        {!loading && agents.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--pn-text-muted)", fontSize: "0.8rem" }}>
            No agents registered. Create agents in the Agents app first.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedAgent}
              onSelect={() => selectAgent(agent.id === selectedAgent ? null : agent.id)}
            />
          ))}
        </div>
        {selected && <DetailPanel agent={selected} onClose={() => selectAgent(null)} />}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </AppWindowChrome>
  );
}
