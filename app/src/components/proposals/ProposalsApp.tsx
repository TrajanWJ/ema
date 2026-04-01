import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProposalQueue } from "./ProposalQueue";
import { SeedList } from "./SeedList";
import { EngineStatus } from "./EngineStatus";
import { ProposalCard } from "./ProposalCard";
import { useProposalsStore } from "@/stores/proposals-store";
import { useEvolutionStore } from "@/stores/evolution-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.proposals;

type Tab = "queue" | "evolution" | "seeds" | "engine";

const TAB_OPTIONS = [
  { value: "queue" as const, label: "Queue" },
  { value: "evolution" as const, label: "Evolution" },
  { value: "seeds" as const, label: "Seeds" },
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
          useEvolutionStore.getState().loadRules().catch(() => {}),
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
          {tab === "evolution" && <EvolutionProposals />}
          {tab === "seeds" && <SeedList />}
          {tab === "engine" && <EngineStatus />}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function EvolutionProposals() {
  const proposals = useProposalsStore((s) => s.proposals);
  const rules = useEvolutionStore((s) => s.rules);

  // Filter proposals linked to evolution rules
  const ruleProposalIds = new Set(rules.map((r) => r.proposal_id).filter(Boolean));
  const evolutionProposals = proposals.filter(
    (p) => ruleProposalIds.has(p.id) || (p.tags ?? []).some((t) => t.label === "evolution")
  );

  const activeRuleCount = rules.filter((r) => r.status === "active").length;

  return (
    <div className="flex flex-col gap-3">
      {/* Evolution summary bar */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg glass-surface">
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full"
            style={{ width: "6px", height: "6px", background: "#22c55e" }}
          />
          <span className="text-[0.6rem]" style={{ color: "var(--pn-text-secondary)" }}>
            {activeRuleCount} active rule{activeRuleCount !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
          {evolutionProposals.length} evolution proposal{evolutionProposals.length !== 1 ? "s" : ""}
        </span>
      </div>

      {evolutionProposals.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
            No evolution proposals yet
          </span>
        </div>
      ) : (
        evolutionProposals.map((proposal) => (
          <div key={proposal.id} style={{ borderLeft: "2px solid #a78bfa", paddingLeft: "8px" }}>
            <ProposalCard proposal={proposal} />
          </div>
        ))
      )}
    </div>
  );
}
