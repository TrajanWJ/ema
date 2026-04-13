import { useCallback, useEffect, useMemo, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { openApp } from "@/lib/window-manager";
import { useExecutionStore } from "@/stores/execution-store";
import { useProposalsStore } from "@/stores/proposals-store";
import { useTasksStore } from "@/stores/tasks-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Execution } from "@/types/executions";
import type { Task } from "@/types/tasks";

const config = APP_CONFIGS.babysitter;

type Tab = "health" | "incidents" | "streams";

type SubsystemHealth = {
  readonly name: string;
  readonly status: "ok" | "degraded" | "down";
  readonly detail: string;
};

type StreamInfo = {
  readonly name: string;
  readonly rate: number;
};

type Incident = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly severity: "warning" | "critical";
  readonly surface: "executions" | "proposals" | "tasks";
};

type MirrorItem = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly accent: string;
  readonly route: {
    readonly method: "GET" | "POST";
    readonly path: string;
    readonly payload?: string;
  };
  readonly cli: string;
};

const ACTIVE_EXECUTION_STATUSES = new Set<Execution["status"]>(["approved", "delegated", "running", "harvesting"]);
const WARN_TASK_STATUSES = new Set<Task["status"]>(["blocked", "requires_proposal"]);

function statusDot(status: "ok" | "degraded" | "down"): { color: string; symbol: string } {
  switch (status) {
    case "ok":
      return { color: "#10b981", symbol: "●" };
    case "degraded":
      return { color: "#f59e0b", symbol: "●" };
    case "down":
      return { color: "#ef4444", symbol: "○" };
  }
}

