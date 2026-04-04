import { useEffect, useMemo, type ReactNode } from "react";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { useProjectStore } from "@/stores/project-store";
import { useProjectsStore } from "@/stores/projects-store";

const STAT_COLORS = ["#6b95f0", "#eab308", "#22C55E", "#ef4444"];
const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "#6b95f0",
  in_progress: "#22C55E",
  blocked: "#ef4444",
  in_review: "#eab308",
  proposed: "#94a3b8",
};
const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  queued: "#94a3b8",
  reviewing: "#eab308",
  approved: "#22C55E",
  redirected: "#f97316",
  killed: "#ef4444",
  generating: "#6b95f0",
  failed: "#ef4444",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function HQTab() {
  const projects = useProjectsStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const context = useProjectStore((s) => s.context);
  const loadingContext = useProjectStore((s) => s.loadingContext);
  const contextError = useProjectStore((s) => s.contextError);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const loadProjectContext = useProjectStore((s) => s.loadProjectContext);
  const connectProjectChannel = useProjectStore((s) => s.connectProjectChannel);
  const disconnectProjectChannel = useProjectStore((s) => s.disconnectProjectChannel);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.slug,
        label: `${project.icon ?? "▪"} ${project.name}`,
      })),
    [projects],
  );

  useEffect(() => {
    if (projects.length === 0 || currentProject) return;
    const preferred = projects.find((project) => project.status === "active")
      ?? projects.find((project) => project.status === "incubating")
      ?? projects[0];
    if (preferred) {
      setCurrentProject(preferred.slug);
    }
  }, [currentProject, projects, setCurrentProject]);

  useEffect(() => {
    if (!currentProject) return;
    void loadProjectContext(currentProject);
    void connectProjectChannel(currentProject).catch(() => {});
  }, [connectProjectChannel, currentProject, loadProjectContext]);

  useEffect(() => () => {
    disconnectProjectChannel();
  }, [disconnectProjectChannel]);

  const activeTasks = context?.active_tasks ?? [];
  const recentProposals = context?.recent_proposals ?? [];
  const activeCampaign = context?.active_campaign;
  const lastExecution = context?.last_execution;
  const taskByStatus = getAggregateByStatus(context, "tasks");
  const proposalByStatus = getAggregateByStatus(context, "proposals");

  const activeTaskCount = getAggregateTotal(context, "tasks") ?? activeTasks.length;
  const inProgress = getCount(taskByStatus, "in_progress");
  const blocked = getCount(taskByStatus, "blocked");
  const approvedProposals = getCount(proposalByStatus, "approved");
  const stats = [
    { label: "Active Tasks", value: activeTaskCount },
    { label: "In Progress", value: inProgress },
    { label: "Approved Props", value: approvedProposals },
    { label: "Blocked", value: blocked + (lastExecution?.status === "failed" ? 1 : 0) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          Command HQ
        </div>
        <div className="w-56 max-w-full">
          <GlassSelect
            value={currentProject ?? ""}
            onChange={(slug) => {
              setCurrentProject(slug);
              void loadProjectContext(slug);
              void connectProjectChannel(slug).catch(() => {});
            }}
            options={projectOptions}
            placeholder="Select project..."
            className="w-full"
            size="sm"
          />
        </div>
      </div>

      {!currentProject ? (
        <EmptyState text="No projects available" />
      ) : loadingContext && !context ? (
        <LoadingSkeleton />
      ) : contextError ? (
        <ErrorState
          message={contextError}
          onRetry={() => {
            void loadProjectContext(currentProject);
          }}
        />
      ) : (
        <>
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

      <div className="grid grid-cols-2 gap-4">
        <Section title="Active Campaign" count={activeCampaign ? 1 : 0} color="#eab308">
          {activeCampaign ? (
            <CampaignCard campaign={activeCampaign} />
          ) : (
            <EmptyState text="No active campaign" />
          )}
        </Section>

        <Section title="Last Execution" count={lastExecution ? 1 : 0} color="#22C55E">
          {lastExecution ? (
            <ExecutionCard execution={lastExecution} />
          ) : (
            <EmptyState text="No execution history" />
          )}
        </Section>
      </div>

      <Section title="Active Tasks" count={activeTasks.length} color="#6b95f0">
        {activeTasks.length === 0 ? (
          <EmptyState text="No active tasks" />
        ) : (
          activeTasks.map((task, index) => (
            <TaskRow key={task.id ?? `${task.title}-${index}`} task={task} />
          ))
        )}
      </Section>

      <Section title="Recent Proposals" count={recentProposals.length} color="#ef4444">
        {recentProposals.length === 0 ? (
          <EmptyState text="No recent proposals" />
        ) : (
          recentProposals.map((proposal, index) => (
            <ProposalRow key={proposal.id ?? `${proposal.title}-${index}`} proposal={proposal} />
          ))
        )}
      </Section>
        </>
      )}
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
  readonly children: ReactNode;
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

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg p-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="h-5 rounded mb-2" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-3 rounded w-2/3" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="h-4 rounded w-1/3 mb-3" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-3 rounded mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="h-3 rounded w-5/6" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
      <span className="text-[0.7rem]" style={{ color: "#fca5a5" }}>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="px-2.5 py-1 rounded text-[0.6rem] font-mono shrink-0"
        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        Retry
      </button>
    </div>
  );
}

