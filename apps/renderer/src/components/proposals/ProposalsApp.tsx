import { useEffect, useMemo, useState } from "react";

import {
  ActivityTimeline,
  AppWindowChrome,
  GlassButton,
  GlassSurface,
  HeroBanner,
  InspectorSection,
  InspectorWorkspaceShell,
  MetricCard,
  StatStrip,
  TagPill,
  TopNavBar,
} from "@ema/glass";

import { useExecutionStore } from "@/stores/execution-store";
import { useEvolutionStore } from "@/stores/evolution-store";
import { useProposalsStore } from "@/stores/proposals-store";
import { APP_CONFIGS } from "@/types/workspace";
import { EngineStatus } from "./EngineStatus";
import { ProposalCard } from "./ProposalCard";
import { ProposalLineage } from "./ProposalLineage";
import { ProposalQueue } from "./ProposalQueue";
import { ScoreDashboard } from "./ScoreDashboard";
import { SeedList } from "./SeedList";

const config = APP_CONFIGS.proposals;

type Tab = "queue" | "lineage" | "evolution" | "seeds" | "scores" | "engine";

const TAB_OPTIONS: readonly {
  readonly id: Tab;
  readonly label: string;
  readonly hint: string;
}[] = [
  { id: "queue", label: "Queue", hint: "Live review queue" },
  { id: "lineage", label: "Lineage", hint: "Proposal ancestry" },
  { id: "evolution", label: "Evolution", hint: "Rule-linked work" },
  { id: "seeds", label: "Seeds", hint: "Recurring generators" },
  { id: "scores", label: "Scores", hint: "Rank quality" },
  { id: "engine", label: "Engine", hint: "Pipeline posture" },
] as const;

