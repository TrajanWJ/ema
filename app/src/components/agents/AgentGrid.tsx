import type { Agent } from "@/types/agents";

const STATUS_COLORS: Record<Agent["status"], string> = {
  active: "#22c55e",
  inactive: "var(--pn-text-tertiary)",
  error: "#ef4444",
};

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
          <div className="flex items-center gap-2">
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
          </div>
        </button>
      ))}
    </div>
  );
}
