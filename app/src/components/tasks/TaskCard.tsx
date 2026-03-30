import type { Task } from "@/types/tasks";

interface TaskCardProps {
  readonly task: Task;
  readonly onClick: () => void;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#6b95f0",
  4: "#a78bfa",
  5: "var(--pn-text-muted)",
};

const SOURCE_LABELS: Record<string, string> = {
  proposal: "proposal",
  responsibility: "resp",
  brain_dump: "dump",
  manual: "manual",
  session: "session",
  decomposition: "sub",
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const dotColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[3];

  return (
    <button
      onClick={onClick}
      className="glass-surface rounded-md p-2.5 text-left w-full transition-colors hover:bg-white/[0.02]"
    >
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 rounded-full mt-1"
          style={{
            width: "6px",
            height: "6px",
            background: dotColor,
          }}
        />
        <div className="flex-1 min-w-0">
          <span
            className="text-[0.7rem] font-medium block truncate"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {task.title}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {task.source_type && (
              <span
                className="text-[0.5rem] px-1 py-0.5 rounded"
                style={{
                  background: "rgba(107, 149, 240, 0.1)",
                  color: "#6b95f0",
                }}
              >
                {SOURCE_LABELS[task.source_type] ?? task.source_type}
              </span>
            )}
            {task.effort && (
              <span
                className="text-[0.5rem] px-1 py-0.5 rounded"
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "var(--pn-text-muted)",
                }}
              >
                {task.effort}
              </span>
            )}
            {task.due_date && (
              <span
                className="text-[0.5rem] ml-auto"
                style={{ color: "var(--pn-text-muted)" }}
              >
                {task.due_date}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
