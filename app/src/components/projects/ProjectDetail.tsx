import { useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProjectForm } from "./ProjectForm";
import { useTasksStore } from "@/stores/tasks-store";
import { useProposalsStore } from "@/stores/proposals-store";
import type { Project } from "@/types/projects";

type Tab = "overview" | "tasks" | "proposals" | "seeds" | "settings";

const TAB_OPTIONS = [
  { value: "overview" as const, label: "Overview" },
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

  const projectTasks = tasks.filter((t) => t.project_id === project.id);
  const projectProposals = proposals.filter((p) => p.project_id === project.id);
  const projectSeeds = seeds.filter((s) => s.project_id === project.id);

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
          <OverviewTab project={project} taskCount={projectTasks.length} proposalCount={projectProposals.length} />
        )}
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
}: {
  project: Project;
  taskCount: number;
  proposalCount: number;
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

      <div className="grid grid-cols-3 gap-2 mt-2">
        <StatMini label="Tasks" value={taskCount} />
        <StatMini label="Proposals" value={proposalCount} />
        <StatMini label="Status" value={project.status} />
      </div>
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
