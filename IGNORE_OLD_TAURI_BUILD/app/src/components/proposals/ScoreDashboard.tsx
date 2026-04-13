import { useMemo } from "react";
import { useProposalsStore } from "@/stores/proposals-store";
import type { Proposal } from "@/types/proposals";

function combinedRank(p: Proposal): number {
  const idea = p.idea_score ?? 0;
  const prompt = p.prompt_quality_score ?? 0;
  return (idea + prompt) / 2;
}

interface DimensionStats {
  readonly label: string;
  readonly color: string;
  readonly avg: number;
  readonly min: number;
  readonly max: number;
}

export function ScoreDashboard() {
  const proposals = useProposalsStore((s) => s.proposals);

  const scored = useMemo(
    () => proposals.filter((p) => p.idea_score != null),
    [proposals]
  );

  const stats = useMemo(() => {
    if (scored.length === 0) return null;

    const avgIdea = avg(scored.map((p) => p.idea_score ?? 0));
    const avgPrompt = avg(scored.map((p) => p.prompt_quality_score ?? 0));
    const avgRank = avg(scored.map(combinedRank));

    const dimensions: readonly DimensionStats[] = [
      buildDimension("Coverage", "#6b95f0", scored, "codebase_coverage"),
      buildDimension("Coherence", "#a78bfa", scored, "architectural_coherence"),
      buildDimension("Impact", "#22c55e", scored, "impact"),
      buildDimension("Specificity", "#f59e0b", scored, "prompt_specificity"),
    ];

    const distribution = [0, 0, 0, 0, 0]; // 0-2, 2-4, 4-6, 6-8, 8-10
    for (const p of scored) {
      const rank = combinedRank(p);
      const bucket = Math.min(Math.floor(rank / 2), 4);
      distribution[bucket]++;
    }

    return { avgIdea, avgPrompt, avgRank, dimensions, distribution };
  }, [scored]);

  if (scored.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-muted)" }}
        >
          No scored proposals yet
        </span>
      </div>
    );
  }

  if (!stats) return null;

  const bucketLabels = ["0–2", "2–4", "4–6", "6–8", "8–10"];
  const maxBucket = Math.max(...stats.distribution, 1);

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Scored" value={String(scored.length)} color="#6b95f0" />
        <StatCard
          label="Avg Idea"
          value={stats.avgIdea.toFixed(1)}
          color="#22c55e"
        />
        <StatCard
          label="Avg Prompt"
          value={stats.avgPrompt.toFixed(1)}
          color="#f59e0b"
        />
        <StatCard
          label="Avg Rank"
          value={stats.avgRank.toFixed(1)}
          color="#a78bfa"
        />
      </div>

      {/* Dimension Breakdown */}
      <div className="glass-surface rounded-lg p-3">
        <span
          className="text-[0.65rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Dimension Averages
        </span>
        <div className="flex flex-col gap-2 mt-2">
          {stats.dimensions.map((dim) => (
            <div key={dim.label} className="flex items-center gap-2">
              <span
                className="text-[0.65rem] w-20 shrink-0"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {dim.label}
              </span>
              <div
                className="flex-1 h-2 rounded-full overflow-hidden relative"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {/* Range bar (min to max) */}
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    left: `${(dim.min / 10) * 100}%`,
                    width: `${((dim.max - dim.min) / 10) * 100}%`,
                    background: `${dim.color}30`,
                  }}
                />
                {/* Average indicator */}
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(dim.avg / 10) * 100}%`,
                    background: dim.color,
                    opacity: 0.8,
                  }}
                />
              </div>
              <span
                className="text-[0.6rem] w-14 text-right font-medium"
                style={{ color: dim.color }}
              >
                {dim.avg.toFixed(1)}
                <span style={{ color: "var(--pn-text-muted)" }}>
                  {" "}
                  / 10
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Score Distribution */}
      <div className="glass-surface rounded-lg p-3">
        <span
          className="text-[0.65rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Score Distribution
        </span>
        <div className="flex items-end gap-1.5 mt-3 h-20">
          {stats.distribution.map((count, i) => {
            const height = (count / maxBucket) * 100;
            const bucketColor =
              i <= 1 ? "#ef4444" : i === 2 ? "#f59e0b" : "#22c55e";

            return (
              <div
                key={bucketLabels[i]}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span
                  className="text-[0.55rem] font-medium"
                  style={{ color: "var(--pn-text-secondary)" }}
                >
                  {count}
                </span>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(height, 4)}%`,
                    background: `${bucketColor}60`,
                    border: `1px solid ${bucketColor}40`,
                    borderBottom: "none",
                  }}
                />
                <span
                  className="text-[0.5rem]"
                  style={{ color: "var(--pn-text-muted)" }}
                >
                  {bucketLabels[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Proposals */}
      <div className="glass-surface rounded-lg p-3">
        <span
          className="text-[0.65rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Top 5 by Combined Rank
        </span>
        <div className="flex flex-col gap-1.5 mt-2">
          {[...scored]
            .sort((a, b) => combinedRank(b) - combinedRank(a))
            .slice(0, 5)
            .map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span
                  className="text-[0.6rem] w-4 shrink-0 font-medium"
                  style={{ color: "var(--pn-text-muted)" }}
                >
                  #{i + 1}
                </span>
                <span
                  className="text-[0.65rem] flex-1 truncate"
                  style={{ color: "var(--pn-text-primary)" }}
                >
                  {p.title}
                </span>
                <span
                  className="text-[0.6rem] font-medium shrink-0"
                  style={{ color: "#a78bfa" }}
                >
                  {combinedRank(p).toFixed(1)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="glass-surface rounded-lg p-2.5 flex flex-col items-center gap-0.5"
      style={{ border: `1px solid ${color}20` }}
    >
      <span className="text-[1rem] font-semibold" style={{ color }}>
        {value}
      </span>
      <span
        className="text-[0.55rem] uppercase tracking-wider"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

function buildDimension(
  label: string,
  color: string,
  proposals: readonly Proposal[],
  key: string
): DimensionStats {
  const values = proposals
    .map((p) => {
      const bd = p.score_breakdown;
      if (!bd) return null;
      const val = bd[key];
      return typeof val === "number" ? val : null;
    })
    .filter((v): v is number => v != null);

  if (values.length === 0) {
    return { label, color, avg: 0, min: 0, max: 0 };
  }

  return {
    label,
    color,
    avg: avg(values),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function avg(nums: readonly number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
