import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useAgentsStore } from "@/stores/agents-store";
import { APP_CONFIGS } from "@/types/workspace";
import { AgentGrid } from "./AgentGrid";
import { AgentDetail } from "./AgentDetail";
import { AgentForm } from "./AgentForm";

const config = APP_CONFIGS["agents"];

export function AgentsApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const agents = useAgentsStore((s) => s.agents);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await useAgentsStore.getState().loadViaRest();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load agents");
      }
      if (!cancelled) setReady(true);
      useAgentsStore.getState().connect().catch(() => {
        console.warn("Agents WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  if (!ready) {
    return (
      <AppWindowChrome appId="agents" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome
      appId="agents"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={selectedAgent ? selectedAgent.name : "All Agents"}
    >
      {selectedAgent ? (
        <AgentDetail agent={selectedAgent} onBack={() => selectAgent(null)} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[0.875rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
              Agents
            </h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-[0.7rem] px-3 py-1 rounded-md transition-opacity hover:opacity-80"
              style={{ background: "#a78bfa", color: "#fff" }}
            >
              + New
            </button>
          </div>
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
              {error}
            </div>
          )}
          {showForm && <AgentForm onClose={() => setShowForm(false)} />}
          <AgentGrid agents={agents} onSelect={selectAgent} />
        </>
      )}
    </AppWindowChrome>
  );
}
