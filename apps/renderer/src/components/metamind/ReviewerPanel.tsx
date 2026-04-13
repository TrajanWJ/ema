import { useMetaMindStore } from "@/stores/metamind-store";
import type { ExpertDomain } from "@/types/metamind";

const EXPERT_CONFIG: Record<ExpertDomain, { label: string; icon: string; color: string }> = {
  technical: { label: "Technical", icon: "\u2699", color: "#6b95f0" },
  creative: { label: "Creative", icon: "\u2728", color: "#a78bfa" },
  business: { label: "Business", icon: "\u25A3", color: "#2dd4a8" },
  security: { label: "Security", icon: "\u26E8", color: "#f59e0b" },
};

function ExpertCard({ domain }: { domain: ExpertDomain }) {
  const reviewerStats = useMetaMindStore((s) => s.reviewerStats);
  const config = EXPERT_CONFIG[domain];
  const reviewCount = reviewerStats?.reviews_by_expert[domain] ?? 0;
  const avgScore = reviewerStats?.avg_scores[domain] ?? 0;

  return (
    <div
      className="glass-surface rounded-lg p-4"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[0.9rem]"
          style={{
            background: `${config.color}18`,
            border: `1px solid ${config.color}30`,
          }}
        >
          {config.icon}
        </div>
        <div>
          <div
            className="text-[0.8rem] font-medium"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {config.label}
          </div>
          <div className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            Expert Reviewer
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
          Reviews
        </span>
        <span
          className="text-[0.8rem] font-medium"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {reviewCount}
        </span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
          Avg Score
        </span>
        <span
          className="text-[0.8rem] font-medium"
          style={{
            color: avgScore >= 0.7 ? "#22c55e" : avgScore >= 0.4 ? "#f59e0b" : "#ef4444",
          }}
        >
          {(avgScore * 100).toFixed(0)}%
        </span>
      </div>

      <div className="h-1.5 rounded-full mt-2" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.round(avgScore * 100)}%`,
            background: `linear-gradient(90deg, ${config.color}80, ${config.color})`,
          }}
        />
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
  value: string | number;
  color: string;
}) {
  return (
    <div
      className="glass-surface rounded-lg p-3 text-center"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="text-[1.1rem] font-semibold mb-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
        {label}
      </div>
    </div>
  );
}

export function ReviewerPanel() {
  const interceptorStats = useMetaMindStore((s) => s.interceptorStats);
  const reviewerStats = useMetaMindStore((s) => s.reviewerStats);
  const researcherStats = useMetaMindStore((s) => s.researcherStats);
  // triggerResearch endpoint removed — button is a no-op placeholder

  return (
    <div className="flex flex-col gap-4">
      {/* Interceptor Stats */}
      <div>
        <div
          className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Interceptor
        </div>
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            label="Intercepted"
            value={interceptorStats?.total_intercepted ?? 0}
            color="#6b95f0"
          />
          <StatCard
            label="Approved"
            value={interceptorStats?.total_approved ?? 0}
            color="#22c55e"
          />
          <StatCard
            label="Modified"
            value={interceptorStats?.total_modified ?? 0}
            color="#f59e0b"
          />
          <StatCard
            label="Bypassed"
            value={interceptorStats?.total_bypassed ?? 0}
            color="rgba(255,255,255,0.40)"
          />
        </div>
      </div>

      {/* Expert Reviewers */}
      <div>
        <div
          className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Domain Experts ({reviewerStats?.total_reviews ?? 0} reviews)
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(EXPERT_CONFIG) as ExpertDomain[]).map((domain) => (
            <ExpertCard key={domain} domain={domain} />
          ))}
        </div>
      </div>

      {/* Researcher */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div
            className="text-[0.65rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            Researcher
          </div>
          <button
            type="button"
            className="text-[0.65rem] px-2 py-1 rounded transition-colors"
            style={{
              background: "rgba(45,212,168,0.10)",
              color: "#2dd4a8",
              border: "1px solid rgba(45,212,168,0.20)",
            }}
            onClick={() => { /* research endpoint not available */ }}
          >
            Research Now
          </button>
        </div>

        <div className="glass-surface rounded-lg p-3" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                Status
              </div>
              <div
                className="text-[0.8rem] font-medium"
                style={{ color: researcherStats?.paused ? "#ef4444" : "#22c55e" }}
              >
                {researcherStats?.paused ? "Paused" : "Active"}
              </div>
            </div>
            <div>
              <div className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                Discoveries
              </div>
              <div
                className="text-[0.8rem] font-medium"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {researcherStats?.total_discoveries ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                Last Run
              </div>
              <div
                className="text-[0.75rem]"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {researcherStats?.last_run_at
                  ? new Date(researcherStats.last_run_at).toLocaleTimeString()
                  : "Never"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
