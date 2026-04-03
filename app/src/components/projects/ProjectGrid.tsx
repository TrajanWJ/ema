import { useMemo } from "react";
import { useProjectsStore } from "@/stores/projects-store";
import { useExecutionStore } from "@/stores/execution-store";
import type { Project } from "@/types/projects";
import type { Execution } from "@/types/executions";

const STATUS_COLORS: Record<Project["status"], string> = {
  incubating: "#a78bfa",
  active: "#22c55e",
  paused: "#f59e0b",
  completed: "#6b95f0",
  archived: "var(--pn-text-muted)",
};

interface ProjectGridProps {
  readonly onSelectProject: (project: Project) => void;
}

function getProjectStats(executions: readonly Execution[], slug: string) {
  const projectExecs = executions.filter((e) => e.project_slug === slug);
  const intentSlugs = new Set(projectExecs.map((e) => e.intent_slug).filter(Boolean));
  const completed = projectExecs.filter((e) => e.status === "completed").length;
  const inProgress = projectExecs.filter((e) => e.status === "running" || e.status === "delegated").length;
  const blocked = projectExecs.filter((e) => e.status === "failed" || e.status === "cancelled").length;
  const latest = projectExecs.length > 0
    ? projectExecs.reduce((a, b) => (a.updated_at > b.updated_at ? a : b)).updated_at
    : null;
  return { intentCount: intentSlugs.size, completed, inProgress, blocked, latest };
}

export function ProjectGrid({ onSelectProject }: ProjectGridProps) {
  const projects = useProjectsStore((s) => s.projects);
  const executions = useExecutionStore((s) => s.executions);

  const statsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getProjectStats>>();
    for (const p of projects) {
      map.set(p.slug, getProjectStats(executions, p.slug));
    }
    return map;
  }, [projects, executions]);

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-muted)" }}
        >
          No projects yet
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {projects.map((project) => {
        const stats = statsMap.get(project.slug);
        return (
          <button
            key={project.id}
            onClick={() => onSelectProject(project)}
            className="glass-surface rounded-lg p-3 text-left transition-colors hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: "1rem", color: project.color ?? "#2dd4a8" }}>
                {project.icon ?? "\u25A3"}
              </span>
              <span
                className="text-[0.75rem] font-medium truncate"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {project.name}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[0.55rem] px-1.5 py-0.5 rounded"
                style={{
                  background: `${STATUS_COLORS[project.status]}15`,
                  color: STATUS_COLORS[project.status],
                }}
              >
                {project.status}
              </span>
              {stats && stats.intentCount > 0 && (
                <span
                  className="text-[0.55rem] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(107, 149, 240, 0.1)", color: "#6b95f0" }}
                >
                  {stats.intentCount} intent{stats.intentCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Progress summary */}
            {stats && (stats.completed > 0 || stats.inProgress > 0 || stats.blocked > 0) && (
              <div className="flex items-center gap-2 mb-2 text-[0.55rem]">
                {stats.completed > 0 && (
                  <span style={{ color: "#22c55e" }}>{stats.completed} done</span>
                )}
                {stats.inProgress > 0 && (
                  <span style={{ color: "#6b95f0" }}>{stats.inProgress} running</span>
                )}
                {stats.blocked > 0 && (
                  <span style={{ color: "#ef4444" }}>{stats.blocked} failed</span>
                )}
              </div>
            )}

            <div
              className="flex items-center gap-3 text-[0.6rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {project.task_count != null && (
                <span>{project.task_count} tasks</span>
              )}
              {project.proposal_count != null && (
                <span>{project.proposal_count} proposals</span>
              )}
              {stats?.latest && (
                <span className="ml-auto">{new Date(stats.latest).toLocaleDateString()}</span>
              )}
            </div>

            {project.description && (
              <p
                className="text-[0.6rem] mt-2 leading-relaxed"
                style={{
                  color: "var(--pn-text-secondary)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {project.description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
