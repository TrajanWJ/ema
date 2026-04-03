import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProjectForm } from "./ProjectForm";
import { useTasksStore } from "@/stores/tasks-store";
import { useProposalsStore } from "@/stores/proposals-store";
import { useExecutionStore } from "@/stores/execution-store";
import type { Project } from "@/types/projects";
import type { Execution } from "@/types/executions";

type Tab = "overview" | "intents" | "tasks" | "proposals" | "seeds" | "settings";

const TAB_OPTIONS = [
  { value: "overview" as const, label: "Overview" },
  { value: "intents" as const, label: "Intents" },
  { value: "tasks" as const, label: "Tasks" },
  { value: "proposals" as const, label: "Proposals" },
  { value: "seeds" as const, label: "Seeds" },
  { value: "settings" as const, label: "Settings" },
] as const;

interface ProjectDetailProps {
  readonly project: Project;
  readonly onBack: () => void;
}

export function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const tasks = useTasksStore((s) => s.tasks);
  const proposals = useProposalsStore((s) => s.proposals);
  const seeds = useProposalsStore((s) => s.seeds);
  const executions = useExecutionStore((s) => s.executions);

  const projectTasks = tasks.filter((t) => t.project_id === project.id);
  const projectProposals = proposals.filter((p) => p.project_id === project.id);
  const projectSeeds = seeds.filter((s) => s.project_id === project.id);
  const projectExecs = useMemo(
    () => executions.filter((e) => e.project_slug === project.slug),
    [executions, project.slug],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="text-[0.7rem] px-2 py-1 rounded transition-opacity hover:opacity-80"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          &larr; Back
        </button>
        <span style={{ fontSize: "1.1rem", color: project.color ?? "#2dd4a8" }}>
          {project.icon ?? "\u25A3"}
        </span>
        <h2
          className="text-[0.9rem] font-semibold"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {project.name}
        </h2>
      </div>

      <div className="mb-4">
        <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "overview" && (
          <OverviewTab project={project} taskCount={projectTasks.length} proposalCount={projectProposals.length} intentCount={projectExecs.length} />
        )}
        {tab === "intents" && <IntentsTab executions={projectExecs} />}
        {tab === "tasks" && <TaskListTab tasks={projectTasks} />}
        {tab === "proposals" && <ProposalListTab proposals={projectProposals} />}
        {tab === "seeds" && <SeedListTab seeds={projectSeeds} />}
        {tab === "settings" && <ProjectForm project={project} onClose={onBack} />}
      </div>
    </div>
  );
}

function OverviewTab({
  project,
  taskCount,
  proposalCount,
  intentCount,
}: {
  project: Project;
  taskCount: number;
  proposalCount: number;
  intentCount: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      {project.description && (
        <p
          className="text-[0.7rem] leading-relaxed"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          {project.description}
        </p>
      )}

      {project.linked_path && (
        <div
          className="text-[0.65rem] font-mono px-2 py-1.5 rounded"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            color: "var(--pn-text-muted)",
          }}
        >
          {project.linked_path}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 mt-2">
        <StatMini label="Tasks" value={taskCount} />
        <StatMini label="Proposals" value={proposalCount} />
        <StatMini label="Executions" value={intentCount} />
        <StatMini label="Status" value={project.status} />
      </div>
    </div>
  );
}

const EXEC_STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  running: "#6b95f0",
  delegated: "#6b95f0",
  approved: "#2dd4a8",
  failed: "#ef4444",
  cancelled: "#ef4444",
  created: "#a78bfa",
  proposed: "#a78bfa",
  awaiting_approval: "#f59e0b",
  harvesting: "#f59e0b",
};

interface IntentGroup {
  slug: string;
  executions: readonly Execution[];
  completed: number;
  total: number;
  modesUsed: readonly string[];
  latestUpdate: string;
}

