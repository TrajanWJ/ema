import { useState } from "react";
import { useResponsibilitiesStore } from "@/stores/responsibilities-store";
import { GlassSelect } from "@/components/ui/GlassSelect";

const ROLES = ["developer", "self", "maintainer", "learner", "custom"] as const;
const CADENCES = ["daily", "weekly", "biweekly", "monthly", "quarterly", "ongoing"] as const;

interface ResponsibilityFormProps {
  readonly onClose: () => void;
}

export function ResponsibilityForm({ onClose }: ResponsibilityFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<string>("developer");
  const [cadence, setCadence] = useState<string>("weekly");
  const create = useResponsibilitiesStore((s) => s.create);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await create({
      title: trimmed,
      description: description.trim() || undefined,
      role,
      cadence,
    });
    onClose();
  }

  const selectStyle = {
    background: "var(--pn-surface-3)",
    color: "var(--pn-text-primary)",
    border: "1px solid var(--pn-border-default)",
  };

  return (
    <form onSubmit={handleSubmit} className="glass-surface rounded-lg p-4 mb-4">
      <h3
        className="text-[0.75rem] font-medium uppercase tracking-wider mb-3"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        New Responsibility
      </h3>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full text-[0.8rem] px-3 py-2 rounded-lg outline-none mb-2"
        style={selectStyle}
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full text-[0.75rem] px-3 py-2 rounded-lg outline-none resize-none mb-2"
        style={selectStyle}
      />

      <div className="flex gap-2 mb-3">
        <GlassSelect
          value={role}
          onChange={(val) => setRole(val)}
          options={ROLES.map((r) => ({ value: r, label: r }))}
          className="flex-1"
          size="sm"
        />

        <GlassSelect
          value={cadence}
          onChange={(val) => setCadence(val)}
          options={CADENCES.map((c) => ({ value: c, label: c }))}
          className="flex-1"
          size="sm"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-[0.7rem] px-3 py-1.5 rounded-md"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className="text-[0.7rem] px-4 py-1.5 rounded-md font-medium transition-opacity disabled:opacity-30"
          style={{ background: "#f59e0b", color: "#fff" }}
        >
          Create
        </button>
      </div>
    </form>
  );
}
