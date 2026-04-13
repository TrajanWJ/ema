import { useMemo, useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useProposalsStore } from "@/stores/proposals-store";
import { ProposalCard } from "./ProposalCard";
import { ProposalComparison } from "./ProposalComparison";
import { GlassSelect } from "@/components/ui/GlassSelect";
import type { Proposal, ProposalSortKey } from "@/types/proposals";

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

const SORT_OPTIONS: readonly {
  readonly value: ProposalSortKey;
  readonly label: string;
}[] = [
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
  const selectedForComparison = useProposalsStore(
    (s) => s.selectedForComparison,
  );
  const toggleComparisonSelection = useProposalsStore(
    (s) => s.toggleComparisonSelection,
  );
  const clearComparisonSelection = useProposalsStore(
    (s) => s.clearComparisonSelection,
  );
  const compareProposals = useProposalsStore((s) => s.compareProposals);

  const [comparing, setComparing] = useState(false);
  const [comparisonProposals, setComparisonProposals] = useState<Proposal[]>(
    [],
  );
  const [loadingCompare, setLoadingCompare] = useState(false);

  const sorted = useMemo(() => {
    const queued = proposals.filter(
      (p) => p.status === "queued" || p.status === "reviewing",
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

  async function handleCompare() {
    if (selectedForComparison.length < 2) return;
    setLoadingCompare(true);
    try {
      const fetched = await compareProposals(selectedForComparison);
      setComparisonProposals(fetched);
      setComparing(true);
    } finally {
      setLoadingCompare(false);
    }
  }

  function handleBack() {
    setComparing(false);
    setComparisonProposals([]);
    clearComparisonSelection();
  }

  if (comparing) {
    return (
      <ProposalComparison
        proposals={comparisonProposals}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Sort & Filter Controls */}
      <div
        className="flex items-center gap-3 px-1 py-2 flex-wrap shrink-0"
        style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="text-[0.6rem] uppercase tracking-wider"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Sort
          </span>
          <GlassSelect
            value={sortKey}
            onChange={(val) => setSortKey(val as ProposalSortKey)}
            options={SORT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            size="sm"
          />
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
            {sortDir === "desc" ? "\u2193" : "\u2191"}
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
            {filterMinScore > 0 ? filterMinScore.toFixed(1) : "\u2014"}
          </span>
        </div>

        {/* Compare controls */}
        {selectedForComparison.length > 0 ? (
          <div className="flex items-center gap-1.5 ml-auto">
            <span
              className="text-[0.6rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {selectedForComparison.length} selected
            </span>
            <button
              onClick={handleCompare}
              disabled={selectedForComparison.length < 2 || loadingCompare}
              className="text-[0.65rem] font-medium px-2 py-1 rounded transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#818cf8",
              }}
            >
              {loadingCompare ? "Loading..." : "Compare Selected"}
            </button>
            <button
              onClick={clearComparisonSelection}
              className="text-[0.6rem] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--pn-border-subtle)",
                color: "var(--pn-text-muted)",
              }}
            >
              {"\u2715"}
            </button>
          </div>
        ) : (
          <span
            className="text-[0.6rem] ml-auto"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {sorted.length} proposal{sorted.length !== 1 ? "s" : ""}
          </span>
        )}
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
        <ProposalVirtualList
          sorted={sorted}
          selectedForComparison={selectedForComparison}
          toggleComparisonSelection={toggleComparisonSelection}
        />
      )}
    </div>
  );
}

function ProposalVirtualList({
  sorted,
  selectedForComparison,
  toggleComparisonSelection,
}: {
  readonly sorted: readonly Proposal[];
  readonly selectedForComparison: readonly string[];
  readonly toggleComparisonSelection: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto"
      style={{ minHeight: 0, maxHeight: "100%" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const proposal = sorted[virtualRow.index];
          return (
            <div
              key={proposal.id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="flex items-start gap-2 pb-2">
                <label className="flex items-center pt-3 pl-1 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedForComparison.includes(proposal.id)}
                    onChange={() => toggleComparisonSelection(proposal.id)}
                    disabled={
                      !selectedForComparison.includes(proposal.id) &&
                      selectedForComparison.length >= 3
                    }
                    className="w-3 h-3 accent-indigo-400 cursor-pointer"
                    title="Select for comparison"
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <ProposalCard proposal={proposal} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
