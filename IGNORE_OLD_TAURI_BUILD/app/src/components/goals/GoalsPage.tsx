import { useState } from "react";
import { useGoalsStore } from "@/stores/goals-store";
import { GoalCard } from "./GoalCard";
import { GoalForm } from "./GoalForm";
import { TIMEFRAME_ORDER, TIMEFRAME_LABELS } from "@/types/goals";
import type { GoalTimeframe } from "@/types/goals";

export function GoalsPage() {
  const goals = useGoalsStore((s) => s.goals);
  const [showForm, setShowForm] = useState(false);
  const [filterTimeframe, setFilterTimeframe] = useState<GoalTimeframe | "all">("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const filtered = goals.filter((g) => {
    if (!showCompleted && g.status !== "active") return false;
    if (filterTimeframe !== "all" && g.timeframe !== filterTimeframe) return false;
    return true;
  });

  const grouped = TIMEFRAME_ORDER.reduce<Record<string, typeof filtered>>((acc, tf) => {
    const matching = filtered.filter((g) => g.timeframe === tf);
    if (matching.length > 0) {
      acc[tf] = matching;
    }
    return acc;
  }, {});

  const activeCount = goals.filter((g) => g.status === "active").length;
  const completedCount = goals.filter((g) => g.status === "completed").length;

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2
            className="text-[0.95rem] font-medium"
            style={{ color: "var(--pn-text-primary)" }}
          >
            Goals
          </h2>
          <span
            className="text-[0.7rem] font-mono px-2 py-0.5 rounded"
            style={{
              color: "var(--pn-text-secondary)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {activeCount} active / {completedCount} done
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-md text-[0.75rem] font-medium transition-colors"
          style={{
            background: "rgba(245, 158, 11, 0.12)",
            color: "#f59e0b",
            border: "1px solid rgba(245, 158, 11, 0.20)",
          }}
        >
          {showForm ? "Cancel" : "+ New Goal"}
        </button>
      </div>

      {/* Create form */}
      {showForm && <GoalForm onDone={() => setShowForm(false)} />}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterTimeframe("all")}
          className="px-2 py-1 rounded text-[0.7rem] transition-colors"
          style={{
            background: filterTimeframe === "all" ? "rgba(245, 158, 11, 0.12)" : "transparent",
            color: filterTimeframe === "all" ? "#f59e0b" : "var(--pn-text-tertiary)",
          }}
        >
          All
        </button>
        {TIMEFRAME_ORDER.map((tf) => (
          <button
            key={tf}
            onClick={() => setFilterTimeframe(tf)}
            className="px-2 py-1 rounded text-[0.7rem] transition-colors"
            style={{
              background: filterTimeframe === tf ? "rgba(245, 158, 11, 0.12)" : "transparent",
              color: filterTimeframe === tf ? "#f59e0b" : "var(--pn-text-tertiary)",
            }}
          >
            {TIMEFRAME_LABELS[tf]}
          </button>
        ))}
        <div className="flex-1" />
        <label
          className="flex items-center gap-1.5 text-[0.7rem] cursor-pointer"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded"
          />
          Show completed
        </label>
      </div>

      {/* Goal groups */}
      {Object.keys(grouped).length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 gap-2"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          <span className="text-[1.5rem]">&#9678;</span>
          <span className="text-[0.8rem]">No goals yet</span>
          <span className="text-[0.7rem]">
            Set goals across timeframes to track what matters
          </span>
        </div>
      ) : (
        Object.entries(grouped).map(([tf, tfGoals]) => (
          <div key={tf} className="flex flex-col gap-2">
            <h3
              className="text-[0.75rem] font-mono uppercase tracking-wider"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              {TIMEFRAME_LABELS[tf as GoalTimeframe]}
              <span
                className="ml-2 text-[0.65rem]"
                style={{ color: "var(--pn-text-muted)" }}
              >
                {tfGoals.length}
              </span>
            </h3>
            <div className="flex flex-col gap-1.5">
              {tfGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
