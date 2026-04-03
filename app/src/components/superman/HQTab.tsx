import { useEffect, useState } from "react";
import { useExecutionStore } from "@/stores/execution-store";
import type { Execution } from "@/types/executions";

const STAT_COLORS = ["#6b95f0", "#eab308", "#22C55E", "#ef4444"];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isThisWeek(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
}

export function HQTab() {
  const [ready, setReady] = useState(false);
  const executions = useExecutionStore((s) => s.executions);
  const loading = useExecutionStore((s) => s.loading);
  const approve = useExecutionStore((s) => s.approve);

  useEffect(() => {
    async function init() {
      await useExecutionStore.getState().loadViaRest().catch(() => {});
      setReady(true);
      useExecutionStore.getState().connect().catch(() => {});
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
      </div>
    );
  }

  const intentSlugs = new Set(executions.filter((e) => e.intent_slug).map((e) => e.intent_slug));
  const totalIntents = intentSlugs.size;
  const inProgress = executions.filter((e) => e.status === "running" || e.status === "approved").length;
  const completedThisWeek = executions.filter((e) => e.status === "completed" && e.completed_at && isThisWeek(e.completed_at)).length;
  const blocked = executions.filter((e) => e.status === "failed").length;

  const needsApproval = executions.filter(
    (e) => (e.status === "created" || e.status === "awaiting_approval") && e.requires_approval,
  );

  const activeRuns = executions.filter(
    (e) => e.status === "running" || e.status === "approved",
  );

  const recentCompleted = executions
    .filter((e) => e.status === "completed")
    .sort((a, b) => new Date(b.completed_at ?? b.updated_at).getTime() - new Date(a.completed_at ?? a.updated_at).getTime())
    .slice(0, 5);

  const stats = [
    { label: "Total Intents", value: totalIntents },
    { label: "In Progress", value: inProgress },
    { label: "Completed (7d)", value: completedThisWeek },
    { label: "Blocked", value: blocked },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
        Command HQ
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="rounded-lg p-3 text-center"
            style={{ background: `${STAT_COLORS[i]}08`, border: `1px solid ${STAT_COLORS[i]}15` }}
          >
            <div className="text-[1.2rem] font-bold font-mono" style={{ color: STAT_COLORS[i] }}>
              {stat.value}
            </div>
            <div className="text-[0.55rem] font-mono uppercase mt-0.5" style={{ color: `${STAT_COLORS[i]}90` }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Needs Approval */}
      <Section title="Needs Approval" count={needsApproval.length} color="#eab308">
        {needsApproval.length === 0 ? (
          <EmptyState text="Nothing pending approval" />
        ) : (
          needsApproval.map((exec) => (
            <ApprovalRow key={exec.id} execution={exec} onApprove={() => approve(exec.id)} loading={loading} />
          ))
        )}
      </Section>

      {/* Active Runs */}
      <Section title="Active Runs" count={activeRuns.length} color="#6b95f0">
        {activeRuns.length === 0 ? (
          <EmptyState text="No active executions" />
        ) : (
          activeRuns.map((exec) => (
            <ActiveRow key={exec.id} execution={exec} />
          ))
        )}
      </Section>

      {/* Recently Completed */}
      <Section title="Recently Completed" count={recentCompleted.length} color="#22C55E">
        {recentCompleted.length === 0 ? (
          <EmptyState text="No recent completions" />
        ) : (
          recentCompleted.map((exec) => (
            <CompletedRow key={exec.id} execution={exec} />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  color,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly color: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <span className="text-[0.7rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          {title}
        </span>
        <span
          className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded-full"
          style={{ background: `${color}15`, color }}
        >
          {count}
        </span>
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.03)]">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { readonly text: string }) {
  return (
    <div className="px-3 py-4 text-center">
      <span className="text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>{text}</span>
    </div>
  );
}

function ModeBadge({ mode }: { readonly mode: string }) {
  const colors: Record<string, string> = {
    research: "#a78bfa",
    outline: "#6b95f0",
    implement: "#22C55E",
    review: "#5eead4",
    harvest: "#f59e0b",
    refactor: "#f43f5e",
  };
  const color = colors[mode] ?? "#6b7280";
  return (
    <span
      className="text-[0.5rem] font-mono uppercase px-1.5 py-0.5 rounded shrink-0"
      style={{ background: `${color}15`, color }}
    >
      {mode}
    </span>
  );
}

function ApprovalRow({
  execution,
  onApprove,
  loading,
}: {
  readonly execution: Execution;
  readonly onApprove: () => void;
  readonly loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <ModeBadge mode={execution.mode} />
      <span className="text-[0.7rem] flex-1 truncate" style={{ color: "var(--pn-text-secondary)" }}>
        {execution.intent_slug ?? execution.title}
      </span>
      <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
        {relativeTime(execution.inserted_at)}
      </span>
      <button
        onClick={onApprove}
        disabled={loading}
        className="px-2.5 py-1 rounded text-[0.6rem] font-mono transition-all hover:brightness-110 shrink-0"
        style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}
      >
        Approve
      </button>
    </div>
  );
}

function ActiveRow({ execution }: { readonly execution: Execution }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <ModeBadge mode={execution.mode} />
      <span className="text-[0.7rem] flex-1 truncate" style={{ color: "var(--pn-text-secondary)" }}>
        {execution.intent_slug ?? execution.title}
      </span>
      <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
        {relativeTime(execution.inserted_at)}
      </span>
      {/* Pulsing indicator */}
      <span
        className="w-2 h-2 rounded-full shrink-0 animate-pulse"
        style={{ background: "#6b95f0", boxShadow: "0 0 8px rgba(107,149,240,0.5)" }}
      />
    </div>
  );
}

function CompletedRow({ execution }: { readonly execution: Execution }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <ModeBadge mode={execution.mode} />
      <span className="text-[0.7rem] flex-1 truncate" style={{ color: "var(--pn-text-secondary)" }}>
        {execution.intent_slug ?? execution.title}
      </span>
      <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
        {relativeTime(execution.completed_at ?? execution.updated_at)}
      </span>
      {execution.result_path && (
        <span
          className="text-[0.5rem] font-mono px-1.5 py-0.5 rounded shrink-0"
          style={{ background: "rgba(94,234,212,0.1)", color: "#5eead4" }}
        >
          result
        </span>
      )}
    </div>
  );
}
