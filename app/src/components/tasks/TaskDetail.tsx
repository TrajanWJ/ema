import { useState } from "react";
import { useTasksStore } from "@/stores/tasks-store";
import type { Task, TaskComment } from "@/types/tasks";

interface TaskDetailProps {
  readonly task: Task;
  readonly onClose: () => void;
}

const STATUS_TRANSITIONS: Record<Task["status"], readonly Task["status"][]> = {
  proposed: ["todo", "cancelled"],
  todo: ["in_progress", "cancelled"],
  in_progress: ["in_review", "blocked", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  in_review: ["done", "in_progress"],
  done: ["archived"],
  archived: [],
  cancelled: [],
} as const;

const STATUS_COLORS: Record<Task["status"], string> = {
  proposed: "#a78bfa",
  todo: "#6b95f0",
  in_progress: "#2dd4a8",
  blocked: "#ef4444",
  in_review: "#f59e0b",
  done: "#22c55e",
  archived: "var(--pn-text-muted)",
  cancelled: "var(--pn-text-muted)",
};

export function TaskDetail({ task, onClose }: TaskDetailProps) {
  const [commentBody, setCommentBody] = useState("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const { transitionTask, addComment } = useTasksStore();

  const allowedTransitions = STATUS_TRANSITIONS[task.status];

  async function handleTransition(status: Task["status"]) {
    await transitionTask(task.id, status);
  }

  async function handleAddComment() {
    if (!commentBody.trim()) return;
    const comment = await addComment(task.id, commentBody.trim());
    setComments((prev) => [...prev, comment]);
    setCommentBody("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onClose}
          className="text-[0.7rem] px-2 py-1 rounded"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          &larr; Back
        </button>
        <span
          className="text-[0.55rem] px-1.5 py-0.5 rounded"
          style={{
            background: `${STATUS_COLORS[task.status]}15`,
            color: STATUS_COLORS[task.status],
          }}
        >
          {task.status.replace("_", " ")}
        </span>
      </div>

      <h2
        className="text-[0.875rem] font-semibold mb-2"
        style={{ color: "var(--pn-text-primary)" }}
      >
        {task.title}
      </h2>

      {task.description && (
        <p
          className="text-[0.7rem] leading-relaxed mb-4"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          {task.description}
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {task.effort && (
          <MetaChip label="Effort" value={task.effort} />
        )}
        {task.due_date && (
          <MetaChip label="Due" value={task.due_date} />
        )}
        {task.source_type && (
          <MetaChip label="Source" value={task.source_type} />
        )}
        <MetaChip label="Priority" value={`P${task.priority}`} />
      </div>

      {/* Status transitions */}
      {allowedTransitions.length > 0 && (
        <div className="mb-4">
          <span
            className="text-[0.6rem] font-medium uppercase tracking-wider block mb-2"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Move to
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {allowedTransitions.map((status) => (
              <button
                key={status}
                onClick={() => handleTransition(status)}
                className="text-[0.6rem] font-medium px-2.5 py-1 rounded transition-opacity hover:opacity-80"
                style={{
                  background: `${STATUS_COLORS[status]}12`,
                  color: STATUS_COLORS[status],
                  border: `1px solid ${STATUS_COLORS[status]}25`,
                }}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="flex-1 min-h-0 flex flex-col">
        <span
          className="text-[0.6rem] font-medium uppercase tracking-wider block mb-2"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Comments
        </span>

        <div className="flex-1 overflow-auto mb-3">
          {comments.length === 0 && (
            <span className="text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
              No comments yet
            </span>
          )}
          {comments.map((c) => (
            <div
              key={c.id}
              className="mb-2 px-2 py-1.5 rounded"
              style={{ background: "rgba(255, 255, 255, 0.02)" }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[0.55rem] px-1 py-0.5 rounded"
                  style={{
                    background: c.source === "agent" ? "rgba(167, 139, 250, 0.1)" : "rgba(45, 212, 168, 0.1)",
                    color: c.source === "agent" ? "#a78bfa" : "#2dd4a8",
                  }}
                >
                  {c.source}
                </span>
                <span className="text-[0.5rem]" style={{ color: "var(--pn-text-muted)" }}>
                  {new Date(c.inserted_at).toLocaleString()}
                </span>
              </div>
              <p className="text-[0.65rem]" style={{ color: "var(--pn-text-secondary)" }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add comment..."
            className="flex-1 rounded px-2 py-1.5 text-[0.7rem]"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddComment();
            }}
          />
          <button
            onClick={handleAddComment}
            className="text-[0.65rem] font-medium px-2.5 py-1.5 rounded"
            style={{
              background: "rgba(45, 212, 168, 0.12)",
              color: "#2dd4a8",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="text-[0.55rem] px-1.5 py-0.5 rounded"
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        color: "var(--pn-text-muted)",
      }}
    >
      {label}: {value}
    </span>
  );
}