function StatusBadge({
  value,
  colors,
}: {
  readonly value: string | null | undefined;
  readonly colors: Record<string, string>;
}) {
  const label = value ? value.replaceAll("_", " ") : "unknown";
  const color = value ? colors[value] ?? "#94a3b8" : "#94a3b8";
  return (
    <span className="text-[0.5rem] font-mono uppercase px-1.5 py-0.5 rounded shrink-0" style={{ background: `${color}15`, color }}>
      {label}
    </span>
  );
}

function CampaignCard({
  campaign,
}: {
  readonly campaign: Record<string, unknown>;
}) {
  const title = firstString(campaign.title, campaign.name, campaign.channel) ?? "Campaign";
  const summary = firstString(campaign.summary, campaign.objective);
  const status = firstString(campaign.status);

  return (
    <div className="px-3 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.75rem] font-medium truncate" style={{ color: "var(--pn-text-primary)" }}>
          {title}
        </span>
        <StatusBadge value={status} colors={PROPOSAL_STATUS_COLORS} />
      </div>
      {summary && (
        <div className="text-[0.65rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
          {summary}
        </div>
      )}
    </div>
  );
}

function ExecutionCard({
  execution,
}: {
  readonly execution: Record<string, unknown>;
}) {
  const title = firstString(execution.title) ?? "Execution";
  const status = firstString(execution.status);
  const mode = firstString(execution.mode);
  const at = firstString(execution.completed_at, execution.updated_at, execution.inserted_at);
  const result = firstString(execution.result_path);

  return (
    <div className="px-3 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <StatusBadge value={status} colors={{ completed: "#22C55E", failed: "#ef4444", running: "#6b95f0" }} />
        {mode && <span className="text-[0.55rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>{mode}</span>}
      </div>
      <div className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>{title}</div>
      {at && <div className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>{relativeTime(at)}</div>}
      {result && (
        <div className="text-[0.6rem] font-mono truncate" style={{ color: "#5eead4" }}>
          {result}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
}: {
  readonly task: Record<string, unknown>;
}) {
  const title = firstString(task.title) ?? "Untitled task";
  const status = firstString(task.status);
  const agent = firstString(task.agent);
  const dueDate = firstString(task.due_date);
  const priority = task.priority;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <StatusBadge value={status} colors={TASK_STATUS_COLORS} />
      <span className="text-[0.7rem] flex-1 truncate" style={{ color: "var(--pn-text-secondary)" }}>
        {title}
      </span>
      {typeof priority === "number" && (
        <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
          P{priority}
        </span>
      )}
      {agent && (
        <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "#5eead4" }}>
          {agent}
        </span>
      )}
      {dueDate && (
        <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
          {relativeTime(dueDate)}
        </span>
      )}
    </div>
  );
}

function ProposalRow({
  proposal,
}: {
  readonly proposal: Record<string, unknown>;
}) {
  const title = firstString(proposal.title) ?? "Untitled proposal";
  const status = firstString(proposal.status);
  const summary = firstString(proposal.summary);
  const confidence = typeof proposal.confidence === "number" ? proposal.confidence : null;
  const at = firstString(proposal.updated_at, proposal.created_at);

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <StatusBadge value={status} colors={PROPOSAL_STATUS_COLORS} />
      <div className="min-w-0 flex-1">
        <div className="text-[0.7rem] truncate" style={{ color: "var(--pn-text-secondary)" }}>
          {title}
        </div>
        {summary && (
          <div className="text-[0.6rem] truncate" style={{ color: "var(--pn-text-muted)" }}>
            {summary}
          </div>
        )}
      </div>
      {confidence !== null && (
        <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "#eab308" }}>
          {(confidence * 100).toFixed(0)}%
        </span>
      )}
      {at && (
        <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
          {relativeTime(at)}
        </span>
      )}
    </div>
  );
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function getCount(source: unknown, key: string): number {
  if (!source || typeof source !== "object") {
    return 0;
  }

  const value = (source as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

function getAggregateByStatus(context: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> {
  if (!context) {
    return {};
  }

  const aggregate = context[key];
  if (!aggregate || typeof aggregate !== "object") {
    return {};
  }

  const byStatus = (aggregate as Record<string, unknown>).by_status;
  return byStatus && typeof byStatus === "object" ? (byStatus as Record<string, unknown>) : {};
}

function getAggregateTotal(context: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!context) {
    return null;
  }

  const aggregate = context[key];
  if (!aggregate || typeof aggregate !== "object") {
    return null;
  }

  const total = (aggregate as Record<string, unknown>).total;
  return typeof total === "number" ? total : null;
}
