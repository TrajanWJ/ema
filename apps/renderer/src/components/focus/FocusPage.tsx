import { useFocusStore } from "@/stores/focus-store";
import { useExecutionStore } from "@/stores/execution-store";
import { FocusTimer } from "./FocusTimer";
import { SessionHistory } from "./SessionHistory";
import { useNotificationStore } from "@/stores/notification-store";
import { useEffect, useRef } from "react";

export function FocusPage() {
  const currentSession = useFocusStore((s) => s.currentSession);
  const todayStats = useFocusStore((s) => s.todayStats);
  const phase = useFocusStore((s) => s.phase);
  const linkedExecutionId = useFocusStore((s) => s.linkedExecutionId);
  const setLinkedExecutionId = useFocusStore((s) => s.setLinkedExecutionId);
  const executions = useExecutionStore((s) => s.executions);
  const prevPhaseRef = useRef(phase);

  const activeExecutions = executions.filter(
    (e) => e.status === "running" || e.status === "approved" || e.status === "delegated" || e.status === "created",
  );

  const linkedExecution = linkedExecutionId
    ? executions.find((e) => e.id === linkedExecutionId) ?? null
    : null;

  // Show notification when session ends with linked execution
  useEffect(() => {
    if (prevPhaseRef.current !== "idle" && phase === "idle" && linkedExecution) {
      const label = linkedExecution.title || linkedExecution.intent_slug || "execution";
      useNotificationStore.getState().push(
        `Focus session completed for: ${label}`,
        "success",
      );
    }
    prevPhaseRef.current = phase;
  }, [phase, linkedExecution]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Today stats bar */}
      <div
        className="flex items-center gap-6 px-4 py-2.5 rounded-lg"
        style={{
          background: "rgba(244, 63, 94, 0.04)",
          border: "1px solid rgba(244, 63, 94, 0.08)",
        }}
      >
        <StatItem label="Sessions" value={String(todayStats.sessions_count)} />
        <StatItem label="Completed" value={String(todayStats.completed_count)} />
        <StatItem label="Focus time" value={formatDuration(todayStats.total_work_ms)} />
      </div>

      {/* Link to execution */}
      <div
        className="px-4 py-3 rounded-lg"
        style={{
          background: "rgba(107, 149, 240, 0.04)",
          border: "1px solid rgba(107, 149, 240, 0.08)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.65rem] font-mono uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
            Linked Execution
          </span>
          {linkedExecution && (
            <button
              onClick={() => setLinkedExecutionId(null)}
              className="text-[0.6rem] hover:opacity-80"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Clear
            </button>
          )}
        </div>
        {linkedExecution ? (
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[0.6rem] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "rgba(107,149,240,0.12)", color: "#6b95f0" }}
            >
              {linkedExecution.mode}
            </span>
            <span className="text-[0.8rem]" style={{ color: "var(--pn-text-primary)" }}>
              {linkedExecution.title || linkedExecution.intent_slug || "Untitled"}
            </span>
          </div>
        ) : (
          <select
            value=""
            onChange={(e) => setLinkedExecutionId(e.target.value || null)}
            className="mt-1 w-full text-[0.75rem] px-2 py-1.5 rounded-md outline-none"
            style={{
              background: "var(--pn-surface-3)",
              color: "var(--pn-text-primary)",
              border: "1px solid var(--pn-border-default)",
            }}
          >
            <option value="">Select an execution...</option>
            {activeExecutions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                [{ex.mode}] {ex.title || ex.intent_slug || "Untitled"} ({ex.status})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Timer */}
      <FocusTimer session={currentSession} />

      {/* History */}
      <SessionHistory />
    </div>
  );
}

function StatItem({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[0.6rem] font-mono uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
        {label}
      </span>
      <span className="text-[0.9rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms === 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
