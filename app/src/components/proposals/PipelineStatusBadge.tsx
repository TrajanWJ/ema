/**
 * PipelineStatusBadge
 *
 * Small inline badge for proposal cards showing pipeline status.
 * Replaces the static status dot for proposals in the orchestrator pipeline.
 *
 * Badge states:
 *  🔄 Generating  — pipeline is actively running
 *  ⚠️ Gate Failed  — quality gate failed, retrying
 *  ✅ Accepted     — proposal accepted (passed quality gate)
 *  ⚠️ Warning     — accepted with quality warnings
 *  ⏳ Queued       — waiting for user review
 *  ❌ Killed       — killed by user
 *  ↩️ Redirected   — redirected to new seeds
 */

interface PipelineStatusBadgeProps {
  readonly status: string;
  readonly qualityScore?: number | null;
  readonly iteration?: number | null;
  readonly costDisplay?: string | null;
  readonly size?: "sm" | "xs";
}

export function PipelineStatusBadge({
  status,
  qualityScore,
  iteration,
  costDisplay,
  size = "xs",
}: PipelineStatusBadgeProps) {
  const textClass = size === "xs" ? "text-[0.55rem]" : "text-[0.65rem]";

  const badge = getBadgeConfig(status, qualityScore);

  return (
    <span className="flex items-center gap-1 shrink-0">
      <span
        className={`${textClass} px-1.5 py-0.5 rounded font-medium whitespace-nowrap`}
        style={{
          background: `${badge.color}12`,
          color: badge.color,
          border: `1px solid ${badge.color}25`,
        }}
      >
        {badge.icon} {badge.label}
      </span>

      {/* Iteration counter (only when > 1) */}
      {iteration && iteration > 1 && status === "generating" && (
        <span
          className={`${textClass} px-1 py-0.5 rounded`}
          style={{
            background: "rgba(245,158,11,0.1)",
            color: "#f59e0b",
          }}
        >
          iter {iteration}
        </span>
      )}

      {/* Cost display */}
      {costDisplay && (
        <span
          className={`${textClass} px-1 py-0.5 rounded`}
          style={{
            background: "rgba(107,149,240,0.08)",
            color: "#6b95f0",
          }}
        >
          💰 {costDisplay}
        </span>
      )}
    </span>
  );
}

interface BadgeConfig {
  label: string;
  icon: string;
  color: string;
}

function getBadgeConfig(status: string, qualityScore?: number | null): BadgeConfig {
  switch (status) {
    case "generating":
      return { label: "Generating", icon: "🔄", color: "#6b95f0" };
    case "queued":
      return { label: "Queued", icon: "⏳", color: "#f59e0b" };
    case "reviewing":
      return { label: "Reviewing", icon: "🔍", color: "#a78bfa" };
    case "approved":
      return { label: "Accepted", icon: "✅", color: "#22c55e" };
    case "redirected":
      return { label: "Redirected", icon: "↩️", color: "#f59e0b" };
    case "killed":
      return { label: "Killed", icon: "❌", color: "#ef4444" };
    case "failed":
      return { label: "Failed", icon: "⚠️", color: "#ef4444" };
    default:
      // Check if it was a warning pass (qualityScore < 0.6)
      if (qualityScore != null && qualityScore < 0.6) {
        return { label: "Gate ⚠️", icon: "⚠️", color: "#f59e0b" };
      }
      return { label: status, icon: "○", color: "rgba(255,255,255,0.4)" };
  }
}

/**
 * Minimal dot indicator for collapsed card view.
 * Shows a pulsing dot for active generation.
 */
export function PipelineStatusDot({ status }: { status: string }) {
  const isGenerating = status === "generating";
  const color = isGenerating
    ? "#6b95f0"
    : status === "approved"
    ? "#22c55e"
    : status === "killed"
    ? "#ef4444"
    : status === "queued"
    ? "#f59e0b"
    : "rgba(255,255,255,0.3)";

  return (
    <span
      className="shrink-0 rounded-full mt-1"
      style={{
        width: "8px",
        height: "8px",
        background: color,
        animation: isGenerating ? "pulse 1.5s ease-in-out infinite" : "none",
        boxShadow: isGenerating ? `0 0 6px ${color}` : "none",
      }}
    />
  );
}
