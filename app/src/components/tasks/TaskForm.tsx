import { useState } from "react";
import { useTasksStore } from "@/stores/tasks-store";
import { useProjectsStore } from "@/stores/projects-store";
import { GlassSelect } from "@/components/ui/GlassSelect";

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

interface DeliberationState {
  pending: boolean;
  keywords: string[];
  pendingData: Record<string, unknown>;
}

export function TaskForm({ onClose }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(3);
  const [projectId, setProjectId] = useState("");
  const [effort, setEffort] = useState("");
  const [deliberation, setDeliberation] = useState<DeliberationState | null>(null);
  const createTask = useTasksStore((s) => s.createTask);
  const projects = useProjectsStore((s) => s.projects);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      project_id: projectId || null,
      effort: effort || null,
    };

    const result = await createTask(data);

    if (result?.status === "requires_proposal") {
      setDeliberation({
        pending: true,
        keywords: result.keywords ?? [],
        pendingData: data,
      });
      return;
    }

    onClose();
  }

  async function handleGenerateProposal() {
    // Call the proposal generation endpoint — for now navigate to proposals
    // and close. The full integration would call POST /api/seeds with the task context.
    setDeliberation(null);
    onClose();
  }

  async function handleDispatchAnyway() {
    if (!deliberation) return;
    await createTask({ ...deliberation.pendingData, force_dispatch: true });
    setDeliberation(null);
    onClose();
  }

  function handleCancelDeliberation() {
    setDeliberation(null);
  }

  return (
    <>
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
            <GlassSelect
              value={projectId}
              onChange={(val) => setProjectId(val)}
              options={[
                { value: "", label: "None" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              className="w-full"
              size="sm"
            />
          </div>

          <div style={{ width: "80px" }}>
            <label
              className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Priority
            </label>
            <GlassSelect
              value={priority.toString()}
              onChange={(val) => setPriority(Number(val))}
              options={[1, 2, 3, 4, 5].map((p) => ({
                value: p.toString(),
                label: `P${p}`,
              }))}
              className="w-full"
              size="sm"
            />
          </div>

          <div style={{ width: "80px" }}>
            <label
              className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Effort
            </label>
            <GlassSelect
              value={effort}
              onChange={(val) => setEffort(val)}
              options={EFFORT_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
              className="w-full"
              size="sm"
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
              background: "rgba(107, 149, 240, 0.15)",
              color: "#6b95f0",
              border: "1px solid rgba(107, 149, 240, 0.2)",
            }}
          >
            Create Task
          </button>
        </div>
      </form>

      {/* Deliberation Gate Modal */}
      {deliberation?.pending && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(6, 6, 16, 0.75)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4"
            style={{
              background: "rgba(20, 23, 33, 0.95)",
              border: "1px solid rgba(251, 191, 36, 0.3)",
              boxShadow: "0 0 40px rgba(251, 191, 36, 0.1)",
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "1.2rem" }}>⚠️</span>
              <h3
                className="text-[0.85rem] font-semibold"
                style={{ color: "var(--pn-text-primary)" }}
              >
                Structural Task Detected
              </h3>
            </div>

            <p className="text-[0.7rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
              This task looks structural (
              <span style={{ color: "#fbbf24", fontFamily: "monospace" }}>
                {deliberation.keywords.join(", ")}
              </span>
              ). Generate a proposal first before dispatching?
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleGenerateProposal}
                className="text-[0.7rem] font-medium px-4 py-2 rounded text-center w-full"
                style={{
                  background: "rgba(107, 149, 240, 0.15)",
                  color: "#6b95f0",
                  border: "1px solid rgba(107, 149, 240, 0.25)",
                }}
              >
                Generate Proposal
              </button>

              <button
                onClick={handleDispatchAnyway}
                className="text-[0.7rem] px-4 py-2 rounded text-center w-full"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}
              >
                Dispatch Anyway (bypass)
              </button>

              <button
                onClick={handleCancelDeliberation}
                className="text-[0.7rem] px-4 py-2 rounded text-center w-full"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
