import { useEffect, useMemo, type ReactNode } from "react";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { useProjectStore } from "@/stores/project-store";
import { useProjectsStore } from "@/stores/projects-store";

const STAT_COLORS = ["#6b95f0", "#22C55E", "#eab308", "#ef4444"];
const HEALTH_STATUS_COLORS: Record<string, string> = {
  active: "#22C55E",
  campaign_running: "#6b95f0",
  idle: "#eab308",
  blocked: "#ef4444",
  empty: "#94a3b8",
};
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
const EXECUTION_STATUS_COLORS: Record<string, string> = {
  completed: "#22C55E",
  failed: "#ef4444",
  running: "#6b95f0",
  approved: "#eab308",
  delegated: "#f97316",
};
const GAP_SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#94a3b8",
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
  const connected = useProjectStore((s) => s.connected);
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
        value: project.id,
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
      setCurrentProject(preferred.id);
    }
  }, [currentProject, projects, setCurrentProject]);

  useEffect(() => {
    if (!currentProject) return;
    void loadProjectContext(currentProject);
    void connectProjectChannel(currentProject);
  }, [connectProjectChannel, currentProject, loadProjectContext]);

  useEffect(() => () => {
    disconnectProjectChannel();
  }, [disconnectProjectChannel]);

  const stats = context
    ? [
        {
          label: "Active tasks",
          value: context.stats.active_tasks,
          hint: summarizeStatusBreakdown(context.tasks.by_status, ["in_progress", "todo", "blocked", "in_review"]),
        },
        {
          label: "Executions",
          value: context.stats.total_executions,
          hint: `${context.executions.running} running`,
        },
        {
          label: "Proposals",
          value: context.stats.total_proposals,
          hint: summarizeStatusBreakdown(context.proposals.by_status, ["reviewing", "queued", "approved"]),
        },
        {
          label: "Open gaps",
          value: context.gaps.total_open,
          hint: `${context.gaps.critical_count} critical`,
        },
      ]
    : [];

  const selectedProject = context?.project ?? projects.find((project) => project.id === currentProject) ?? null;
  const projectName = selectedProject?.name ?? "Project";
  const projectDescription = selectedProject?.description ?? null;
  const projectStatus = selectedProject?.status ?? null;
  const tasks = context?.tasks.recent ?? [];
  const proposals = context?.proposals.recent ?? [];
  const executions = context?.executions.recent ?? [];
  const blockers = context?.gaps.top_blockers ?? [];
  const notes = context?.vault.recent_notes ?? [];
  const lessons = context?.reflexion.recent ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl p-4" style={panelStyle}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[0.82rem] font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                Command HQ
              </div>
              <span className="text-[0.58rem] font-mono uppercase px-1.5 py-0.5 rounded-full" style={liveBadgeStyle(connected)}>
                {connected ? "live" : "rest"}
              </span>
              {projectStatus && <StatusBadge value={projectStatus} colors={HEALTH_STATUS_COLORS} />}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="text-[0.98rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                {projectName}
              </div>
              {context?.last_activity && (
                <span className="text-[0.58rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
                  activity {relativeTime(context.last_activity)}
                </span>
              )}
              {context?.generated_at && (
                <span className="text-[0.58rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
                  snapshot {relativeTime(context.generated_at)}
                </span>
              )}
            </div>
            <div className="mt-1 text-[0.68rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
              {projectDescription ?? "Live project rollup for current execution health, delivery pipeline, blockers, and learning signal."}
            </div>
          </div>

          <div className="w-full max-w-full lg:w-64">
            <GlassSelect
              value={currentProject ?? ""}
              onChange={(projectId) => {
                setCurrentProject(projectId);
              }}
              options={projectOptions}
              placeholder="Select project..."
              className="w-full"
              size="sm"
            />
          </div>
        </div>

        {context && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <SummaryStatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} color={STAT_COLORS[index]} />
            ))}
          </div>
        )}
      </div>

      {!currentProject ? (
        <EmptyState
          title="No project selected"
          detail="Create or load a project to populate HQ with live W7 context."
        />
      ) : loadingContext && !context ? (
        <LoadingSkeleton />
      ) : contextError ? (
        <ErrorState
          message={contextError}
          onRetry={() => {
            void loadProjectContext(currentProject);
          }}
        />
      ) : context ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Section
              title="Attention Now"
              count={context.health.open_gaps + context.health.running_executions}
              color="#22C55E"
              description="Current operating state, live workload, and immediate risk."
            >
              <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-3">
                <HealthCard
                  status={context.health.status}
                  activeCampaign={context.health.active_campaign}
                  runningExecutions={context.health.running_executions}
                  openGaps={context.health.open_gaps}
                  criticalGaps={context.health.critical_gaps}
                  lastActivity={context.last_activity}
                  generatedAt={context.generated_at}
                />
                <CampaignCard campaign={context.active_campaign} />
                <BlockerSummaryCard blockers={blockers} totalOpen={context.gaps.total_open} />
              </div>
            </Section>

            <Section
              title="Execution Pulse"
              count={context.executions.running}
              color="#6b95f0"
              description="How much is moving right now, and what is stuck waiting."
            >
              <div className="grid grid-cols-2 gap-3 p-3">
                <MiniMetric label="Running" value={context.executions.running} color="#6b95f0" />
                <MiniMetric label="Success rate" value={`${Math.round(context.executions.success_rate)}%`} color="#22C55E" />
                <MiniMetric label="Needs review" value={context.proposals.by_status.reviewing ?? 0} color="#eab308" />
                <MiniMetric label="Critical gaps" value={context.gaps.critical_count} color="#ef4444" />
              </div>
            </Section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Section
              title="Tasks"
              count={context.tasks.total}
              color="#6b95f0"
              description="The most recent project tasks with priority and state."
            >
              {tasks.length === 0 ? (
                <EmptyState
                  title="No tasks yet"
                  detail="This project has no linked tasks in the current context snapshot."
                />
              ) : (
                tasks.map((task, index) => (
                  <TaskRow key={task.id ?? `${task.title}-${index}`} task={task} />
                ))
              )}
            </Section>

            <Section
              title="Proposals"
              count={context.proposals.total}
              color="#ef4444"
              description="Recent proposals and the best quick read on their quality."
            >
              {proposals.length === 0 ? (
                <EmptyState
                  title="No proposals linked"
                  detail="Proposal activity for this project will appear here once generated."
                />
              ) : (
                proposals.map((proposal, index) => (
                  <ProposalRow key={proposal.id ?? `${proposal.title}-${index}`} proposal={proposal} />
                ))
              )}
            </Section>

            <Section
              title="Executions"
              count={context.executions.total}
              color="#22C55E"
              description="Latest execution outcomes, with mode and result summary."
            >
              {executions.length === 0 ? (
                <EmptyState
                  title="No executions yet"
                  detail="Run history will populate after the project dispatches work."
                />
              ) : (
                executions.map((execution, index) => (
                  <ExecutionRow key={execution.id ?? `${execution.title}-${index}`} execution={execution} />
                ))
              )}
            </Section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Section
              title="Blockers"
              count={context.gaps.total_open}
              color="#f97316"
              description="Top open gaps ordered for fast triage."
            >
              {blockers.length === 0 ? (
                <EmptyState
                  title="No blockers on record"
                  detail="Critical and high-severity gaps will surface here automatically."
                />
              ) : (
                blockers.map((gap, index) => (
                  <GapRow key={gap.id ?? `${gap.title}-${index}`} gap={gap} />
                ))
              )}
            </Section>

            <Section
              title="Knowledge Loop"
              count={context.vault.note_count + context.reflexion.total_lessons}
              color="#5eead4"
              description="Recent vault notes and reflexion signals from project work."
            >
              <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
                <Subsection title="Vault Notes" count={context.vault.note_count}>
                  {notes.length === 0 ? (
                    <EmptyState
                      title="No recent notes"
                      detail="Project-linked vault notes will show up here when written."
                    />
                  ) : (
                    notes.map((note, index) => (
                      <NoteRow key={note.id ?? `${note.title}-${index}`} note={note} />
                    ))
                  )}
                </Subsection>
                <Subsection title="Reflexion" count={context.reflexion.total_lessons}>
                  {lessons.length === 0 ? (
                    <EmptyState
                      title="No lessons recorded"
                      detail="Reflexion entries will appear after project work is reviewed."
                    />
                  ) : (
                    lessons.map((lesson, index) => (
                      <ReflexionRow key={`${lesson.agent ?? "lesson"}-${index}`} lesson={lesson} />
                    ))
                  )}
                </Subsection>
              </div>
            </Section>
          </div>
        </>
      ) : (
        <EmptyState
          title="No project context available"
          detail="The selected project returned an empty context payload."
        />
      )}
    </div>
  );
}

