import type { Session } from "@/stores/sessions-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case "active":
    case "running":
      return "#22c55e";
    case "idle":
    case "ended":
      return "rgba(255,255,255,0.25)";
    case "error":
    case "killed":
      return "#ef4444";
    default:
      return "rgba(255,255,255,0.15)";
  }
}

function projectName(path: string | null): string {
  if (!path) return "Unknown";
  const segments = path.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] ?? "Unknown";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1_000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionListProps {
  readonly sessions: readonly Session[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onNewSession: () => void;
}

export function SessionList({
  sessions,
  selectedId,
  onSelect,
  onNewSession,
}: SessionListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
      >
        <span
          className="text-[0.8rem] font-medium"
          style={{ color: "var(--pn-text-primary)" }}
        >
          Sessions
        </span>
        <button
          onClick={onNewSession}
          className="text-[0.65rem] px-2 py-0.5 rounded transition-opacity hover:opacity-80"
          style={{ background: "#6b95f0", color: "#fff" }}
        >
          + New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <div
            className="px-3 py-6 text-center text-[0.7rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            No sessions yet
          </div>
        )}

        {sessions.map((session) => {
          const isSelected = session.id === selectedId;
          return (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className="w-full text-left px-3 py-2.5 transition-colors"
              style={{
                background: isSelected
                  ? "rgba(107, 149, 240, 0.08)"
                  : "transparent",
                borderLeft: isSelected
                  ? "2px solid #6b95f0"
                  : "2px solid transparent",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {/* Status dot */}
                <span
                  className="shrink-0 rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    background: statusColor(session.status),
                    boxShadow:
                      session.status === "active"
                        ? "0 0 6px rgba(34, 197, 94, 0.4)"
                        : "none",
                  }}
                />
                {/* Project name */}
                <span
                  className="text-[0.75rem] font-medium truncate"
                  style={{ color: "var(--pn-text-primary)" }}
                >
                  {projectName(session.project_path)}
                </span>
              </div>

              <div className="flex items-center gap-2 pl-5">
                {/* Model badge */}
                {session.model && (
                  <span
                    className="text-[0.6rem] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--pn-text-secondary)",
                    }}
                  >
                    {session.model}
                  </span>
                )}
                {/* Time */}
                <span
                  className="text-[0.6rem] ml-auto"
                  style={{ color: "var(--pn-text-muted)" }}
                >
                  {relativeTime(session.last_active ?? session.started_at)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
