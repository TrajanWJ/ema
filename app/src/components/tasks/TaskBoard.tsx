import { useTasksStore } from "@/stores/tasks-store";
import { TaskCard } from "./TaskCard";
import type { Task } from "@/types/tasks";

const BOARD_COLUMNS: readonly { status: Task["status"]; label: string; color: string }[] = [
  { status: "proposed", label: "Proposed", color: "#a78bfa" },
  { status: "todo", label: "To Do", color: "#6b95f0" },
  { status: "in_progress", label: "In Progress", color: "#2dd4a8" },
  { status: "in_review", label: "In Review", color: "#f59e0b" },
  { status: "done", label: "Done", color: "#22c55e" },
] as const;

interface TaskBoardProps {
  readonly onSelectTask: (task: Task) => void;
}

export function TaskBoard({ onSelectTask }: TaskBoardProps) {
  const tasks = useTasksStore((s) => s.tasks);
  const transitionTask = useTasksStore((s) => s.transitionTask);

  return (
    <div className="flex gap-2 h-full overflow-x-auto">
      {BOARD_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.status);
        return (
          <div
            key={column.status}
            className="flex flex-col shrink-0"
            style={{ width: "200px" }}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span
                className="rounded-full"
                style={{
                  width: "6px",
                  height: "6px",
                  background: column.color,
                }}
              />
              <span
                className="text-[0.6rem] font-medium uppercase tracking-wider"
                style={{ color: "var(--pn-text-muted)" }}
              >
                {column.label}
              </span>
              <span
                className="text-[0.55rem] ml-auto"
                style={{ color: "var(--pn-text-muted)" }}
              >
                {columnTasks.length}
              </span>
            </div>

            {/* Column body */}
            <div
              className="flex-1 overflow-y-auto flex flex-col gap-1.5 p-1 rounded-lg"
              style={{ background: "rgba(255, 255, 255, 0.01)" }}
            >
              {columnTasks.map((task) => (
                <div key={task.id}>
                  <TaskCard task={task} onClick={() => onSelectTask(task)} />
                  {/* Quick move buttons */}
                  <div className="flex gap-0.5 mt-0.5 px-1">
                    {getAdjacentStatuses(column.status).map((targetStatus) => (
                      <button
                        key={targetStatus}
                        onClick={() => transitionTask(task.id, targetStatus)}
                        className="text-[0.45rem] px-1 py-0.5 rounded opacity-0 hover:opacity-100 transition-opacity"
                        style={{
                          color: "var(--pn-text-muted)",
                          background: "rgba(255, 255, 255, 0.03)",
                        }}
                        title={`Move to ${targetStatus.replace("_", " ")}`}
                      >
                        {targetStatus === getPrevStatus(column.status) ? "\u2190" : "\u2192"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getAdjacentStatuses(current: Task["status"]): Task["status"][] {
  const order: Task["status"][] = ["proposed", "todo", "in_progress", "in_review", "done"];
  const idx = order.indexOf(current);
  const result: Task["status"][] = [];
  if (idx > 0) result.push(order[idx - 1]);
  if (idx < order.length - 1) result.push(order[idx + 1]);
  return result;
}

function getPrevStatus(current: Task["status"]): Task["status"] | null {
  const order: Task["status"][] = ["proposed", "todo", "in_progress", "in_review", "done"];
  const idx = order.indexOf(current);
  return idx > 0 ? order[idx - 1] : null;
}
