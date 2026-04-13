import { useState, memo } from "react";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import type { InboxItem as InboxItemType } from "@/types/brain-dump";
import type { ExecutionStatus, ExecutionMode } from "@/types/executions";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const MODE_COLORS: Record<ExecutionMode, string> = {
  research: "#6b95f0",
  outline: "#a78bfa",
  implement: "#2dd4a8",
  review: "#f59e0b",
  harvest: "#f97316",
  refactor: "#ec4899",
};

const STATUS_STYLES: Record<
  ExecutionStatus,
  { color: string; label: string; pulse?: boolean }
> = {
  created: { color: "rgba(255,255,255,0.4)", label: "pending" },
  proposed: { color: "rgba(255,255,255,0.4)", label: "proposed" },
  awaiting_approval: { color: "#f59e0b", label: "awaiting" },
  approved: { color: "#6b95f0", label: "approved" },
  delegated: { color: "#6b95f0", label: "delegated" },
  running: { color: "#6b95f0", label: "running", pulse: true },
  harvesting: { color: "#f97316", label: "harvesting" },
  completed: { color: "#2dd4a8", label: "done" },
  failed: { color: "#ef4444", label: "failed" },
  cancelled: { color: "rgba(255,255,255,0.25)", label: "cancelled" },
};

interface InboxItemProps {
  readonly item: InboxItemType;
}

export const InboxItem = memo(function InboxItem({ item }: InboxItemProps) {
  const { process, remove, approveExecution, queueExecution } =
    useBrainDumpStore();
  const execution = useBrainDumpStore((s) => s.itemExecutions[item.id]);
  const [hovered, setHovered] = useState(false);

  const statusStyle = execution ? STATUS_STYLES[execution.status] : null;
  const modeColor = execution ? MODE_COLORS[execution.mode] : null;

  return (
    <div
      className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg transition-colors"
      style={{
        background: hovered ? "rgba(255,255,255,0.03)" : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-[0.8rem] leading-relaxed break-words"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {item.content}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className="text-[0.6rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {relativeTime(item.created_at)}
          </span>
          {execution && statusStyle && modeColor && (
            <>
              <span
                className="text-[0.55rem] px-1.5 py-0.5 rounded font-mono"
                style={{ background: `${modeColor}18`, color: modeColor }}
              >
                {execution.mode}
              </span>
              <span
                className="text-[0.55rem] px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: `${statusStyle.color}18`,
                  color: statusStyle.color,
                  animation: statusStyle.pulse
                    ? "pulse 2s infinite"
                    : undefined,
                }}
              >
                {statusStyle.label}
              </span>
              {execution.status === "completed" && execution.result_path && (
                <span
                  className="text-[0.55rem] px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80"
                  style={{
                    color: "#2dd4a8",
                    border: "1px solid rgba(45,212,168,0.3)",
                  }}
                >
                  {"-> Result"}
                </span>
              )}
              {execution.status === "created" &&
                execution.requires_approval && (
                  <button
                    onClick={() => approveExecution(execution.id)}
                    className="text-[0.55rem] px-1.5 py-0.5 rounded font-medium hover:opacity-80"
                    style={{
                      color: "#2dd4a8",
                      border: "1px solid rgba(45,212,168,0.3)",
                    }}
                  >
                    Approve
                  </button>
                )}
            </>
          )}
          {!execution && hovered && (
            <button
              onClick={() => queueExecution(item.id, item.content)}
              className="text-[0.55rem] px-1.5 py-0.5 rounded font-mono hover:opacity-80"
              style={{
                color: "var(--pn-text-tertiary)",
                border: "1px solid var(--pn-border-subtle)",
              }}
            >
              Queue
            </button>
          )}
        </div>
      </div>

      {hovered && (
        <div className="flex gap-1 shrink-0 pt-0.5">
          <ActionBtn
            label="-> Task"
            color="var(--color-pn-primary-400)"
            onClick={() => process(item.id, "task")}
          />
          <ActionBtn
            label="-> Journal"
            color="var(--color-pn-tertiary-400)"
            onClick={() => process(item.id, "journal")}
          />
          <ActionBtn
            label="Archive"
            color="var(--pn-text-tertiary)"
            onClick={() => process(item.id, "archive")}
          />
          <ActionBtn
            label="x"
            color="var(--color-pn-error)"
            onClick={() => remove(item.id)}
          />
        </div>
      )}
    </div>
  );
});

function ActionBtn({
  label,
  color,
  onClick,
}: {
  readonly label: string;
  readonly color: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[0.6rem] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
      style={{ color, border: `1px solid ${color}` }}
    >
      {label}
    </button>
  );
}