export function ProposalsApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("queue");
  const [generating, setGenerating] = useState(false);

  const proposals = useProposalsStore((s) => s.proposals);
  const seeds = useProposalsStore((s) => s.seeds);
  const connected = useProposalsStore((s) => s.connected);
  const executions = useExecutionStore((s) => s.executions);
  const rules = useEvolutionStore((s) => s.rules);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await Promise.all([
          useProposalsStore.getState().loadViaRest(),
          useProposalsStore.getState().loadSeeds(),
          useExecutionStore.getState().loadViaRest(),
          useEvolutionStore.getState().loadRules().catch(() => {}),
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load proposals");
        }
      }

      if (!cancelled) {
        setReady(true);
      }

      useProposalsStore.getState().connect().catch(() => {
        console.warn("Proposals WebSocket failed, using REST");
      });
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const queuedCount = proposals.filter((proposal) => proposal.status === "queued").length;
  const reviewingCount = proposals.filter((proposal) => proposal.status === "reviewing").length;
  const approvedCount = proposals.filter((proposal) => proposal.status === "approved").length;
  const activeSeeds = seeds.filter((seed) => seed.active).length;
  const lineageCount = proposals.filter(
    (proposal) => proposal.parent_proposal_id !== null || proposal.children_count > 0,
  ).length;
  const activeRuleCount = rules.filter((rule) => rule.status === "active").length;

  const recentTimeline = useMemo(
    () =>
      [...proposals]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 6)
        .map((proposal) => ({
          id: proposal.id,
          title: proposal.title,
          meta: `${proposal.status.replace(/_/g, " ")} · rev ${proposal.revision}`,
          body: proposal.summary || "Proposal created without summary text.",
          tone:
            proposal.status === "approved"
              ? "var(--color-pn-success)"
              : proposal.status === "killed" || proposal.status === "failed"
                ? "var(--color-pn-error)"
                : proposal.status === "reviewing"
                  ? "var(--color-pn-warning)"
                  : "var(--color-pn-purple-400)",
        })),
    [proposals],
  );

  const seedTags = seeds.slice(0, 6).map((seed) => ({
    id: seed.id,
    label: seed.name,
    tone: seed.active ? "rgba(45,212,168,0.14)" : "rgba(255,255,255,0.05)",
    color: seed.active ? "var(--color-pn-teal-300)" : "var(--pn-text-secondary)",
  }));

  const featuredProposal = proposals
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  async function handleGenerate() {
    const activeSeed = seeds.find((seed) => seed.active);
    setGenerating(true);
    setError(null);

    try {
      if (!activeSeed) {
        throw new Error("Proposal creation now starts from a concrete intent. Seed-driven generation is deferred.");
      }

      throw new Error(
        `Seed ${activeSeed.name} is only a supporting input. Create a durable proposal from a runtime intent instead.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="proposals" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <InspectorWorkspaceShell
      appId="proposals"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      nav={
        <TopNavBar
          items={TAB_OPTIONS}
          activeId={tab}
          onChange={(value) => setTab(value as Tab)}
          leftSlot={
            <div>
              <div
                style={{
                  fontSize: "0.66rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "var(--pn-text-muted)",
                }}
              >
                Proposal Engine
              </div>
              <div style={{ fontSize: "1.08rem", fontWeight: 650 }}>
                Proposals
              </div>
            </div>
          }
          rightSlot={
            <>
              <TagPill
                label={connected ? "live queue" : "rest fallback"}
                tone={connected ? "rgba(34,197,94,0.14)" : "rgba(245,158,11,0.14)"}
                color={connected ? "var(--color-pn-success)" : "var(--color-pn-warning)"}
              />
              <GlassButton uiSize="sm" variant="primary" onClick={handleGenerate} disabled={generating}>
                {generating ? "Checking..." : "Intent Required"}
              </GlassButton>
            </>
          }
        />
      }
      hero={
        <HeroBanner
          eyebrow="List Detail Monitor"
          title="Keep proposal flow inspectable before it becomes automatic."
          description="This surface tracks queue pressure, lineage, recurring seeds, and scoring posture. Proposal generation is still intent-led, so the UI should expose context and constraints instead of pretending autonomy exists already."
          tone="var(--color-pn-purple-400)"
          actions={
            <>
              <TagPill label={`${queuedCount} queued`} tone="rgba(107,149,240,0.14)" color="var(--color-pn-blue-300)" />
              <TagPill label={`${reviewingCount} reviewing`} tone="rgba(245,158,11,0.14)" color="var(--color-pn-warning)" />
              <TagPill label={`${activeSeeds} active seeds`} tone="rgba(45,212,168,0.14)" color="var(--color-pn-teal-300)" />
            </>
          }
          aside={
            <div style={{ display: "grid", gap: "var(--pn-space-3)" }}>
              <MetricCard
                label="Proposals"
                value={String(proposals.length)}
                detail="Durable queue entries visible now."
                tone="var(--color-pn-purple-400)"
              />
              <MetricCard
                label="Executions"
                value={String(executions.length)}
                detail="Linked runtime work across proposal outcomes."
                tone="var(--color-pn-blue-400)"
              />
            </div>
          }
        />
      }
      content={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)" }}>
          <StatStrip
            items={[
              {
                label: "Queued",
                value: String(queuedCount),
                detail: "Pending durable review",
                tone: "var(--color-pn-blue-400)",
              },
              {
                label: "Approved",
                value: String(approvedCount),
                detail: "Ready to drive work",
                tone: "var(--color-pn-success)",
              },
              {
                label: "Lineage",
                value: String(lineageCount),
                detail: "Entries with ancestry context",
                tone: "var(--color-pn-indigo-400)",
              },
              {
                label: "Active Rules",
                value: String(activeRuleCount),
                detail: "Evolution rules in effect",
                tone: "var(--color-pn-teal-400)",
              },
            ]}
          />

          {error && (
            <GlassSurface tier="surface" padding="md">
              <div style={{ color: "var(--color-pn-error)", fontSize: "0.8rem", lineHeight: 1.5 }}>
                {error}
              </div>
            </GlassSurface>
          )}

          <GlassSurface tier="surface" padding="lg">
            <div style={{ minHeight: 560 }}>
              {tab === "queue" && <ProposalQueue />}
              {tab === "lineage" && <ProposalLineage />}
              {tab === "evolution" && <EvolutionProposals />}
              {tab === "seeds" && <SeedList />}
              {tab === "scores" && <ScoreDashboard />}
              {tab === "engine" && <EngineStatus />}
            </div>
          </GlassSurface>
        </div>
      }
      inspector={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)" }}>
          <InspectorSection
            title="Recent Proposal Activity"
            description="Newest items and status shifts in the durable queue."
          >
            <ActivityTimeline items={recentTimeline} emptyLabel="No proposals have landed yet." />
          </InspectorSection>

          <InspectorSection
            title="Seed Posture"
            description="Recurring generators currently attached to the proposal system."
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--pn-space-2)" }}>
              {seedTags.length > 0 ? (
                seedTags.map((seed) => (
                  <TagPill
                    key={seed.id}
                    label={seed.label}
                    tone={seed.tone}
                    color={seed.color}
                  />
                ))
              ) : (
                <div style={{ color: "var(--pn-text-muted)", fontSize: "0.78rem" }}>
                  No seeds configured yet.
                </div>
              )}
            </div>
          </InspectorSection>

          <InspectorSection
            title="Featured Proposal"
            description="Most recent durable proposal entry for quick inspection."
          >
            {featuredProposal ? (
              <ProposalCard proposal={featuredProposal} />
            ) : (
              <div style={{ color: "var(--pn-text-muted)", fontSize: "0.78rem" }}>
                No proposal selected yet.
              </div>
            )}
          </InspectorSection>
        </div>
      }
    />
  );
}

function EvolutionProposals() {
  const proposals = useProposalsStore((s) => s.proposals);
  const rules = useEvolutionStore((s) => s.rules);

  const ruleProposalIds = new Set(rules.map((rule) => rule.proposal_id).filter(Boolean));
  const evolutionProposals = proposals.filter(
    (proposal) =>
      ruleProposalIds.has(proposal.id) ||
      (proposal.tags ?? []).some((tag) => tag.label === "evolution"),
  );

  const activeRuleCount = rules.filter((rule) => rule.status === "active").length;

  return (
    <div className="flex flex-col gap-3">
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
