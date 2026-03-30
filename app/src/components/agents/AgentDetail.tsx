import { useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AgentChat } from "./AgentChat";
import type { Agent } from "@/types/agents";

const TABS = [
  { value: "chat" as const, label: "Chat" },
  { value: "settings" as const, label: "Settings" },
] as const;

type Tab = typeof TABS[number]["value"];

const STATUS_COLORS: Record<Agent["status"], string> = {
  active: "#22c55e",
  inactive: "var(--pn-text-tertiary)",
  error: "#ef4444",
};

interface AgentDetailProps {
  readonly agent: Agent;
  readonly onBack: () => void;
}

export function AgentDetail({ agent, onBack }: AgentDetailProps) {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          &larr;
        </button>
        <span style={{ fontSize: "1.4rem" }}>{agent.avatar ?? "\u2B21"}</span>
        <div className="flex-1">
          <div className="text-[0.875rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
            {agent.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="rounded-full"
              style={{ width: "6px", height: "6px", background: STATUS_COLORS[agent.status] }}
            />
            <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              {agent.status} · {agent.model} · t={agent.temperature}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="flex-1 min-h-0">
        {tab === "chat" && <AgentChat agent={agent} />}
        {tab === "settings" && (
          <div className="glass-surface rounded-lg p-4">
            <div className="space-y-3">
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
                  Model
                </span>
                <div className="text-[0.8rem] mt-0.5" style={{ color: "var(--pn-text-primary)" }}>
                  {agent.model}
                </div>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
                  Temperature
                </span>
                <div className="text-[0.8rem] mt-0.5" style={{ color: "var(--pn-text-primary)" }}>
                  {agent.temperature}
                </div>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
                  Max Tokens
                </span>
                <div className="text-[0.8rem] mt-0.5" style={{ color: "var(--pn-text-primary)" }}>
                  {agent.max_tokens}
                </div>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
                  Tools
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {agent.tools.length > 0 ? agent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="text-[0.6rem] px-1.5 py-0.5 rounded-md font-mono"
                      style={{ background: "rgba(255, 255, 255, 0.04)", color: "var(--pn-text-tertiary)" }}
                    >
                      {tool}
                    </span>
                  )) : (
                    <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                      No tools configured
                    </span>
                  )}
                </div>
              </div>
              {agent.description && (
                <div>
                  <span className="text-[0.65rem] uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
                    Description
                  </span>
                  <div className="text-[0.75rem] mt-0.5" style={{ color: "var(--pn-text-secondary)" }}>
                    {agent.description}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
