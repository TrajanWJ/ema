import { useState, useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTasksStore } from "@/stores/tasks-store";
import type { Task } from "@/types/tasks";

type SortKey = "title" | "priority" | "status" | "created_at";

const STATUS_COLORS: Record<Task["status"], string> = {
  proposed: "#a78bfa",
  todo: "#6b95f0",
  in_progress: "#2dd4a8",
  blocked: "#ef4444",
  in_review: "#f59e0b",
  done: "#22c55e",
  archived: "var(--pn-text-muted)",
  cancelled: "var(--pn-text-muted)",
  requires_proposal: "#fbbf24",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#6b95f0",
  4: "#a78bfa",
  5: "var(--pn-text-muted)",
};

interface TaskListProps {
  readonly onSelectTask: (task: Task) => void;
}

export function TaskList({ onSelectTask }: TaskListProps) {
  const tasks = useTasksStore((s) => s.tasks);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortAsc, setSortAsc] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    switch (sortKey) {
      case "title":
        return a.title.localeCompare(b.title) * dir;
      case "priority":
        return (a.priority - b.priority) * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "created_at":
        return a.created_at.localeCompare(b.created_at) * dir;
      default:
        return 0;
    }
  });

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-muted)" }}
        >
          No tasks
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 mb-1 shrink-0"
        style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
      >
        <SortHeader
          label="P"
          width="30px"
          sortKey="priority"
          current={sortKey}
          asc={sortAsc}
          onClick={handleSort}
        />
        <SortHeader
          label="Title"
          width="flex"
          sortKey="title"
          current={sortKey}
          asc={sortAsc}
          onClick={handleSort}
        />
        <SortHeader
          label="Status"
          width="80px"
          sortKey="status"
          current={sortKey}
          asc={sortAsc}
          onClick={handleSort}
        />
        <SortHeader
          label="Date"
          width="70px"
          sortKey="created_at"
          current={sortKey}
          asc={sortAsc}
          onClick={handleSort}
        />
      </div>

      {/* Virtualized rows */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ minHeight: 0 }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const task = sorted[virtualRow.index];
            return (
              <TaskRow
                key={task.id}
                task={task}
                onSelectTask={onSelectTask}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TaskRow = memo(function TaskRow({
  task,
  onSelectTask,
  style,
}: {
  readonly task: Task;
  readonly onSelectTask: (task: Task) => void;
  readonly style: React.CSSProperties;
}) {
  return (
    <button
      onClick={() => onSelectTask(task)}
      className="flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.02] rounded"
      style={style}
    >
      <span style={{ width: "30px" }}>
        <span
          className="inline-block rounded-full"
          style={{
            width: "6px",
            height: "6px",
            background: PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[3],
          }}
        />
      </span>
      <span
        className="text-[0.7rem] flex-1 truncate"
        style={{ color: "var(--pn-text-primary)" }}
      >
        {task.title}
      </span>
      <span style={{ width: "80px" }}>
        <span
          className="text-[0.55rem] px-1.5 py-0.5 rounded"
          style={{
            background: `${STATUS_COLORS[task.status]}12`,
            color: STATUS_COLORS[task.status],
          }}
        >
          {task.status.replace("_", " ")}
        </span>
      </span>
      <span
        className="text-[0.55rem]"
        style={{ width: "70px", color: "var(--pn-text-muted)" }}
      >
        {new Date(task.created_at).toLocaleDateString()}
      </span>
    </button>
  );
});

function SortHeader({
  label,
  width,
  sortKey,
  current,
  asc,
  onClick,
}: {
  label: string;
  width: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className="text-[0.55rem] font-medium uppercase tracking-wider text-left"
      style={{
        width: width === "flex" ? undefined : width,
        flex: width === "flex" ? 1 : undefined,
        color: active ? "var(--pn-text-secondary)" : "var(--pn-text-muted)",
      }}
    >
      {label} {active ? (asc ? "\u2191" : "\u2193") : ""}
    </button>
  );
}