function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(deltaMs / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function incidentAgeMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}...` : id;
}

function copyText(value: string): void {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  void navigator.clipboard.writeText(value).catch(() => {});
}

export function BabysitterApp() {
  const [tab, setTab] = useState<Tab>("health");
  const [error, setError] = useState<string | null>(null);

  const executions = useExecutionStore((state) => state.executions);
  const loadExecutions = useExecutionStore((state) => state.loadViaRest);

  const proposals = useProposalsStore((state) => state.proposals);
  const loadProposals = useProposalsStore((state) => state.loadViaRest);

  const tasks = useTasksStore((state) => state.tasks);
  const loadTasks = useTasksStore((state) => state.loadViaRest);

  const refresh = useCallback(async () => {
    setError(null);
    const results = await Promise.allSettled([loadExecutions(), loadProposals(), loadTasks()]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") {
      setError(failed.reason instanceof Error ? failed.reason.message : "Some babysitter sources failed to load");
    }
  }, [loadExecutions, loadProposals, loadTasks]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeExecutions = useMemo(
    () => executions.filter((execution) => ACTIVE_EXECUTION_STATUSES.has(execution.status)),
    [executions],
  );

  const staleExecutions = useMemo(
    () =>
      activeExecutions
        .filter((execution) => incidentAgeMinutes(execution.updated_at) >= 45)
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        .slice(0, 6),
    [activeExecutions],
  );

  const failedExecutions = useMemo(
    () =>
      executions
        .filter((execution) => execution.status === "failed")
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 4),
    [executions],
  );

  const agingProposals = useMemo(
    () =>
      proposals
        .filter((proposal) => proposal.status === "queued" && incidentAgeMinutes(proposal.created_at) >= 60)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, 5),
    [proposals],
  );

  const blockedTasks = useMemo(
    () => tasks.filter((task) => WARN_TASK_STATUSES.has(task.status)).slice(0, 5),
    [tasks],
  );

  const subsystems = useMemo<readonly SubsystemHealth[]>(
    () => [
      {
        name: "Executions",
        status: staleExecutions.length > 0 ? "degraded" : "ok",
        detail: `${activeExecutions.length} active · ${failedExecutions.length} recent failures`,
      },
      {
        name: "Proposals",
        status: agingProposals.length > 0 ? "degraded" : "ok",
        detail: `${agingProposals.length} aging queued proposal${agingProposals.length === 1 ? "" : "s"}`,
      },
      {
        name: "Tasks",
        status: blockedTasks.length > 2 ? "degraded" : "ok",
        detail: `${blockedTasks.length} blocked or proposal-bound task${blockedTasks.length === 1 ? "" : "s"}`,
      },
      {
        name: "Approval Loop",
        status: activeExecutions.length > 8 ? "degraded" : "ok",
        detail: activeExecutions.length > 0 ? "Operator oversight required" : "Quiet",
      },
    ],
    [activeExecutions.length, agingProposals.length, blockedTasks.length, failedExecutions.length, staleExecutions.length],
  );

  const incidents = useMemo<readonly Incident[]>(
    () => [
      ...staleExecutions.map((execution) => ({
        id: `stale:${execution.id}`,
        title: execution.title,
        detail: `${execution.mode} · no update for ${formatRelativeTime(execution.updated_at)}`,
        severity: "critical" as const,
        surface: "executions" as const,
      })),
      ...failedExecutions.map((execution) => ({
        id: `failed:${execution.id}`,
        title: execution.title,
        detail: `failed ${formatRelativeTime(execution.updated_at)}`,
        severity: "warning" as const,
        surface: "executions" as const,
      })),
      ...agingProposals.map((proposal) => ({
        id: `proposal:${proposal.id}`,
        title: proposal.title,
        detail: `queued ${formatRelativeTime(proposal.created_at)} · ${proposal.plan_steps.length} steps`,
        severity: "warning" as const,
        surface: "proposals" as const,
      })),
      ...blockedTasks.map((task) => ({
        id: `task:${task.id}`,
        title: task.title,
        detail: `${task.status.replaceAll("_", " ")} · opened ${formatRelativeTime(task.created_at)}`,
        severity: "warning" as const,
        surface: "tasks" as const,
      })),
    ],
    [agingProposals, blockedTasks, failedExecutions, staleExecutions],
  );

  const streams = useMemo<readonly StreamInfo[]>(
    () => [
      { name: "executions", rate: activeExecutions.length },
      { name: "stale runs", rate: staleExecutions.length },
      { name: "queued proposals", rate: agingProposals.length },
      { name: "blocked tasks", rate: blockedTasks.length },
      { name: "failed runs", rate: failedExecutions.length },
    ],
    [activeExecutions.length, agingProposals.length, blockedTasks.length, failedExecutions.length, staleExecutions.length],
  );

  const runbookMirrors = useMemo<readonly MirrorItem[]>(() => {
    const entries: MirrorItem[] = [];

    staleExecutions.slice(0, 1).forEach((execution) => {
      entries.push({
        id: `stale-view-${execution.id}`,
        title: "Inspect stale execution",
        detail: `${execution.title} has been idle since ${formatRelativeTime(execution.updated_at)}.`,
        accent: "#ef4444",
        route: { method: "GET", path: `/api/executions/${execution.id}` },
        cli: `ema backend execution view ${execution.id}`,
      });
    });

    failedExecutions.slice(0, 1).forEach((execution) => {
      entries.push({
        id: `failed-view-${execution.id}`,
        title: "Inspect failed execution",
        detail: `${execution.title} failed recently and needs a recovery decision.`,
        accent: "#f59e0b",
        route: { method: "GET", path: `/api/executions/${execution.id}` },
        cli: `ema backend execution view ${execution.id}`,
      });
    });

    agingProposals.slice(0, 1).forEach((proposal) => {
      entries.push({
        id: `proposal-approve-${proposal.id}`,
        title: "Clear aging proposal",
        detail: `${proposal.title} has been queued for ${formatRelativeTime(proposal.created_at)}.`,
        accent: "#a78bfa",
        route: {
          method: "POST",
          path: `/api/proposals/${proposal.id}/approve`,
          payload: '{"actor_id":"actor_human_owner"}',
        },
        cli: `ema backend proposal approve ${proposal.id} --actor-id actor_human_owner`,
      });
    });

    blockedTasks.slice(0, 1).forEach((task) => {
      entries.push({
        id: `task-view-${task.id}`,
        title: "Inspect blocked task",
        detail: `${task.title} · ${task.status.replaceAll("_", " ")} · ${shortId(task.id)}`,
        accent: "#38bdf8",
        route: { method: "GET", path: `/api/tasks/${task.id}` },
        cli: `ema backend task view ${task.id}`,
      });
      entries.push({
        id: `task-transition-${task.id}`,
        title: "Push task forward",
        detail: `Advance ${task.title} after operator intervention clears the issue.`,
        accent: "#10b981",
        route: {
          method: "POST",
          path: `/api/tasks/${task.id}/transition`,
          payload: '{"status":"in_progress"}',
        },
        cli: `ema backend task transition ${task.id} --status in_progress`,
      });
    });

    if (entries.length > 0) return entries;

    return [
      {
        id: "failed-list-default",
        title: "Scan failures",
        detail: "Pull the failing execution queue from the backend when the room is quiet.",
        accent: "#ef4444",
        route: { method: "GET", path: "/api/executions?status=failed" },
        cli: "ema backend execution list --status failed",
      },
      {
        id: "proposal-list-default",
        title: "Scan aging proposals",
        detail: "Check whether review backlog is building faster than operators can clear it.",
        accent: "#a78bfa",
        route: { method: "GET", path: "/api/proposals?status=queued" },
        cli: "ema backend proposal list --status queued",
      },
      {
        id: "task-list-default",
        title: "Scan blocked tasks",
        detail: "Watch for proposal-bound or blocked tasks before they stall the line.",
        accent: "#38bdf8",
        route: { method: "GET", path: "/api/tasks?status=blocked" },
        cli: "ema backend task list --status blocked",
      },
    ];
  }, [agingProposals, blockedTasks, failedExecutions, staleExecutions]);

  const criticalCount = incidents.filter((incident) => incident.severity === "critical").length;
  const warningCount = incidents.filter((incident) => incident.severity === "warning").length;

  function openSurface(appId: string) {
    void openApp(appId);
  }

  return (
    <AppWindowChrome
      appId="babysitter"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={tab === "health" ? "Health" : tab === "incidents" ? "Incidents" : "Streams"}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["health", "incidents", "streams"] as const).map((item) => {
          const active = tab === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className="rounded-full px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.14em]"
              style={{
                background: active ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? "rgba(245,158,11,0.26)" : "rgba(255,255,255,0.06)"}`,
                color: active ? "#fde68a" : "var(--pn-text-tertiary)",
              }}
            >
              {item}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => void refresh()}
          className="ml-auto rounded-full px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.14em]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "var(--pn-text-secondary)",
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="mb-3 rounded-xl px-3 py-2 text-[0.72rem]"
          style={{ background: "rgba(245,158,11,0.1)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.18)" }}
        >
          {error}
        </div>
      )}

      {tab === "health" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Critical" value={criticalCount} accent="#ef4444" note="Runs that have likely stalled and need attention." />
            <MetricCard label="Warnings" value={warningCount} accent="#f59e0b" note="Queue pressure, failures, and operational drag." />
            <MetricCard label="Active Runs" value={activeExecutions.length} accent="#38bdf8" note="Current execution load across the runtime." />
            <MetricCard label="Blocked Work" value={blockedTasks.length} accent="#a78bfa" note="Tasks and proposals building pressure in the system." />
          </div>

          <Section
            title="Subsystem Health"
            action={(
              <div className="flex flex-wrap gap-2">
                <SurfaceLink label="Executions" onClick={() => openSurface("executions")} />
                <SurfaceLink label="Proposals" onClick={() => openSurface("proposals")} />
                <SurfaceLink label="Tasks" onClick={() => openSurface("tasks")} />
              </div>
            )}
          >
            <div className="flex flex-col gap-2">
              {subsystems.map((subsystem) => {
                const dot = statusDot(subsystem.status);
                return (
                  <div key={subsystem.name} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ color: dot.color, fontSize: "11px" }}>{dot.symbol}</span>
                    <span className="w-32 text-[0.74rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                      {subsystem.name}
                    </span>
                    <span className="text-[0.68rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                      {subsystem.detail}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          <div className="grid gap-3 lg:grid-cols-2">
            <Section title="Stale Execution Watch">
              <div className="flex flex-col gap-2">
                {staleExecutions.length === 0 ? (
                  <EmptyCopy>No stale executions right now.</EmptyCopy>
                ) : (
                  staleExecutions.map((execution) => (
                    <ExecutionSignalRow key={execution.id} execution={execution} tone="critical" />
                  ))
                )}
              </div>
            </Section>
            <Section title="Recent Failure Watch">
              <div className="flex flex-col gap-2">
                {failedExecutions.length === 0 ? (
                  <EmptyCopy>No recent failed executions.</EmptyCopy>
                ) : (
                  failedExecutions.map((execution) => (
                    <ExecutionSignalRow key={execution.id} execution={execution} tone="warning" />
                  ))
                )}
              </div>
            </Section>
          </div>
        </div>
      )}

      {tab === "incidents" && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Section title="Active Incidents">
            <div className="flex flex-col gap-2">
              {incidents.length === 0 ? (
                <EmptyCopy>No incidents are open.</EmptyCopy>
              ) : (
                incidents.map((incident) => (
                  <IncidentRow
                    key={incident.id}
                    incident={incident}
                    onOpen={() => openSurface(incident.surface)}
                  />
                ))
              )}
            </div>
          </Section>

          <Section title="Backend + CLI Runbooks">
            <div className="flex flex-col gap-3">
              {runbookMirrors.map((item) => (
                <MirrorCard key={item.id} item={item} />
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === "streams" && (
        <Section title="Pressure Streams">
          <div className="flex flex-col gap-2">
            {streams.map((stream) => (
              <StreamRow key={stream.name} name={stream.name} rate={stream.rate} />
            ))}
          </div>
        </Section>
      )}
    </AppWindowChrome>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SurfaceLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[0.64rem] uppercase tracking-[0.14em]"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        color: "var(--pn-text-secondary)",
      }}
    >
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: number;
  accent: string;
  note: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `linear-gradient(180deg, ${accent}18, rgba(255,255,255,0.02))`,
        border: `1px solid ${accent}22`,
      }}
    >
      <div className="text-[0.62rem] uppercase tracking-[0.16em]" style={{ color: "var(--pn-text-muted)" }}>
        {label}
      </div>
      <div className="mt-2 text-[1.45rem] font-semibold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-2 text-[0.68rem] leading-[1.5]" style={{ color: "var(--pn-text-secondary)" }}>
        {note}
      </div>
    </div>
  );
}

