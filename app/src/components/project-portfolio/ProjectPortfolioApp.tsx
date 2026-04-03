import { useEffect } from "react";
import { useProjectsStore } from "@/stores/projects-store";
import type { Project } from "@/types/projects";

const card = {
  background: "rgba(14,16,23,0.55)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
} as const;

const STATUS_STYLES: Record<
  string,
  { background: string; color: string }
> = {
  active: { background: "rgba(45,212,168,0.12)", color: "#2DD4A8" },
  incubating: { background: "rgba(45,212,168,0.08)", color: "#2DD4A8" },
  paused: { background: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  archived: { background: "rgba(255,255,255,0.06)", color: "var(--pn-text-secondary)" },
  completed: { background: "rgba(107,149,240,0.12)", color: "#6B95F0" },
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function ProjectCard({ project }: { readonly project: Project }) {
  const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.archived;
  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            color: "var(--pn-text-primary)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {project.name}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 6,
            background: statusStyle.background,
            color: statusStyle.color,
            fontWeight: 500,
          }}
        >
          {project.status}
        </span>
      </div>

      {project.description && (
        <div
          style={{
            color: "var(--pn-text-secondary)",
            fontSize: 12,
            lineHeight: 1.4,
            marginBottom: 8,
          }}
        >
          {truncate(project.description, 120)}
        </div>
      )}

      <div
        style={{
          color: "var(--pn-text-secondary)",
          fontSize: 11,
        }}
      >
        Updated {formatTime(project.updated_at)}
      </div>
    </div>
  );
}

export function ProjectPortfolioApp() {
  const { projects, loadViaRest, loaded } = useProjectsStore();

  useEffect(() => {
    if (!loaded) {
      loadViaRest();
    }
  }, [loaded, loadViaRest]);

  if (!loaded) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "var(--pn-text-secondary)", fontSize: 13 }}>
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 20,
      }}
    >
      <h2
        style={{
          color: "var(--pn-text-primary)",
          fontSize: 16,
          fontWeight: 600,
          margin: "0 0 16px",
        }}
      >
        Project Portfolio
      </h2>

      {projects.length === 0 ? (
        <div
          style={{
            color: "var(--pn-text-secondary)",
            fontSize: 13,
            textAlign: "center",
            marginTop: 32,
          }}
        >
          No projects yet
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            alignContent: "start",
          }}
        >
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
