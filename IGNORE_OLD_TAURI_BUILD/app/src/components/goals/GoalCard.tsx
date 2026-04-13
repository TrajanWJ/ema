import { useState } from "react";
import { useGoalsStore } from "@/stores/goals-store";
import { GoalForm } from "./GoalForm";
import { TIMEFRAME_LABELS } from "@/types/goals";
import type { Goal } from "@/types/goals";

interface GoalCardProps {
  readonly goal: Goal;
}

export function GoalCard({ goal }: GoalCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const completeGoal = useGoalsStore((s) => s.completeGoal);
  const updateGoal = useGoalsStore((s) => s.updateGoal);
  const deleteGoal = useGoalsStore((s) => s.deleteGoal);

  const isCompleted = goal.status === "completed";

  function handleToggleComplete() {
    if (isCompleted) {
      updateGoal(goal.id, { status: "active" });
    } else {
      completeGoal(goal.id);
    }
  }

  function handleDelete() {
    if (confirming) {
      deleteGoal(goal.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  }

  if (editing) {
    return <GoalForm goal={goal} onDone={() => setEditing(false)} />;
  }

  return (
    <div
      className="glass-surface rounded-lg px-4 py-3 flex items-start gap-3 group transition-colors"
      style={{
        border: "1px solid var(--pn-border-subtle)",
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      {/* Completion toggle */}
      <button
        onClick={handleToggleComplete}
        className="mt-0.5 shrink-0 rounded-full flex items-center justify-center transition-colors"
        style={{
          width: "18px",
          height: "18px",
          border: isCompleted
            ? "2px solid #f59e0b"
            : "2px solid var(--pn-border-default)",
          background: isCompleted ? "rgba(245, 158, 11, 0.15)" : "transparent",
          color: isCompleted ? "#f59e0b" : "transparent",
          fontSize: "0.65rem",
        }}
      >
        {isCompleted ? "\u2713" : ""}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[0.8rem] font-medium"
            style={{
              color: "var(--pn-text-primary)",
              textDecoration: isCompleted ? "line-through" : "none",
            }}
          >
            {goal.title}
          </span>
          <span
            className="text-[0.6rem] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(245, 158, 11, 0.08)",
              color: "rgba(245, 158, 11, 0.7)",
            }}
          >
            {TIMEFRAME_LABELS[goal.timeframe]}
          </span>
        </div>
        {goal.description && (
          <p
            className="text-[0.7rem] mt-1 leading-relaxed"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            {goal.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="px-2 py-1 rounded text-[0.65rem] transition-colors hover:bg-white/5"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          className="px-2 py-1 rounded text-[0.65rem] transition-colors hover:bg-white/5"
          style={{ color: confirming ? "#ef4444" : "var(--pn-text-tertiary)" }}
        >
          {confirming ? "Confirm?" : "Delete"}
        </button>
      </div>
    </div>
  );
}