function ExecutionSignalRow({
  execution,
  tone,
}: {
  execution: Execution;
  tone: "critical" | "warning";
}) {
  const accent = tone === "critical" ? "#ef4444" : "#f59e0b";
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${accent}24` }}>
      <div className="text-[0.76rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
        {execution.title}
      </div>
      <div className="mt-1 text-[0.65rem] font-mono" style={{ color: accent }}>
        {execution.mode} · {execution.status} · {formatRelativeTime(execution.updated_at)}
      </div>
    </div>
  );
}

function IncidentRow({
  incident,
  onOpen,
}: {
  incident: Incident;
  onOpen: () => void;
}) {
  const accent = incident.severity === "critical" ? "#ef4444" : "#f59e0b";
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${accent}24` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.76rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            {incident.title}
          </div>
          <div className="mt-1 text-[0.68rem] leading-[1.5]" style={{ color: "var(--pn-text-secondary)" }}>
            {incident.detail}
          </div>
        </div>
        <span className="rounded-full px-2 py-1 text-[0.56rem] uppercase tracking-[0.14em]" style={{ background: `${accent}18`, color: accent }}>
          {incident.surface}
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 rounded-full px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.14em]"
        style={{ background: `${accent}18`, border: `1px solid ${accent}24`, color: accent }}
      >
        Open Surface
      </button>
    </div>
  );
}

