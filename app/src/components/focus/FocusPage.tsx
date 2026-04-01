import { useFocusStore } from "@/stores/focus-store";
import { FocusTimer } from "./FocusTimer";
import { SessionHistory } from "./SessionHistory";

export function FocusPage() {
  const currentSession = useFocusStore((s) => s.currentSession);
  const todayStats = useFocusStore((s) => s.todayStats);

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
