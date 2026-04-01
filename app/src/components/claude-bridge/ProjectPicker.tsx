import { useProjectsStore } from "@/stores/projects-store";
import type { Project } from "@/types/projects";

interface ProjectPickerProps {
  readonly selectedId: string | null;
  readonly onSelect: (project: Project | null) => void;
}

export function ProjectPicker({ selectedId, onSelect }: ProjectPickerProps) {
  const projects = useProjectsStore((s) => s.projects);
  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "incubating");

  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        const project = activeProjects.find((p) => p.id === id) ?? null;
        onSelect(project);
      }}
      className="w-full rounded-md px-2 py-1.5 text-[0.75rem] font-mono outline-none"
      style={{
        background: "var(--color-pn-surface-2)",
        color: "var(--pn-text-primary)",
        border: "1px solid var(--pn-border-default)",
      }}
    >
      <option value="">Select project...</option>
      {activeProjects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.icon ?? "▪"} {p.name} — {p.linked_path ?? "no path"}
        </option>
      ))}
    </select>
  );
}