function MirrorCard({ item }: { item: MirrorItem }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[0.74rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
        {item.title}
      </div>
      <div className="mt-1 text-[0.68rem] leading-[1.55]" style={{ color: "var(--pn-text-secondary)" }}>
        {item.detail}
      </div>
      <CopyRow
        label={`${item.route.method} ${item.route.path}`}
        accent={item.accent}
        value={`${item.route.method} ${item.route.path}`}
      />
      {item.route.payload && (
        <div className="mt-2 rounded-lg px-2.5 py-2 text-[0.62rem] font-mono" style={{ background: "rgba(255,255,255,0.03)", color: "var(--pn-text-muted)" }}>
          body {item.route.payload}
        </div>
      )}
      <CopyRow label={item.cli} accent={item.accent} value={item.cli} />
    </div>
  );
}

function CopyRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${accent}20`,
      }}
    >
      <div className="min-w-0 flex-1 truncate text-[0.62rem] font-mono" style={{ color: "var(--pn-text-secondary)" }}>
        {label}
      </div>
      <button
        type="button"
        onClick={() => copyText(value)}
        className="rounded-full px-2.5 py-1 text-[0.54rem] uppercase tracking-[0.12em]"
        style={{ background: `${accent}18`, border: `1px solid ${accent}24`, color: accent }}
      >
        Copy
      </button>
    </div>
  );
}

function StreamRow({ name, rate }: { name: string; rate: number }) {
  const maxBars = 10;
  const filled = Math.min(rate, maxBars);
  const barColor = rate >= 5 ? "#ef4444" : rate >= 2 ? "#f59e0b" : rate >= 1 ? "#38bdf8" : "rgba(255,255,255,0.08)";
  const label = rate > 0 ? `${rate} active` : "quiet";

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 truncate text-[0.7rem] font-mono" style={{ color: "var(--pn-text-secondary)" }}>
        {name}
      </span>
      <div className="flex flex-1 gap-0.5">
        {Array.from({ length: maxBars }, (_, index) => (
          <div
            key={index}
            className="h-2 flex-1 rounded-sm"
            style={{
              background: index < filled ? barColor : "rgba(255,255,255,0.06)",
            }}
          />
        ))}
      </div>
      <span className="w-20 text-right text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

function EmptyCopy({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.68rem]" style={{ color: "var(--pn-text-muted)" }}>{children}</div>;
}
