import { useState } from "react";
import { useGoalsStore } from "@/stores/goals-store";
import { TIMEFRAME_ORDER, TIMEFRAME_LABELS } from "@/types/goals";
import type { Goal, GoalOwnerKind, GoalTimeframe } from "@/types/goals";

interface GoalFormProps {
  readonly goal?: Goal;
  readonly onDone: () => void;
}

export function GoalForm({ goal, onDone }: GoalFormProps) {
  const createGoal = useGoalsStore((s) => s.createGoal);
  const updateGoal = useGoalsStore((s) => s.updateGoal);

  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [timeframe, setTimeframe] = useState<GoalTimeframe>(goal?.timeframe ?? "monthly");
  const [ownerKind, setOwnerKind] = useState<GoalOwnerKind>(goal?.owner_kind ?? "human");
  const [ownerId, setOwnerId] = useState(goal?.owner_id ?? "owner");
  const [intentSlug, setIntentSlug] = useState(goal?.intent_slug ?? "");
  const [targetDate, setTargetDate] = useState(goal?.target_date ? goal.target_date.slice(0, 16) : "");
  const [successCriteria, setSuccessCriteria] = useState(goal?.success_criteria ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      if (goal) {
        await updateGoal(goal.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          timeframe,
          owner_kind: ownerKind,
          owner_id: ownerId.trim() || "owner",
          intent_slug: intentSlug.trim() || null,
          target_date: targetDate ? new Date(targetDate).toISOString() : null,
          success_criteria: successCriteria.trim() || null,
        });
      } else {
        await createGoal({
          title: title.trim(),
          description: description.trim() || undefined,
          timeframe,
          owner_kind: ownerKind,
          owner_id: ownerId.trim() || "owner",
          intent_slug: intentSlug.trim() || undefined,
          target_date: targetDate ? new Date(targetDate).toISOString() : undefined,
          success_criteria: successCriteria.trim() || undefined,
        });
      }
      onDone();
    } catch (err) {
      console.error("Failed to save goal:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-surface rounded-lg p-4 flex flex-col gap-3"
      style={{ border: "1px solid rgba(245, 158, 11, 0.15)" }}
    >
      <input
        type="text"
        placeholder="Goal title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="bg-transparent outline-none text-[0.85rem] font-medium"
        style={{
          color: "var(--pn-text-primary)",
          borderBottom: "1px solid var(--pn-border-subtle)",
          paddingBottom: "0.5rem",
        }}
      />

      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="bg-transparent outline-none text-[0.75rem] resize-none"
        style={{
          color: "var(--pn-text-secondary)",
          borderBottom: "1px solid var(--pn-border-subtle)",
          paddingBottom: "0.5rem",
        }}
      />

      <div className="flex items-center gap-2">
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Timeframe:
        </span>
        {TIMEFRAME_ORDER.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className="px-2 py-1 rounded text-[0.7rem] transition-colors"
            style={{
              background: timeframe === tf ? "rgba(245, 158, 11, 0.12)" : "transparent",
              color: timeframe === tf ? "#f59e0b" : "var(--pn-text-tertiary)",
              border: timeframe === tf ? "1px solid rgba(245, 158, 11, 0.20)" : "1px solid transparent",
            }}
          >
            {TIMEFRAME_LABELS[tf]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Owner:
        </span>
        {(["human", "agent"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOwnerKind(kind)}
            className="px-2 py-1 rounded text-[0.7rem] transition-colors"
            style={{
              background: ownerKind === kind ? "rgba(245, 158, 11, 0.12)" : "transparent",
              color: ownerKind === kind ? "#f59e0b" : "var(--pn-text-tertiary)",
              border: ownerKind === kind ? "1px solid rgba(245, 158, 11, 0.20)" : "1px solid transparent",
            }}
          >
            {kind}
          </button>
        ))}
        <input
          type="text"
          placeholder="owner id"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="bg-transparent outline-none text-[0.72rem] flex-1"
          style={{
            color: "var(--pn-text-primary)",
            borderBottom: "1px solid var(--pn-border-subtle)",
            paddingBottom: "0.25rem",
          }}
        />
      </div>

      <input
        type="text"
        placeholder="Linked intent slug (optional)"
        value={intentSlug}
        onChange={(e) => setIntentSlug(e.target.value)}
        className="bg-transparent outline-none text-[0.75rem]"
        style={{
          color: "var(--pn-text-secondary)",
          borderBottom: "1px solid var(--pn-border-subtle)",
          paddingBottom: "0.5rem",
        }}
      />

      <input
        type="datetime-local"
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        className="bg-transparent outline-none text-[0.75rem]"
        style={{
          color: "var(--pn-text-secondary)",
          borderBottom: "1px solid var(--pn-border-subtle)",
          paddingBottom: "0.5rem",
        }}
      />

      <textarea
        placeholder="Success criteria (optional)"
        value={successCriteria}
        onChange={(e) => setSuccessCriteria(e.target.value)}
        rows={2}
        className="bg-transparent outline-none text-[0.75rem] resize-none"
        style={{
          color: "var(--pn-text-secondary)",
          borderBottom: "1px solid var(--pn-border-subtle)",
          paddingBottom: "0.5rem",
        }}
      />

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded text-[0.7rem] transition-colors hover:bg-white/5"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="px-3 py-1.5 rounded-md text-[0.7rem] font-medium transition-colors"
          style={{
            background: title.trim() ? "rgba(245, 158, 11, 0.15)" : "rgba(255,255,255,0.04)",
            color: title.trim() ? "#f59e0b" : "var(--pn-text-muted)",
            border: "1px solid rgba(245, 158, 11, 0.20)",
          }}
        >
          {submitting ? "Saving..." : goal ? "Update" : "Create Goal"}
        </button>
      </div>
    </form>
  );
}