function IntentsTab({ executions }: { executions: readonly Execution[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Execution[]>();
    for (const e of executions) {
      const slug = e.intent_slug ?? "(no intent)";
      const arr = map.get(slug) ?? [];
      arr.push(e);
      map.set(slug, arr);
    }
    const result: IntentGroup[] = [];
    for (const [slug, execs] of map) {
      const completed = execs.filter((e) => e.status === "completed").length;
      const modesUsed = [...new Set(execs.map((e) => e.mode))];
      const latestUpdate = execs.reduce((a, b) => (a.updated_at > b.updated_at ? a : b)).updated_at;
      result.push({ slug, executions: execs, completed, total: execs.length, modesUsed, latestUpdate });
    }
    return result.sort((a, b) => b.latestUpdate.localeCompare(a.latestUpdate));
  }, [executions]);

  if (groups.length === 0) {
    return <EmptyState message="No intents/executions for this project" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.slug} className="glass-surface rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[0.7rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
              {group.slug}
            </span>
            <span className="text-[0.55rem] ml-auto" style={{ color: "var(--pn-text-muted)" }}>
              {Math.round((group.completed / group.total) * 100)}% complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${(group.completed / group.total) * 100}%`, background: "#22c55e" }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {group.modesUsed.map((mode) => (
              <span
                key={mode}
                className="text-[0.5rem] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(107,149,240,0.1)", color: "#6b95f0" }}
              >
                {mode}
              </span>
            ))}
            <span className="text-[0.5rem] ml-auto" style={{ color: "var(--pn-text-muted)" }}>
              {new Date(group.latestUpdate).toLocaleDateString()}
            </span>
          </div>
          {/* Individual executions */}
          <div className="flex flex-col gap-1 mt-2">
            {group.executions.map((e) => (
              <div key={e.id} className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span
                  className="shrink-0 rounded-full"
                  style={{ width: "6px", height: "6px", background: EXEC_STATUS_COLORS[e.status] ?? "#a78bfa" }}
                />
                <span className="text-[0.6rem] flex-1 truncate" style={{ color: "var(--pn-text-secondary)" }}>
                  {e.title}
                </span>
                <span
                  className="text-[0.5rem] px-1 py-0.5 rounded shrink-0"
                  style={{ background: `${EXEC_STATUS_COLORS[e.status] ?? "#a78bfa"}15`, color: EXEC_STATUS_COLORS[e.status] ?? "#a78bfa" }}
                >
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="glass-surface rounded-lg p-2.5"
    >
      <span
        className="text-[0.55rem] font-medium uppercase tracking-wider block mb-0.5"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-[0.8rem] font-semibold"
        style={{ color: "var(--pn-text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function TaskListTab({ tasks }: { tasks: readonly { id: string; title: string; status: string; priority: number }[] }) {
  if (tasks.length === 0) {
    return <EmptyState message="No tasks for this project" />;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="glass-surface rounded-md px-3 py-2 flex items-center gap-2"
        >
          <PriorityDot priority={task.priority} />
          <span className="text-[0.7rem] flex-1" style={{ color: "var(--pn-text-primary)" }}>
            {task.title}
          </span>
          <span
            className="text-[0.55rem] px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              color: "var(--pn-text-muted)",
            }}
          >
            {task.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProposalListTab({ proposals }: { proposals: readonly { id: string; title: string; status: string; confidence: number }[] }) {
  if (proposals.length === 0) {
    return <EmptyState message="No proposals for this project" />;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {proposals.map((p) => (
        <div
          key={p.id}
          className="glass-surface rounded-md px-3 py-2 flex items-center gap-2"
        >
          <span
            className="shrink-0 rounded-full"
            style={{
              width: "6px",
              height: "6px",
              background: p.confidence >= 0.7 ? "#22c55e" : p.confidence >= 0.4 ? "#f59e0b" : "#ef4444",
            }}
          />
          <span className="text-[0.7rem] flex-1" style={{ color: "var(--pn-text-primary)" }}>
            {p.title}
          </span>
          <span
            className="text-[0.55rem] px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              color: "var(--pn-text-muted)",
            }}
          >
            {p.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function SeedListTab({ seeds }: { seeds: readonly { id: string; name: string; active: boolean; run_count: number }[] }) {
  if (seeds.length === 0) {
    return <EmptyState message="No seeds for this project" />;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {seeds.map((seed) => (
        <div
          key={seed.id}
          className="glass-surface rounded-md px-3 py-2 flex items-center gap-2"
        >
          <span className="text-[0.7rem] flex-1" style={{ color: "var(--pn-text-primary)" }}>
            {seed.name}
          </span>
          <span
            className="text-[0.55rem] px-1.5 py-0.5 rounded"
            style={{
              background: seed.active ? "rgba(34, 197, 94, 0.1)" : "rgba(255, 255, 255, 0.04)",
              color: seed.active ? "#22c55e" : "var(--pn-text-muted)",
            }}
          >
            {seed.active ? "active" : "paused"}
          </span>
          <span className="text-[0.55rem]" style={{ color: "var(--pn-text-muted)" }}>
            {seed.run_count} runs
          </span>
        </div>
      ))}
    </div>
  );
}

function PriorityDot({ priority }: { priority: number }) {
  const colors: Record<number, string> = {
    1: "#ef4444",
    2: "#f59e0b",
    3: "#6b95f0",
    4: "#a78bfa",
    5: "var(--pn-text-muted)",
  };
  return (
    <span
      className="shrink-0 rounded-full"
      style={{
        width: "6px",
        height: "6px",
        background: colors[priority] ?? colors[3],
      }}
    />
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
        {message}
      </span>
    </div>
  );
}
