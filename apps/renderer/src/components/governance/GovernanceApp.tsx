import { useCallback, useEffect, useMemo, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { openApp } from "@/lib/window-manager";
import { useAgentsStore } from "@/stores/agents-store";
import { useExecutionStore } from "@/stores/execution-store";
import { useProposalsStore } from "@/stores/proposals-store";
import { useTasksStore } from "@/stores/tasks-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Execution } from "@/types/executions";
import type { Proposal } from "@/types/proposals";
import type { Task } from "@/types/tasks";

const config = APP_CONFIGS.governance;

type Tab = "oversight" | "policies" | "costs";

type ApprovalRule = {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly note: string;
};

type CostBudget = {
  readonly daily_used: number;
  readonly daily_limit: number;
  readonly weekly_used: number;
  readonly weekly_limit: number;
};

type AgentTrust = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly trust_score: number;
  readonly active_load: number;
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

const DEFAULT_RULES: readonly ApprovalRule[] = [
  {
    id: "high_confidence",
    label: "Auto-advance high-confidence work",
    enabled: true,
    note: "Queue pressure stays low when low-risk approvals do not wait on manual review.",
  },
  {
    id: "research_mode",
    label: "Permit research-mode runs without intervention",
    enabled: true,
    note: "Research is allowed to move fast as long as output remains non-destructive.",
  },
  {
    id: "outline_mode",
    label: "Require review for outline runs touching active intents",
    enabled: false,
    note: "Useful when planning drift becomes more costly than latency.",
  },
  {
    id: "small_scope",
    label: "Fast-path small-scope implementations",
    enabled: false,
    note: "Can be enabled when trust in execution quality is high enough.",
  },
  {
    id: "implement_mode",
    label: "Force human approval for implement mode",
    enabled: true,
    note: "Protects production-facing changes from autopilot drift.",
  },
] as const;

const MOCK_BUDGET: CostBudget = {
  daily_used: 0.42,
  daily_limit: 5.0,
  weekly_used: 2.15,
  weekly_limit: 25.0,
};

const BLOCKED_TASK_STATUSES = new Set<Task["status"]>(["blocked", "in_review", "requires_proposal"]);
const ACTIVE_EXECUTION_STATUSES = new Set<Execution["status"]>(["approved", "delegated", "running", "harvesting"]);

function budgetColor(ratio: number): string {
  if (ratio < 0.5) return "#10b981";
  if (ratio < 0.8) return "#f59e0b";
  return "#ef4444";
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

function trustFromSlug(slug: string): number {
  const hash = slug.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 68 + (hash % 24);
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}...` : id;
}

function copyText(value: string): void {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  void navigator.clipboard.writeText(value).catch(() => {});
}

export function GovernanceApp() {
  const [tab, setTab] = useState<Tab>("oversight");
  const [rules, setRules] = useState<readonly ApprovalRule[]>(DEFAULT_RULES);
  const [error, setError] = useState<string | null>(null);
  const budget: CostBudget = MOCK_BUDGET;

  const executions = useExecutionStore((state) => state.executions);
  const loadExecutions = useExecutionStore((state) => state.loadViaRest);
  const approveExecution = useExecutionStore((state) => state.approve);
  const cancelExecution = useExecutionStore((state) => state.cancel);

  const proposals = useProposalsStore((state) => state.proposals);
  const loadProposals = useProposalsStore((state) => state.loadViaRest);
  const approveProposal = useProposalsStore((state) => state.approve);
  const redirectProposal = useProposalsStore((state) => state.redirect);
  const killProposal = useProposalsStore((state) => state.kill);

  const tasks = useTasksStore((state) => state.tasks);
  const loadTasks = useTasksStore((state) => state.loadViaRest);

  const agents = useAgentsStore((state) => state.agents);
  const loadAgents = useAgentsStore((state) => state.loadViaRest);

  const refresh = useCallback(async () => {
    setError(null);
    const results = await Promise.allSettled([
      loadExecutions(),
      loadProposals(),
      loadTasks(),
      loadAgents(),
    ]);

    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") {
      setError(failed.reason instanceof Error ? failed.reason.message : "Some governance sources failed to load");
    }
  }, [loadAgents, loadExecutions, loadProposals, loadTasks]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const approvalQueue = useMemo(
    () => executions.filter((execution) => execution.status === "awaiting_approval").slice(0, 6),
    [executions],
  );

  const activeExecutions = useMemo(
    () => executions.filter((execution) => ACTIVE_EXECUTION_STATUSES.has(execution.status)),
    [executions],
  );

  const proposalQueue = useMemo(
    () =>
      proposals
        .filter((proposal) => proposal.status === "queued" || proposal.status === "reviewing" || proposal.status === "generating")
        .slice(0, 6),
    [proposals],
  );

  const blockedTasks = useMemo(
    () => tasks.filter((task) => BLOCKED_TASK_STATUSES.has(task.status)).slice(0, 6),
    [tasks],
  );

  const trustScores = useMemo<readonly AgentTrust[]>(
    () =>
      agents.map((agent) => ({
        id: agent.id,
        slug: agent.slug,
        name: agent.name,
        trust_score: trustFromSlug(agent.slug),
        active_load: activeExecutions.filter((execution) => execution.title.toLowerCase().includes(agent.slug.toLowerCase())).length,
      })),
    [activeExecutions, agents],
  );

  const governanceMirrors = useMemo<readonly MirrorItem[]>(() => {
    const entries: MirrorItem[] = [];

    approvalQueue.slice(0, 2).forEach((execution, index) => {
      entries.push({
        id: `approval-view-${execution.id}`,
        title: index === 0 ? "Inspect approval candidate" : "Inspect queued execution",
        detail: `${execution.title} · ${execution.mode} · ${shortId(execution.id)}`,
        accent: "#38bdf8",
        route: { method: "GET", path: `/api/executions/${execution.id}` },
        cli: `ema backend execution view ${execution.id}`,
      });
    });

    approvalQueue.slice(0, 1).forEach((execution) => {
      entries.push({
        id: `approval-approve-${execution.id}`,
        title: "Approve execution",
        detail: `Release ${execution.title} from governance review.`,
        accent: "#10b981",
        route: { method: "POST", path: `/api/executions/${execution.id}/approve` },
        cli: `ema backend execution approve ${execution.id}`,
      });
    });

    proposalQueue.slice(0, 1).forEach((proposal) => {
      entries.push({
        id: `proposal-approve-${proposal.id}`,
        title: "Approve proposal",
        detail: `${proposal.title} · rev ${proposal.revision} · ${shortId(proposal.id)}`,
        accent: "#a78bfa",
        route: {
          method: "POST",
          path: `/api/proposals/${proposal.id}/approve`,
          payload: '{"actor_id":"actor_human_owner"}',
        },
        cli: `ema backend proposal approve ${proposal.id} --actor-id actor_human_owner`,
      });
    });

    proposalQueue.slice(0, 1).forEach((proposal) => {
      entries.push({
        id: `proposal-reject-${proposal.id}`,
        title: "Reject or redirect proposal",
        detail: `Push ${proposal.title} back with tighter scope.`,
        accent: "#f59e0b",
        route: {
          method: "POST",
          path: `/api/proposals/${proposal.id}/reject`,
          payload: '{"actor_id":"actor_human_owner","reason":"Tighten scope and revise execution plan"}',
        },
        cli: `ema backend proposal reject ${proposal.id} --reason "Tighten scope and revise execution plan" --actor-id actor_human_owner`,
      });
    });

    blockedTasks.slice(0, 1).forEach((task) => {
      entries.push({
        id: `task-view-${task.id}`,
        title: "Inspect blocked task",
        detail: `${task.title} · ${task.status.replaceAll("_", " ")} · ${shortId(task.id)}`,
        accent: "#f59e0b",
        route: { method: "GET", path: `/api/tasks/${task.id}` },
        cli: `ema backend task view ${task.id}`,
      });
      entries.push({
        id: `task-transition-${task.id}`,
        title: "Transition task status",
        detail: `Move ${task.title} forward once governance clears the blocker.`,
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
        id: "approval-list-default",
        title: "Audit approval queue",
        detail: "Fetch the pending execution queue directly from the backend.",
        accent: "#10b981",
        route: { method: "GET", path: "/api/executions?status=awaiting_approval" },
        cli: "ema backend execution list --status awaiting_approval",
      },
      {
        id: "proposal-list-default",
        title: "Audit proposal queue",
        detail: "Inspect durable proposals waiting on governance review.",
        accent: "#a78bfa",
        route: { method: "GET", path: "/api/proposals?status=queued" },
        cli: "ema backend proposal list --status queued",
      },
      {
        id: "task-list-default",
        title: "Inspect blocked work",
        detail: "Track tasks that need human intervention or proposal generation.",
        accent: "#f59e0b",
        route: { method: "GET", path: "/api/tasks?status=blocked" },
        cli: "ema backend task list --status blocked",
      },
    ];
  }, [approvalQueue, blockedTasks, proposalQueue]);

  const dailyRatio = budget.daily_used / budget.daily_limit;
  const weeklyRatio = budget.weekly_used / budget.weekly_limit;

  function toggleRule(id: string) {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  }

  function openSurface(appId: string) {
    void openApp(appId);
  }

  return (
    <AppWindowChrome
      appId="governance"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={tab === "oversight" ? "Oversight" : tab === "policies" ? "Policies" : "Costs"}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["oversight", "policies", "costs"] as const).map((item) => {
          const active = tab === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className="rounded-full px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.14em]"
              style={{
                background: active ? "rgba(16,185,129,0.16)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? "rgba(16,185,129,0.28)" : "rgba(255,255,255,0.06)"}`,
                color: active ? "#a7f3d0" : "var(--pn-text-tertiary)",
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
          style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.18)" }}
        >
          {error}
        </div>
      )}

      {tab === "oversight" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Awaiting Approval" value={approvalQueue.length} accent="#10b981" note="Execution queue requiring a human go/no-go." />
            <MetricCard label="Proposal Pressure" value={proposalQueue.length} accent="#a78bfa" note="Generated or queued proposals still waiting for review." />
            <MetricCard label="Blocked Tasks" value={blockedTasks.length} accent="#f59e0b" note="Tasks currently blocked, in review, or requiring proposals." />
            <MetricCard label="Active Agents" value={trustScores.length} accent="#38bdf8" note="Governed actors currently visible to the runtime." />
          </div>

          <Section
            title="Connected Surfaces"
            action={(
              <div className="flex flex-wrap gap-2">
                <SurfaceLink label="Executions" onClick={() => openSurface("executions")} />
                <SurfaceLink label="Proposals" onClick={() => openSurface("proposals")} />
                <SurfaceLink label="Tasks" onClick={() => openSurface("tasks")} />
                <SurfaceLink label="Agents" onClick={() => openSurface("agents")} />
              </div>
            )}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <QueuePanel
                title="Execution Approval Queue"
                emptyLabel="No executions currently waiting on approval."
                items={approvalQueue}
                renderItem={(execution) => (
                  <ExecutionApprovalRow
                    key={execution.id}
                    execution={execution}
                    onApprove={() => void approveExecution(execution.id)}
                    onCancel={() => void cancelExecution(execution.id)}
                  />
                )}
              />
              <QueuePanel
                title="Proposal Review Queue"
                emptyLabel="No proposals are waiting in the governance funnel."
                items={proposalQueue}
                renderItem={(proposal) => (
                  <ProposalQueueRow
                    key={proposal.id}
                    proposal={proposal}
                    onApprove={() => void approveProposal(proposal.id)}
                    onRedirect={() => void redirectProposal(proposal.id, "Tighten scope and clarify execution plan from governance queue.")}
                    onKill={() => void killProposal(proposal.id)}
                  />
                )}
              />
            </div>
          </Section>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <Section title="Task Friction Map">
              <div className="flex flex-col gap-2">
                {blockedTasks.length === 0 ? (
                  <EmptyCopy>No task blockers at the moment.</EmptyCopy>
                ) : (
                  blockedTasks.map((task) => (
                    <TaskBlockerRow key={task.id} task={task} />
                  ))
                )}
              </div>
            </Section>
            <Section title="Agent Trust + Load">
              <div className="flex flex-col gap-2">
                {trustScores.length === 0 ? (
                  <EmptyCopy>No agents available.</EmptyCopy>
                ) : (
                  trustScores.map((agent) => (
                    <TrustBar key={agent.id} name={agent.slug} score={agent.trust_score} activeLoad={agent.active_load} />
                  ))
                )}
              </div>
            </Section>
          </div>

          <Section title="Backend + CLI Mirrors">
            <div className="grid gap-3 xl:grid-cols-2">
              {governanceMirrors.map((item) => (
                <MirrorCard key={item.id} item={item} />
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === "policies" && (
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Section title="Approval Policy Set">
            <div className="flex flex-col gap-3">
              {rules.map((rule) => (
                <label
                  key={rule.id}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{
                    background: rule.enabled ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${rule.enabled ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.06)"}`,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                    className="mt-1 accent-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="text-[0.76rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                      {rule.label}
                    </div>
                    <div className="mt-1 text-[0.68rem] leading-[1.55]" style={{ color: "var(--pn-text-secondary)" }}>
                      {rule.note}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Section>

          <Section title="What Governance Is Watching">
            <div className="flex flex-col gap-3 text-[0.72rem]" style={{ color: "var(--pn-text-secondary)" }}>
              <PolicyNote
                title="Execution approvals"
                body="Implement-mode runs and high-risk objectives stay visible here until you explicitly approve or cancel them."
              />
              <PolicyNote
                title="Proposal throughput"
                body="Queued proposals are surfaced from the active proposal store so governance stays attached to actual backlog pressure."
              />
              <PolicyNote
                title="Task friction"
                body="Blocked, review, and proposal-required tasks are treated as operational drag and show up alongside approvals."
              />
              <PolicyNote
                title="Agent trust"
                body="Agent trust is still heuristic, but the view is now anchored to the live agent roster rather than mock rows."
              />
            </div>
          </Section>
        </div>
      )}

      {tab === "costs" && (
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Section title="Budget Envelope">
            <BudgetRow label="Today" used={budget.daily_used} limit={budget.daily_limit} ratio={dailyRatio} />
            <div className="h-3" />
            <BudgetRow label="This Week" used={budget.weekly_used} limit={budget.weekly_limit} ratio={weeklyRatio} />
          </Section>

          <Section title="Cost Context">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Active Runs" value={activeExecutions.length} accent="#10b981" note="Live runs currently consuming budget." />
              <MetricCard label="Queued Reviews" value={proposalQueue.length} accent="#a78bfa" note="Upstream queue waiting to become work." />
              <MetricCard label="Blocked Tasks" value={blockedTasks.length} accent="#f59e0b" note="Operational drag that often increases rerun cost." />
              <MetricCard label="Approval Burden" value={approvalQueue.length} accent="#38bdf8" note="Human attention currently tied up in approvals." />
            </div>
          </Section>
        </div>
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
        <div
          className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--pn-text-muted)" }}
        >
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

function QueuePanel<T>({
  title,
  items,
  emptyLabel,
  renderItem,
}: {
  title: string;
  items: readonly T[];
  emptyLabel: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mb-3 text-[0.72rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
        {title}
      </div>
      <div className="flex flex-col gap-2">
        {items.length === 0 ? <EmptyCopy>{emptyLabel}</EmptyCopy> : items.map(renderItem)}
      </div>
    </div>
  );
}

function ExecutionApprovalRow({
  execution,
  onApprove,
  onCancel,
}: {
  execution: Execution;
  onApprove: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.76rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            {execution.title}
          </div>
          <div className="mt-1 text-[0.65rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
            {execution.mode} · {execution.project_slug ?? "global"} · {formatRelativeTime(execution.updated_at)}
          </div>
        </div>
        <span className="rounded-full px-2 py-1 text-[0.56rem] uppercase tracking-[0.14em]" style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>
          review
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <InlineAction label="Approve" accent="#10b981" onClick={onApprove} />
        <InlineAction label="Cancel" accent="#ef4444" onClick={onCancel} />
      </div>
    </div>
  );
}

function ProposalQueueRow({
  proposal,
  onApprove,
  onRedirect,
  onKill,
}: {
  proposal: Proposal;
  onApprove: () => void;
  onRedirect: () => void;
  onKill: () => void;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.76rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            {proposal.title}
          </div>
          <div className="mt-1 text-[0.68rem] leading-[1.5]" style={{ color: "var(--pn-text-secondary)" }}>
            {proposal.summary || `${proposal.plan_steps.length} planned steps`}
          </div>
        </div>
        <span className="rounded-full px-2 py-1 text-[0.56rem] uppercase tracking-[0.14em]" style={{ background: "rgba(167,139,250,0.12)", color: "#c4b5fd" }}>
          {proposal.status}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <InlineAction label="Approve" accent="#10b981" onClick={onApprove} />
        <InlineAction label="Redirect" accent="#f59e0b" onClick={onRedirect} />
        <InlineAction label="Kill" accent="#ef4444" onClick={onKill} />
      </div>
    </div>
  );
}

function TaskBlockerRow({ task }: { task: Task }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="min-w-0">
        <div className="truncate text-[0.74rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
          {task.title}
        </div>
        <div className="mt-1 text-[0.64rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
          P{task.priority} · {task.project_id ?? "no-project"} · {formatRelativeTime(task.created_at)}
        </div>
      </div>
      <span className="rounded-full px-2 py-1 text-[0.56rem] uppercase tracking-[0.14em]" style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>
        {task.status.replaceAll("_", " ")}
      </span>
    </div>
  );
}

function TrustBar({
  name,
  score,
  activeLoad,
}: {
  name: string;
  score: number;
  activeLoad: number;
}) {
  const color = score >= 84 ? "#10b981" : score >= 74 ? "#38bdf8" : "#f59e0b";
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[0.72rem] font-mono" style={{ color: "var(--pn-text-secondary)" }}>
          {name}
        </span>
        <span className="text-[0.64rem]" style={{ color: "var(--pn-text-muted)" }}>
          {activeLoad} active
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
        </div>
        <span className="w-10 text-right text-[0.68rem] font-mono" style={{ color }}>
          {score}%
        </span>
      </div>
    </div>
  );
}

function InlineAction({
  label,
  accent,
  onClick,
}: {
  label: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.14em]"
      style={{
        background: `${accent}18`,
        border: `1px solid ${accent}26`,
        color: accent,
      }}
    >
      {label}
    </button>
  );
}

function PolicyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[0.74rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
        {title}
      </div>
      <div className="mt-1 text-[0.68rem] leading-[1.55]" style={{ color: "var(--pn-text-secondary)" }}>
        {body}
      </div>
    </div>
  );
}

function MirrorCard({ item }: { item: MirrorItem }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${item.accent}24`,
      }}
    >
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

function EmptyCopy({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.68rem]" style={{ color: "var(--pn-text-muted)" }}>{children}</div>;
}

function BudgetRow({
  label,
  used,
  limit,
  ratio,
}: {
  label: string;
  used: number;
  limit: number;
  ratio: number;
}) {
  const color = budgetColor(ratio);
  const pct = Math.min(ratio * 100, 100);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
          {label}
        </span>
        <span className="text-[0.7rem] font-mono" style={{ color }}>
          ${used.toFixed(2)} / ${limit.toFixed(2)}
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-1 text-right">
        <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}
