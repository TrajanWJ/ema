import { useState } from "react";
import { useProjectsStore } from "@/stores/projects-store";
import { GlassSelect } from "@/components/ui/GlassSelect";
import type { Project } from "@/types/projects";

interface ProjectFormProps {
  readonly project?: Project;
  readonly onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: "incubating", label: "Incubating" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
] as const;

export function ProjectForm({ project, onClose }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [linkedPath, setLinkedPath] = useState(project?.linked_path ?? "");
  const [status, setStatus] = useState(project?.status ?? "incubating");
  const [icon, setIcon] = useState(project?.icon ?? "");
  const [color, setColor] = useState(project?.color ?? "");
  const { createProject, updateProject } = useProjectsStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      linked_path: linkedPath.trim() || null,
      status,
      icon: icon.trim() || null,
      color: color.trim() || null,
    };

    if (project) {
      await updateProject(project.id, data);
    } else {
      await createProject(data);
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label
          className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded px-2 py-1.5 text-[0.7rem]"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            outline: "none",
          }}
          placeholder="Project name..."
          autoFocus
        />
      </div>

      <div>
        <label
          className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded px-2 py-1.5 text-[0.7rem] resize-none"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            outline: "none",
          }}
          placeholder="What is this project about?"
        />
      </div>

      <div>
        <label
          className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Linked Path
        </label>
        <input
          type="text"
          value={linkedPath}
          onChange={(e) => setLinkedPath(e.target.value)}
          className="w-full rounded px-2 py-1.5 text-[0.7rem] font-mono"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            outline: "none",
          }}
          placeholder="/path/to/repo"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label
            className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Status
          </label>
          <GlassSelect
            value={status}
            onChange={(val) => setStatus(val as Project["status"])}
            options={STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            className="w-full"
            size="sm"
          />
        </div>

        <div style={{ width: "80px" }}>
          <label
            className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Icon
          </label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-[0.7rem] text-center"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
            placeholder="&#9673;"
            maxLength={2}
          />
        </div>

        <div style={{ width: "80px" }}>
          <label
            className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Color
          </label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-[0.7rem] font-mono"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
            placeholder="#2dd4a8"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end mt-1">
        <button
          type="button"
          onClick={onClose}
          className="text-[0.65rem] px-3 py-1 rounded"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="text-[0.65rem] font-medium px-3 py-1 rounded"
          style={{
            background: "rgba(45, 212, 168, 0.15)",
            color: "#2dd4a8",
            border: "1px solid rgba(45, 212, 168, 0.2)",
          }}
        >
          {project ? "Update" : "Create"} Project
        </button>
      </div>
    </form>
  );
}
