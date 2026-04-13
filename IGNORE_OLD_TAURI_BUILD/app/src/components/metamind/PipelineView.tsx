import { useMetaMindStore } from "@/stores/metamind-store";
import type { PipelineRun, PipelineStage, ExpertDomain } from "@/types/metamind";

const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; icon: string }> = {
  intercepted: { label: "Intercepted", color: "#6b95f0", icon: "\u26A1" },
  reviewing: { label: "Reviewing", color: "#f59e0b", icon: "\u25CE" },
  merging: { label: "Merging", color: "#a78bfa", icon: "\u2727" },
  revised: { label: "Revised", color: "#2dd4a8", icon: "\u2714" },
  dispatched: { label: "Dispatched", color: "#22c55e", icon: "\u2192" },
};

const STAGES: PipelineStage[] = ["intercepted", "reviewing", "merging", "revised", "dispatched"];

function StageNode({ stage, active, completed }: { stage: PipelineStage; active: boolean; completed: boolean }) {
  const config = STAGE_CONFIG[stage];
  const bg = active
    ? `rgba(${hexToRgb(config.color)}, 0.25)`
    : completed
      ? `rgba(${hexToRgb(config.color)}, 0.10)`
      : "rgba(255,255,255,0.03)";

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ opacity: completed || active ? 1 : 0.35 }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[0.8rem] transition-all duration-500"
        style={{
          background: bg,
          border: `1px solid ${active ? config.color : "rgba(255,255,255,0.06)"}`,
          boxShadow: active ? `0 0 12px ${config.color}40` : "none",
        }}
      >
        {config.icon}
      </div>
      <span
        className="text-[0.6rem] font-medium"
        style={{ color: active ? config.color : "var(--pn-text-tertiary)" }}
      >
        {config.label}
      </span>
    </div>
  );
}

function StageLine({ completed }: { completed: boolean }) {
  return (
    <div
      className="flex-1 h-px mt-[-12px] transition-all duration-700"
      style={{
        background: completed
          ? "linear-gradient(90deg, rgba(45,212,168,0.4), rgba(45,212,168,0.15))"
          : "rgba(255,255,255,0.06)",
      }}
    />
  );
}

function PipelineRunCard({ run }: { run: PipelineRun }) {
  const stageIndex = STAGES.indexOf(run.stage);

  return (
    <div className="glass-surface rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        {STAGES.map((stage, i) => (
          <div key={stage} className="contents">
            <StageNode
              stage={stage}
              active={i === stageIndex}
              completed={i < stageIndex}
            />
            {i < STAGES.length - 1 && <StageLine completed={i < stageIndex} />}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="text-[0.7rem] mb-1" style={{ color: "var(--pn-text-secondary)" }}>
          Original Prompt
        </div>
        <div
          className="text-[0.75rem] p-2 rounded glass-ambient max-h-20 overflow-auto"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {run.original_prompt.slice(0, 300)}
          {run.original_prompt.length > 300 && "..."}
        </div>
      </div>

      {run.revised_prompt && run.was_modified && (
        <div className="mt-2">
          <div className="text-[0.7rem] mb-1" style={{ color: "#2dd4a8" }}>
            Revised Prompt
          </div>
          <div
            className="text-[0.75rem] p-2 rounded glass-ambient max-h-20 overflow-auto"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {run.revised_prompt.slice(0, 300)}
            {run.revised_prompt.length > 300 && "..."}
          </div>
        </div>
      )}

      {Object.keys(run.reviews).length > 0 && (
        <div className="flex gap-2 mt-3">
          {(Object.entries(run.reviews) as [ExpertDomain, { score: number }][]).map(
            ([domain, review]) => (
              <div
                key={domain}
                className="flex items-center gap-1 px-2 py-1 rounded text-[0.65rem]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--pn-text-secondary)",
                }}
              >
                <span className="capitalize">{domain}</span>
                <span
                  style={{
                    color: review.score >= 0.7 ? "#22c55e" : review.score >= 0.4 ? "#f59e0b" : "#ef4444",
                  }}
                >
                  {(review.score * 100).toFixed(0)}%
                </span>
              </div>
            )
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          {run.intercept_id.slice(0, 8)}
        </span>
        {run.avg_score > 0 && (
          <span className="text-[0.65rem] font-medium" style={{ color: "#2dd4a8" }}>
            Score: {(run.avg_score * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

export function PipelineView() {
  const pipelineRuns = useMetaMindStore((s) => s.pipelineRuns);
  const activePipeline = useMetaMindStore((s) => s.activePipeline);

  if (pipelineRuns.length === 0 && !activePipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
        <span className="text-2xl opacity-30">{"\u26A1"}</span>
        <span className="text-[0.8rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          No pipeline activity yet
        </span>
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Prompts will appear here as they flow through review
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {activePipeline && activePipeline.stage !== "dispatched" && (
        <div className="mb-2">
          <div
            className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2"
            style={{ color: "#f59e0b" }}
          >
            Active
          </div>
          <PipelineRunCard run={activePipeline} />
        </div>
      )}
      <div
        className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--pn-text-tertiary)" }}
      >
        History ({pipelineRuns.length})
      </div>
      {pipelineRuns.map((run) => (
        <PipelineRunCard key={run.intercept_id} run={run} />
      ))}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
