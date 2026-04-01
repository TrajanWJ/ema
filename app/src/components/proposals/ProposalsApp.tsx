import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProposalQueue } from "./ProposalQueue";
import { SeedList } from "./SeedList";
import { EngineStatus } from "./EngineStatus";
import { ScoreDashboard } from "./ScoreDashboard";
import { useProposalsStore } from "@/stores/proposals-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.proposals;

type Tab = "queue" | "seeds" | "scores" | "engine";

const TAB_OPTIONS = [
  { value: "queue" as const, label: "Queue" },
  { value: "seeds" as const, label: "Seeds" },
  { value: "scores" as const, label: "Scores" },
  { value: "engine" as const, label: "Engine" },
] as const;

export function ProposalsApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await Promise.all([
          useProposalsStore.getState().loadViaRest(),
          useProposalsStore.getState().loadSeeds(),
        ]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load proposals");
      }
      if (!cancelled) setReady(true);
      useProposalsStore.getState().connect().catch(() => {
        console.warn("Proposals WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="proposals" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="proposals" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={tab}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-[0.9rem] font-semibold"
            style={{ color: "var(--pn-text-primary)" }}
          >
            Proposals
          </h2>
          <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
        </div>
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {error}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "queue" && <ProposalQueue />}
          {tab === "seeds" && <SeedList />}
          {tab === "scores" && <ScoreDashboard />}
          {tab === "engine" && <EngineStatus />}
        </div>
      </div>
    </AppWindowChrome>
  );
}
