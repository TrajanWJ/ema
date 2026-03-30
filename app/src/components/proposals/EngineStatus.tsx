import { useState, useEffect } from "react";
import { useProposalsStore } from "@/stores/proposals-store";
import { api } from "@/lib/api";

interface EngineStatusData {
  readonly queue_depth: number;
  readonly reviewing_count: number;
  readonly approved_count: number;
  readonly active_seeds: number;
}

const PIPELINE_STAGES = [
  { key: "seeding", label: "Seeding", color: "#a78bfa" },
  { key: "generating", label: "Generating", color: "#6b95f0" },
  { key: "refining", label: "Refining", color: "#2dd4a8" },
  { key: "reviewing", label: "Reviewing", color: "#f59e0b" },
] as const;

export function EngineStatus() {
  const proposals = useProposalsStore((s) => s.proposals);
  const seeds = useProposalsStore((s) => s.seeds);
  const [serverStatus, setServerStatus] = useState<EngineStatusData | null>(null);

  useEffect(() => {
    api
      .get<EngineStatusData>("/engine/status")
      .then(setServerStatus)
      .catch(() => {
        // Fall back to client-side counts
      });
  }, []);

  // Use server data when available, fall back to client-side counts
  const queueDepth = serverStatus?.queue_depth ?? proposals.filter((p) => p.status === "queued").length;
  const reviewingCount = serverStatus?.reviewing_count ?? proposals.filter((p) => p.status === "reviewing").length;
  const approvedCount = serverStatus?.approved_count ?? proposals.filter((p) => p.status === "approved").length;
  const activeSeeds = serverStatus?.active_seeds ?? seeds.filter((s) => s.active).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Pipeline stages */}
      <div>
        <span
          className="text-[0.65rem] font-medium uppercase tracking-wider block mb-3"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Pipeline
        </span>
        <div className="flex items-center gap-1">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.key} className="flex items-center gap-1 flex-1">
              <div
                className="flex-1 rounded-md p-2.5 text-center"
                style={{
                  background: `${stage.color}10`,
                  border: `1px solid ${stage.color}25`,
                }}
              >
                <span
                  className="text-[0.6rem] font-medium block"
                  style={{ color: stage.color }}
                >
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <span
                  className="text-[0.6rem] shrink-0"
                  style={{ color: "var(--pn-text-muted)" }}
                >
                  &rarr;
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Queue Depth" value={queueDepth} color="#a78bfa" />
        <StatCard label="In Review" value={reviewingCount} color="#f59e0b" />
        <StatCard label="Approved" value={approvedCount} color="#22c55e" />
        <StatCard label="Active Seeds" value={activeSeeds} color="#6b95f0" />
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
  value: number;
  color: string;
}) {
  return (
    <div
      className="glass-surface rounded-lg p-3"
      style={{ border: "1px solid var(--pn-border-subtle)" }}
    >
      <span
        className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-[1.2rem] font-semibold"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
