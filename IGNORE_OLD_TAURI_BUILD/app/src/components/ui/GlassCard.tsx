interface GlassCardProps {
  readonly title?: string;
  readonly onNavigate?: () => void;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function GlassCard({ title, onNavigate, children, className = "" }: GlassCardProps) {
  return (
    <div className={`glass-surface rounded-lg p-4 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-[0.75rem] font-medium uppercase tracking-wider"
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
      {children}
    </div>
  );
}
