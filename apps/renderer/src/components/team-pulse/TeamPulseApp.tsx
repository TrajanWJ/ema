import { useEffect } from "react";
import { useTeamPulseStore } from "@/stores/team-pulse-store";
import type { Agent } from "@/stores/team-pulse-store";

const card = {
  background: "rgba(14,16,23,0.55)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
} as const;

const STATUS_COLORS: Record<string, string> = {
  active: "#2DD4A8",
  idle: "#F59E0B",
  error: "#f87171",
};

function SummaryCard({
  label,
  value,
  color,
}: {
  readonly label: string;
  readonly value: number;
  readonly color: string;
}) {
  return (
    <div style={card}>
      <div
        style={{
          color: "var(--pn-text-secondary)",
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ color, fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function AgentCard({ agent }: { readonly agent: Agent }) {
  const statusColor = STATUS_COLORS[agent.status] ?? "var(--pn-text-secondary)";
  return (
    <div style={{ ...card, padding: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusColor,
              display: "inline-block",
            }}
          />
          <span
            style={{
              color: "var(--pn-text-primary)",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {agent.name}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 6,
            background: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {agent.status}
        </span>
      </div>
      {agent.last_active && (
        <div
          style={{
            color: "var(--pn-text-secondary)",
            fontSize: 11,
            marginTop: 6,
            marginLeft: 16,
          }}
        >
          Last active: {new Date(agent.last_active).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function VelocityChart({ daily }: { readonly daily: readonly number[] }) {
  const max = Math.max(...daily, 1);
  const last7 = daily.slice(-7);
  const barColors = ["#2DD4A8", "#6B95F0", "#A78BFA", "#F59E0B", "#38BDF8", "#EC4899", "#2DD4A8"];

  return (
    <div style={card}>
      <div
        style={{
          color: "var(--pn-text-secondary)",
          fontSize: 12,
          fontWeight: 500,
          marginBottom: 12,
        }}
      >
        Velocity (last 7 days)
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          height: 100,
        }}
      >
        {last7.map((count, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 10,
              }}
            >
              {count}
            </span>
            <div
              style={{
                width: "100%",
                height: `${max > 0 ? (count / max) * 80 : 0}px`,
                minHeight: count > 0 ? 4 : 0,
                background: barColors[i % barColors.length],
                borderRadius: 4,
                opacity: 0.8,
              }}
            />
            <span
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 9,
              }}
            >
              D{i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamPulseApp() {
  const { summary, agents, velocity, loading, error, loadViaRest } =
    useTeamPulseStore();

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  if (loading && !summary && agents.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "var(--pn-text-secondary)", fontSize: 13 }}>
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 20,
      }}
    >
      <h2
        style={{
          color: "var(--pn-text-primary)",
          fontSize: 16,
          fontWeight: 600,
          margin: "0 0 16px",
        }}
      >
        Team Pulse
      </h2>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <SummaryCard
          label="Active Agents"
          value={summary?.active_agents ?? 0}
          color="#2DD4A8"
        />
        <SummaryCard
          label="Executions Today"
          value={summary?.executions_today ?? 0}
          color="#6B95F0"
        />
        <SummaryCard
          label="Proposals"
          value={summary?.proposals_today ?? 0}
          color="#F59E0B"
        />
        <SummaryCard
          label="Tasks Done"
          value={summary?.tasks_completed ?? 0}
          color="#A78BFA"
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Agent activity */}
        {agents.length > 0 && (
          <>
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Agent Activity
            </div>
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </>
        )}

        {/* Velocity chart */}
        {velocity && velocity.daily.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <VelocityChart daily={velocity.daily} />
          </div>
        )}

        {!summary && agents.length === 0 && !loading && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No team data yet
          </div>
        )}
      </div>
    </div>
  );
}
