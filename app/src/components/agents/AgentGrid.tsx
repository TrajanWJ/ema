import { useState } from "react";
import type { Agent, TrustScore } from "@/types/agents";

const STATUS_COLORS: Record<Agent["status"], string> = {
  active: "#22c55e",
  inactive: "var(--pn-text-tertiary)",
  error: "#ef4444",
};

const TRUST_COLORS: Record<string, string> = {
  emerald: "#10b981",
  teal: "#2dd4a8",
  amber: "#f59e0b",
  red: "#ef4444",
  gray: "var(--pn-text-tertiary)",
};

function TrustBadge({ trust }: { trust: TrustScore }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const color = TRUST_COLORS[trust.color] ?? TRUST_COLORS.gray;

  return (
    <div className="relative">
      <span
        className="text-[0.55rem] px-1.5 py-0.5 rounded font-medium cursor-default"
        style={{ background: `${color}20`, color }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {trust.score} {trust.label}
      </span>
      {showTooltip && (
        <div
          className="absolute z-50 bottom-full left-0 mb-1 p-2 rounded-lg text-[0.6rem] whitespace-nowrap"
          style={{ background: "var(--color-pn-surface-2)", border: "1px solid var(--pn-border-default)" }}
        >
          <div style={{ color: "var(--pn-text-secondary)" }}>
            Completion: {(trust.completion_rate * 100).toFixed(0)}%
          </div>
          <div style={{ color: "var(--pn-text-secondary)" }}>
            Avg latency: {trust.avg_latency_ms}ms
          </div>
          <div style={{ color: "var(--pn-text-secondary)" }}>
            Errors: {trust.error_count}
          </div>
          <div style={{ color: "var(--pn-text-secondary)" }}>
            Sessions: {trust.session_count}
          </div>
          <div style={{ color: "var(--pn-text-secondary)" }}>
            Active: {trust.days_active}d
          </div>
        </div>
      )}
    </div>
  );
}

interface AgentGridProps {
  readonly agents: readonly Agent[];
  readonly onSelect: (id: string) => void;
}

export function AgentGrid({ agents, onSelect }: AgentGridProps) {
  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          No agents yet. Create one to get started.
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelect(agent.id)}
          className="glass-surface rounded-lg p-3 text-left transition-colors hover:bg-white/5"
        >
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: "1.2rem" }}>
              {agent.avatar ?? "\u2B21"}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="text-[0.8rem] font-medium truncate"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {agent.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="rounded-full"
                  style={{
                    width: "6px",
                    height: "6px",
                    background: STATUS_COLORS[agent.status],
                  }}
                />
                <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                  {agent.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[0.6rem] px-1.5 py-0.5 rounded-md font-mono"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                color: "var(--pn-text-tertiary)",
              }}
            >
              {agent.model}
            </span>
            {(agent.tools ?? []).length > 0 && (
              <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                {(agent.tools ?? []).length} tools
              </span>
            )}
            {agent.trust_score && <TrustBadge trust={agent.trust_score} />}
          </div>
        </button>
      ))}
    </div>
  );
}
