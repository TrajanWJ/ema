import { useProjectsStore } from "@/stores/projects-store";
import { GlassSelect } from "@/components/ui/GlassSelect";
import type { Project } from "@/types/projects";

interface ProjectPickerProps {
  readonly selectedId: string | null;
  readonly onSelect: (project: Project | null) => void;
}

export function ProjectPicker({ selectedId, onSelect }: ProjectPickerProps) {
  const projects = useProjectsStore((s) => s.projects);
  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "incubating");

  const options = activeProjects.map((p) => ({
    value: p.id,
    label: `${p.icon ?? "▪"} ${p.name} — ${p.linked_path ?? "no path"}`,
  }));

  return (
    <GlassSelect
      value={selectedId ?? ""}
      onChange={(val) => {
        const project = activeProjects.find((p) => p.id === val) ?? null;
        onSelect(project);
      }}
      options={options}
      placeholder="Select project..."
      className="w-full"
      size="sm"
    />
  );
}
