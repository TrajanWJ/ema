import { useExecutionStore } from "@/stores/execution-store";
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

const EXEC_STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  running: "#6b95f0",
  delegated: "#6b95f0",
  approved: "#2dd4a8",
  failed: "#ef4444",
  cancelled: "#ef4444",
  created: "#a78bfa",
  proposed: "#a78bfa",
  awaiting_approval: "#f59e0b",
  harvesting: "#f59e0b",
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const dotColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[3];
  const executions = useExecutionStore((s) => s.executions);
  // Find execution linked to this task (by source_id or matching task title)
  const linkedExec = executions.find(
    (e) => e.id === task.source_id || (task.source_type === "execution" && e.id === task.source_id),
  );

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
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
            {linkedExec && (
              <span
                className="text-[0.5rem] px-1 py-0.5 rounded"
                style={{
                  background: `${EXEC_STATUS_COLORS[linkedExec.status] ?? "#a78bfa"}15`,
                  color: EXEC_STATUS_COLORS[linkedExec.status] ?? "#a78bfa",
                }}
              >
                exec: {linkedExec.status}
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
