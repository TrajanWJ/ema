import { useState } from "react";
import { useProposalsStore } from "@/stores/proposals-store";
import { useProjectsStore } from "@/stores/projects-store";

interface SeedFormProps {
  readonly onClose: () => void;
}

const SEED_TYPES = [
  "cron",
  "git",
  "session",
  "vault",
  "usage",
  "brain_dump",
  "cross",
  "dependency",
] as const;

const SCHEDULE_OPTIONS = [
  { value: "", label: "Manual only" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
] as const;

export function SeedForm({ onClose }: SeedFormProps) {
  const [name, setName] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [seedType, setSeedType] = useState<(typeof SEED_TYPES)[number]>("cron");
  const [schedule, setSchedule] = useState("");
  const [projectId, setProjectId] = useState("");
  const createSeed = useProposalsStore((s) => s.createSeed);
  const projects = useProjectsStore((s) => s.projects);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !promptTemplate.trim()) return;

    await createSeed({
      name: name.trim(),
      prompt_template: promptTemplate.trim(),
      seed_type: seedType,
      schedule: schedule || null,
      project_id: projectId || null,
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
          placeholder="Seed name..."
          autoFocus
        />
      </div>

      <div>
        <label
          className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Prompt Template
        </label>
        <textarea
          value={promptTemplate}
          onChange={(e) => setPromptTemplate(e.target.value)}
          rows={4}
          className="w-full rounded px-2 py-1.5 text-[0.7rem] resize-none"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            outline: "none",
          }}
          placeholder="What should this seed explore?"
        />
      </div>

      <div>
        <label
          className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Seed Type
        </label>
        <select
          value={seedType}
          onChange={(e) => setSeedType(e.target.value as (typeof SEED_TYPES)[number])}
          className="w-full rounded px-2 py-1.5 text-[0.7rem]"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            outline: "none",
          }}
        >
          {SEED_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label
            className="text-[0.6rem] font-medium uppercase tracking-wider block mb-1"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Schedule
          </label>
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-[0.7rem]"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
          >
            {SCHEDULE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

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
            background: "rgba(167, 139, 250, 0.15)",
            color: "#a78bfa",
            border: "1px solid rgba(167, 139, 250, 0.2)",
          }}
        >
          Create Seed
        </button>
      </div>
    </form>
  );
}
