interface AppTileProps {
  readonly appId: string;
  readonly name: string;
  readonly icon: string;
  readonly accent: string;
  readonly status?: string;
  readonly badge?: number;
  readonly progress?: number;
  readonly scaffolded?: boolean;
  readonly onClick: () => void;
}

export function AppTile({
  name,
  icon,
  accent,
  status,
  badge,
  progress,
  scaffolded = false,
  onClick,
}: AppTileProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
      style={{
        background: "rgba(14, 16, 23, 0.55)",
        backdropFilter: "blur(20px) saturate(150%)",
        border: scaffolded
          ? "1px dashed rgba(255,255,255,0.06)"
          : "1px solid rgba(255,255,255,0.06)",
        borderTop: scaffolded ? undefined : `2px solid ${accent}`,
        opacity: scaffolded ? 0.45 : 1,
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
      <span className="text-[1.4rem] mb-2.5" style={{ color: scaffolded ? "var(--pn-text-tertiary)" : accent }}>
        {icon}
      </span>
      <span className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
        {name}
      </span>
      {status && (
        <span
          className="text-[0.65rem] font-mono mt-1"
          style={{ color: scaffolded ? "rgba(255,255,255,0.25)" : "var(--pn-text-muted)" }}
        >
          {status}
        </span>
      )}
      {progress !== undefined && (
        <div className="mt-auto pt-2.5">
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
