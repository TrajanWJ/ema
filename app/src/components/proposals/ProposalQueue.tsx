import { useMemo } from "react";
import { useProposalsStore } from "@/stores/proposals-store";
import { ProposalCard } from "./ProposalCard";
import type { Proposal, ProposalSortKey, ProposalSortDir } from "@/types/proposals";

function combinedRank(p: Proposal): number {
  const idea = p.idea_score ?? 0;
  const prompt = p.prompt_quality_score ?? 0;
  return (idea + prompt) / 2;
}

function getSortValue(p: Proposal, key: ProposalSortKey): number {
  switch (key) {
    case "idea_score":
      return p.idea_score ?? 0;
    case "prompt_quality_score":
      return p.prompt_quality_score ?? 0;
    case "combined_rank":
      return combinedRank(p);
    case "confidence":
      return p.confidence ?? 0;
    case "created_at":
      return new Date(p.created_at).getTime();
  }
}

const SORT_OPTIONS: readonly { readonly value: ProposalSortKey; readonly label: string }[] = [
  { value: "combined_rank", label: "Rank" },
  { value: "idea_score", label: "Idea Score" },
  { value: "prompt_quality_score", label: "Prompt Quality" },
  { value: "confidence", label: "Confidence" },
  { value: "created_at", label: "Date" },
];

export function ProposalQueue() {
  const proposals = useProposalsStore((s) => s.proposals);
  const sortKey = useProposalsStore((s) => s.sortKey);
  const sortDir = useProposalsStore((s) => s.sortDir);
  const filterMinScore = useProposalsStore((s) => s.filterMinScore);
  const setSortKey = useProposalsStore((s) => s.setSortKey);
  const setSortDir = useProposalsStore((s) => s.setSortDir);
  const setFilterMinScore = useProposalsStore((s) => s.setFilterMinScore);

  const sorted = useMemo(() => {
    const queued = proposals.filter(
      (p) => p.status === "queued" || p.status === "reviewing"
    );

    const filtered =
      filterMinScore > 0
        ? queued.filter((p) => combinedRank(p) >= filterMinScore)
        : queued;

    return [...filtered].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [proposals, sortKey, sortDir, filterMinScore]);

  return (
    <div className="flex flex-col gap-2">
      {/* Sort & Filter Controls */}
      <div
        className="flex items-center gap-3 px-1 py-2"
        style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="text-[0.6rem] uppercase tracking-wider"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Sort
          </span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as ProposalSortKey)}
            className="text-[0.65rem] rounded px-1.5 py-1"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            className="text-[0.7rem] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-secondary)",
            }}
            title={sortDir === "desc" ? "Descending" : "Ascending"}
          >
            {sortDir === "desc" ? "↓" : "↑"}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="text-[0.6rem] uppercase tracking-wider"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Min Score
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(Number(e.target.value))}
            className="w-16 h-1 accent-purple-400"
          />
          <span
            className="text-[0.6rem] w-4 text-right"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            {filterMinScore > 0 ? filterMinScore.toFixed(1) : "—"}
          </span>
        </div>

        <span
          className="text-[0.6rem] ml-auto"
          style={{ color: "var(--pn-text-muted)" }}
        >
          {sorted.length} proposal{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span
            className="text-[0.75rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {filterMinScore > 0
              ? "No proposals above minimum score"
              : "No proposals in queue"}
          </span>
        </div>
      ) : (
        sorted.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))
      )}
    </div>
  );
}
