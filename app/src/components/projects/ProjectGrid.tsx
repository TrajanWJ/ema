import { useProjectsStore } from "@/stores/projects-store";
import type { Project } from "@/types/projects";

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

export function ProjectGrid({ onSelectProject }: ProjectGridProps) {
  const projects = useProjectsStore((s) => s.projects);

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
      {projects.map((project) => (
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
          </div>

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
      ))}
    </div>
  );
}
