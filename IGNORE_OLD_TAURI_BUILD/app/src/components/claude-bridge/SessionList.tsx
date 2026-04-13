import { useClaudeBridgeStore } from "@/stores/claude-bridge-store";
import type { BridgeSession } from "@/stores/claude-bridge-store";

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusColor(status: BridgeSession["status"]): string {
  switch (status) {
    case "streaming":
      return "#2dd4a8";
    case "idle":
      return "#6b95f0";
    case "completed":
      return "var(--pn-text-tertiary)";
    case "error":
    case "crashed":
      return "#E24B4A";
    case "killed":
      return "#f59e0b";
    default:
      return "var(--pn-text-muted)";
  }
}

function projectName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

export function SessionList() {
  const sessions = useClaudeBridgeStore((s) => s.sessions);
  const activeSessionId = useClaudeBridgeStore((s) => s.activeSessionId);
  const selectSession = useClaudeBridgeStore((s) => s.selectSession);
  const killSession = useClaudeBridgeStore((s) => s.killSession);

  if (sessions.length === 0) {
    return (
      <div className="p-3 text-center">
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
          No sessions yet
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        const isRunning = session.status === "streaming" || session.status === "idle";

        return (
          <button
            key={session.id}
            onClick={() => selectSession(session.id)}
            className="flex items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors"
            style={{
              background: isActive ? "var(--color-pn-surface-3)" : "transparent",
              border: isActive ? "1px solid var(--pn-border-strong)" : "1px solid transparent",
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: statusColor(session.status) }}
                />
                <span
                  className="text-[0.75rem] font-medium truncate"
                  style={{ color: "var(--pn-text-primary)" }}
                >
                  {projectName(session.project_path)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[0.6rem] font-mono"
                  style={{ color: statusColor(session.status) }}
                >
                  {session.status}
                </span>
                <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
                  {formatRelativeTime(session.last_active)}
                </span>
              </div>
            </div>

            {isRunning && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  killSession(session.id);
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-mono transition-colors hover:brightness-125"
                style={{
                  background: "rgba(226, 75, 74, 0.15)",
                  color: "#E24B4A",
                  border: "1px solid rgba(226, 75, 74, 0.25)",
                }}
              >
                Kill
              </button>
            )}
          </button>
        );
      })}
    </div>
  );
}
