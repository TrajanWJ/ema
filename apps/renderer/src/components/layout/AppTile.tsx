import { readinessLabel, type AppReadiness } from "@/config/app-catalog";

interface AppTileProps {
  readonly appId: string;
  readonly name: string;
  readonly icon: string;
  readonly accent: string;
  readonly status?: string;
  readonly summary?: string;
  readonly badge?: number;
  readonly progress?: number;
  readonly readiness?: AppReadiness;
  readonly commandHint?: string;
  readonly scaffolded?: boolean;
  readonly onClick: () => void;
}

export function AppTile({
  name,
  icon,
  accent,
  status,
  summary,
  badge,
  progress,
  readiness = "preview",
  commandHint,
  scaffolded = false,
  onClick,
}: AppTileProps) {
  const isPreview = scaffolded || readiness === "preview";
  const readinessTone =
    readiness === "live"
      ? { background: `${accent}1f`, color: accent, border: `${accent}30` }
      : readiness === "partial"
        ? { background: "rgba(245, 158, 11, 0.12)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.28)" }
        : { background: "rgba(148, 163, 184, 0.12)", color: "rgba(226,232,240,0.78)", border: "rgba(148, 163, 184, 0.2)" };

  return (
    <button
      onClick={onClick}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.985]"
      style={{
        background: [
          `radial-gradient(circle at top left, ${accent}18, transparent 28%)`,
          `radial-gradient(circle at top right, ${accent}12, transparent 24%)`,
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          "rgba(14, 16, 23, 0.62)",
        ].join(", "),
        backdropFilter: "blur(22px) saturate(150%)",
        border: isPreview
          ? "1px dashed rgba(255,255,255,0.08)"
          : "1px solid rgba(255,255,255,0.08)",
        borderTop: isPreview ? undefined : `2px solid ${accent}`,
        opacity: isPreview ? 0.72 : 1,
        minHeight: 188,
        boxShadow: "var(--pn-card-shadow)",
      }}
    >
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute top-2.5 right-2.5 text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
          style={{ background: "#2dd4a8", color: "#08090E" }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-[1.45rem]" style={{ color: isPreview ? "var(--pn-text-tertiary)" : accent }}>
          {icon}
        </span>
        <span
          className="rounded-full px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.16em]"
          style={{
            background: readinessTone.background,
            color: readinessTone.color,
            border: `1px solid ${readinessTone.border}`,
          }}
        >
          {readinessLabel(readiness)}
        </span>
      </div>
      <span className="text-[0.88rem] font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
        {name}
      </span>
      {summary && (
        <span
          className="mt-1 text-[0.68rem] leading-[1.55]"
          style={{ color: isPreview ? "rgba(255,255,255,0.38)" : "var(--pn-text-secondary)" }}
        >
          {summary}
        </span>
      )}
      {status && (
        <span
          className="mt-3 line-clamp-2 text-[0.64rem] font-mono"
          style={{ color: isPreview ? "rgba(255,255,255,0.28)" : "var(--pn-text-muted)" }}
        >
          {status}
        </span>
      )}
      {commandHint && (
        <span
          className="mt-2 inline-flex w-fit rounded-md px-2 py-1 text-[0.58rem]"
          style={{
            color: "var(--pn-text-secondary)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {commandHint}
        </span>
      )}
      {progress !== undefined && (
        <div className="mt-auto pt-3">
          <div
            className="h-[3px] rounded-sm overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-sm transition-all"
              style={{ width: `${Math.min(progress, 100)}%`, background: accent }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
