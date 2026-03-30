import { useState } from "react";
import { useTasksStore } from "@/stores/tasks-store";
import { useProjectsStore } from "@/stores/projects-store";

interface TaskFormProps {
  readonly onClose: () => void;
}

const EFFORT_OPTIONS = [
  { value: "", label: "None" },
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
] as const;

export function TaskForm({ onClose }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(3);
  const [projectId, setProjectId] = useState("");
  const [effort, setEffort] = useState("");
  const createTask = useTasksStore((s) => s.createTask);
  const projects = useProjectsStore((s) => s.projects);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    await createTask({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      project_id: projectId || null,
      effort: effort || null,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label
          className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded px-2 py-1.5 text-[0.7rem]"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            outline: "none",
          }}
          placeholder="Task title..."
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
          placeholder="What needs to be done?"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label
            className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Project
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-[0.7rem]"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: "80px" }}>
          <label
            className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full rounded px-2 py-1.5 text-[0.7rem]"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>P{p}</option>
            ))}
          </select>
        </div>

        <div style={{ width: "80px" }}>
          <label
            className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Effort
          </label>
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-[0.7rem]"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
          >
            {EFFORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
            background: "rgba(107, 149, 240, 0.15)",
            color: "#6b95f0",
            border: "1px solid rgba(107, 149, 240, 0.2)",
          }}
        >
          Create Task
        </button>
      </div>
    </form>
  );
}
