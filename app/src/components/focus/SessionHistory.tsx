import { useFocusStore } from "@/stores/focus-store";

export function SessionHistory() {
  const history = useFocusStore((s) => s.history);

  const completedSessions = history.filter((s) => s.ended_at);

  if (completedSessions.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3
          className="text-[0.75rem] font-mono uppercase tracking-wider"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Session History
        </h3>
        <div
          className="text-center py-8 text-[0.75rem]"
          style={{ color: "var(--pn-text-muted)" }}
        >
          No completed sessions yet
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3
        className="text-[0.75rem] font-mono uppercase tracking-wider"
        style={{ color: "var(--pn-text-tertiary)" }}
      >
        Session History
      </h3>
      <div className="flex flex-col gap-1.5">
        {completedSessions.slice(0, 10).map((session) => {
          const workMs = session.blocks
            .filter((b) => b.block_type === "work" && b.elapsed_ms)
            .reduce((sum, b) => sum + (b.elapsed_ms ?? 0), 0);
          const breakMs = session.blocks
            .filter((b) => b.block_type === "break" && b.elapsed_ms)
            .reduce((sum, b) => sum + (b.elapsed_ms ?? 0), 0);
          const targetMs = session.target_ms;
          const completion = targetMs > 0 ? Math.min(Math.round((workMs / targetMs) * 100), 100) : 0;

          return (
            <div
              key={session.id}
              className="glass-surface rounded-lg px-4 py-3 flex items-center gap-4"
              style={{ border: "1px solid var(--pn-border-subtle)" }}
            >
              {/* Completion badge */}
              <div
                className="shrink-0 flex items-center justify-center rounded-full text-[0.6rem] font-mono font-medium"
                style={{
                  width: "36px",
                  height: "36px",
                  background: completion >= 100
                    ? "rgba(244, 63, 94, 0.12)"
                    : "rgba(255,255,255,0.04)",
                  color: completion >= 100 ? "#f43f5e" : "var(--pn-text-secondary)",
                  border: completion >= 100
                    ? "1px solid rgba(244, 63, 94, 0.20)"
                    : "1px solid var(--pn-border-subtle)",
                }}
              >
                {completion}%
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
                    {formatDuration(workMs)} work
                  </span>
                  {breakMs > 0 && (
                    <span className="text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
                      + {formatDuration(breakMs)} break
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                    {formatDate(session.started_at)}
                  </span>
                  <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                    {session.blocks.length} blocks
                  </span>
                </div>
              </div>

              {/* Mini progress bar */}
              <div
                className="w-16 h-1 rounded-full overflow-hidden shrink-0"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${completion}%`,
                    background: "rgba(244, 63, 94, 0.5)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms === 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