function Section({
  title,
  count,
  color,
  description,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly color: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl" style={panelStyle}>
      <div className="flex items-start justify-between gap-3 px-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="min-w-0">
          <div className="text-[0.76rem] font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
            {title}
          </div>
          {description && (
            <div className="mt-0.5 text-[0.62rem] leading-relaxed" style={{ color: "var(--pn-text-muted)" }}>
              {description}
            </div>
          )}
        </div>
        <span className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${color}15`, color }}>
          {count}
        </span>
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.04)]">{children}</div>
    </div>
  );
}

function Subsection({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <span className="text-[0.66rem] font-medium uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.72)" }}>
          {title}
        </span>
        <span className="text-[0.52rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
          {count}
        </span>
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.04)]">{children}</div>
    </div>
  );
}

function SummaryStatCard({
  label,
  value,
  hint,
  color,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly hint: string;
  readonly color: string;
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
      <div className="text-[0.6rem] font-mono uppercase tracking-[0.08em]" style={{ color: `${color}cc` }}>
        {label}
      </div>
      <div className="mt-1 text-[1.2rem] font-semibold font-mono" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[0.58rem] leading-relaxed" style={{ color: "var(--pn-text-muted)" }}>
        {hint}
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  color,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly color: string;
}) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: `${color}0d`, border: `1px solid ${color}16` }}>
      <div className="text-[0.55rem] font-mono uppercase" style={{ color: `${color}d0` }}>
        {label}
      </div>
      <div className="mt-1 text-[0.86rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  detail,
}: {
  readonly title: string;
  readonly detail?: string;
}) {
  return (
    <div className="px-3 py-4">
      <div className="text-[0.67rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
        {title}
      </div>
      {detail && (
        <div className="mt-1 text-[0.6rem] leading-relaxed" style={{ color: "var(--pn-text-muted)" }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="rounded-xl p-4" style={panelStyle}>
        <div className="h-4 w-40 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg p-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="h-3 rounded w-1/2" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="mt-2 h-6 rounded w-1/3" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div className="mt-2 h-3 rounded w-2/3" style={{ background: "rgba(255,255,255,0.05)" }} />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="h-4 rounded w-1/3" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="mt-3 h-3 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="mt-2 h-3 rounded w-5/6" style={{ background: "rgba(255,255,255,0.05)" }} />
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

function HealthCard({
  status,
  activeCampaign,
  runningExecutions,
  openGaps,
  criticalGaps,
  lastActivity,
  generatedAt,
}: {
  readonly status: string | null;
  readonly activeCampaign: boolean;
  readonly runningExecutions: number;
  readonly openGaps: number;
  readonly criticalGaps: number;
  readonly lastActivity: string | null;
  readonly generatedAt: string | null;
}) {
  return (
    <div className="rounded-lg p-3" style={innerCardStyle}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
          Health
        </span>
        <StatusBadge value={status} colors={HEALTH_STATUS_COLORS} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric label="Running" value={runningExecutions} color="#6b95f0" />
        <MiniMetric label="Open gaps" value={openGaps} color={openGaps > 0 ? "#f97316" : "#22C55E"} />
        <MiniMetric label="Critical" value={criticalGaps} color={criticalGaps > 0 ? "#ef4444" : "#22C55E"} />
        <MiniMetric label="Campaign" value={activeCampaign ? "active" : "idle"} color={activeCampaign ? "#22C55E" : "#94a3b8"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.55rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
        {lastActivity && <span>activity {relativeTime(lastActivity)}</span>}
        {generatedAt && <span>snapshot {relativeTime(generatedAt)}</span>}
      </div>
    </div>
  );
}

function CampaignCard({
  campaign,
}: {
  readonly campaign: Record<string, unknown> | null;
}) {
  if (!campaign) {
    return (
      <div className="rounded-lg p-3" style={innerCardStyle}>
        <div className="text-[0.6rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
          Campaign
        </div>
        <div className="mt-2 text-[0.72rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
          No active campaign
        </div>
        <div className="mt-1 text-[0.6rem] leading-relaxed" style={{ color: "var(--pn-text-muted)" }}>
          The project is not currently running a campaign. When one starts, its state and run progress appear here.
        </div>
      </div>
    );
  }

  const title = firstString(campaign.name) ?? "Campaign";
  const status = firstString(campaign.status);
  const flowState = firstString(campaign.flow_state);
  const runCount = typeof campaign.run_count === "number" ? campaign.run_count : 0;
  const stepCount = typeof campaign.step_count === "number" ? campaign.step_count : 0;

  return (
    <div className="rounded-lg p-3" style={innerCardStyle}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
          Campaign
        </span>
        <StatusBadge value={status} colors={PROPOSAL_STATUS_COLORS} />
      </div>
      <div className="mt-2 text-[0.76rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
        {title}
      </div>
      {flowState && (
        <div className="mt-1 text-[0.6rem] font-mono uppercase" style={{ color: "#eab308" }}>
          flow {flowState}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric label="Runs" value={runCount} color="#6b95f0" />
        <MiniMetric label="Steps" value={stepCount} color="#eab308" />
      </div>
    </div>
  );
}

function BlockerSummaryCard({
  blockers,
  totalOpen,
}: {
  readonly blockers: readonly Record<string, unknown>[];
  readonly totalOpen: number;
}) {
  const topBlocker = blockers[0];
  const title = topBlocker ? firstString(topBlocker.title) : null;
  const severity = topBlocker ? firstString(topBlocker.severity) : null;
  const source = topBlocker ? firstString(topBlocker.source) : null;

  return (
    <div className="rounded-lg p-3" style={innerCardStyle}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
          Blockers
        </span>
        <span className="text-[0.55rem] font-mono" style={{ color: totalOpen > 0 ? "#f97316" : "#22C55E" }}>
          {totalOpen} open
        </span>
      </div>
      {title ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge value={severity} colors={GAP_SEVERITY_COLORS} />
            {source && (
              <span className="text-[0.55rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
                {source}
              </span>
            )}
          </div>
          <div className="mt-2 text-[0.72rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
            {title}
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 text-[0.72rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
            No active blockers
          </div>
          <div className="mt-1 text-[0.6rem] leading-relaxed" style={{ color: "var(--pn-text-muted)" }}>
            The project has no top blockers in the latest context snapshot.
          </div>
        </>
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
  const updatedAt = firstString(task.updated_at);
  const priority = task.priority;

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <StatusBadge value={status} colors={TASK_STATUS_COLORS} />
      <div className="min-w-0 flex-1">
        <div className="text-[0.7rem] truncate" style={{ color: "var(--pn-text-secondary)" }}>
          {title}
        </div>
      </div>
      {typeof priority === "number" && (
        <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
          P{priority}
        </span>
      )}
      {updatedAt && (
        <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
          {relativeTime(updatedAt)}
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
  const summary = firstString(proposal.summary, proposal.body_preview);
  const confidence = typeof proposal.confidence === "number" ? proposal.confidence : null;
  const at = firstString(proposal.updated_at);

  return (
    <div className="px-3 py-2.5 flex items-start gap-2">
      <StatusBadge value={status} colors={PROPOSAL_STATUS_COLORS} />
      <div className="min-w-0 flex-1">
        <div className="text-[0.7rem] truncate" style={{ color: "var(--pn-text-secondary)" }}>
          {title}
        </div>
        {summary && (
          <div className="mt-0.5 text-[0.6rem] leading-relaxed" style={{ color: "var(--pn-text-muted)" }}>
            {summary}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        {confidence !== null && (
          <div className="text-[0.55rem] font-mono" style={{ color: "#eab308" }}>
            {(confidence * 100).toFixed(0)}%
          </div>
        )}
        {at && (
          <div className="text-[0.55rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
            {relativeTime(at)}
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionRow({
  execution,
}: {
  readonly execution: Record<string, unknown>;
}) {
  const title = firstString(execution.title) ?? "Execution";
  const status = firstString(execution.status);
  const mode = firstString(execution.mode);
  const summary = firstString(execution.result_summary);
  const at = firstString(execution.completed_at, execution.started_at);

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <StatusBadge value={status} colors={EXECUTION_STATUS_COLORS} />
        {mode && <span className="text-[0.55rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>{mode}</span>}
        {at && <span className="text-[0.55rem] font-mono ml-auto" style={{ color: "var(--pn-text-muted)" }}>{relativeTime(at)}</span>}
      </div>
      <div className="mt-1 text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
        {title}
      </div>
      {summary && (
        <div className="mt-1 text-[0.6rem] leading-relaxed" style={{ color: "var(--pn-text-muted)" }}>
          {summary}
        </div>
      )}
    </div>
  );
}

function GapRow({
  gap,
}: {
  readonly gap: Record<string, unknown>;
}) {
  const title = firstString(gap.title) ?? "Untitled blocker";
  const severity = firstString(gap.severity);
  const source = firstString(gap.source);
  const gapType = firstString(gap.gap_type);

  return (
    <div className="px-3 py-2.5 flex items-start gap-2">
      <StatusBadge value={severity} colors={GAP_SEVERITY_COLORS} />
      <div className="min-w-0 flex-1">
        <div className="text-[0.7rem] truncate" style={{ color: "var(--pn-text-secondary)" }}>
          {title}
        </div>
        {(gapType || source) && (
          <div className="mt-0.5 text-[0.55rem] font-mono truncate uppercase" style={{ color: "var(--pn-text-muted)" }}>
            {[gapType, source].filter(Boolean).join(" / ")}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteRow({
  note,
}: {
  readonly note: Record<string, unknown>;
}) {
  const title = firstString(note.title) ?? "Untitled note";
  const path = firstString(note.file_path);

  return (
    <div className="px-3 py-2.5">
      <div className="text-[0.68rem] truncate" style={{ color: "var(--pn-text-secondary)" }}>
        {title}
      </div>
      {path && (
        <div className="mt-0.5 text-[0.55rem] font-mono truncate" style={{ color: "#5eead4" }}>
          {path}
        </div>
      )}
    </div>
  );
}

function ReflexionRow({
  lesson,
}: {
  readonly lesson: Record<string, unknown>;
}) {
  const agent = firstString(lesson.agent) ?? "agent";
  const domain = firstString(lesson.domain);
  const text = firstString(lesson.lesson);
  const outcome = firstString(lesson.outcome_status);
  const recordedAt = firstString(lesson.recorded_at);

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[0.55rem] font-mono uppercase" style={{ color: "#a78bfa" }}>
          {agent}
        </span>
        {domain && (
          <span className="text-[0.55rem] font-mono uppercase truncate" style={{ color: "var(--pn-text-muted)" }}>
            {domain}
          </span>
        )}
        {recordedAt && (
          <span className="text-[0.55rem] font-mono ml-auto shrink-0" style={{ color: "var(--pn-text-muted)" }}>
            {relativeTime(recordedAt)}
          </span>
        )}
      </div>
      {text && (
        <div className="mt-1 text-[0.6rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
          {text}
        </div>
      )}
      {outcome && (
        <div className="mt-1 text-[0.55rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
          outcome {outcome}
        </div>
      )}
    </div>
  );
}

function summarizeStatusBreakdown(
  counts: Record<string, number>,
  preferredOrder: readonly string[],
): string {
  const parts = preferredOrder
    .map((key) => ({ key, value: counts[key] ?? 0 }))
    .filter((item) => item.value > 0)
    .slice(0, 2)
    .map((item) => `${item.value} ${item.key.replaceAll("_", " ")}`);

  if (parts.length > 0) {
    return parts.join(" • ");
  }

  return "No active items";
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function liveBadgeStyle(connected: boolean) {
  return {
    background: connected ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.12)",
    color: connected ? "#22C55E" : "#94a3b8",
  };
}

const panelStyle = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.05)",
};

const innerCardStyle = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.05)",
};
