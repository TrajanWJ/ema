interface GlassCardProps {
  readonly title?: string;
  readonly onNavigate?: () => void;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function GlassCard({ title, onNavigate, children, className = "" }: GlassCardProps) {
  return (
    <div
      className={`glass-surface rounded-xl p-4 ${className}`}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), radial-gradient(circle at top right, rgba(107,149,240,0.06), transparent 28%)",
        }}
      />
      {title && (
        <div className="relative z-10 mb-3 flex items-center justify-between">
          <h3
            className="text-[0.73rem] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            {title}
          </h3>
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="text-[0.75rem] opacity-40 hover:opacity-70 transition-opacity"
              style={{ color: "var(--pn-text-secondary)" }}
            >
              &rarr;
            </button>
          )}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
