import { useState } from "react";
import { useAgentsStore } from "@/stores/agents-store";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassTextarea } from "@/components/ui/GlassTextarea";

const MODELS = ["opus", "sonnet", "haiku"] as const;

interface AgentFormProps {
  readonly onClose: () => void;
}

export function AgentForm({ onClose }: AgentFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState<string>("sonnet");
  const [temperature, setTemperature] = useState(0.7);
  const create = useAgentsStore((s) => s.create);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await create({
      name: trimmed,
      description: description.trim() || undefined,
      model,
      temperature,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="glass-surface rounded-lg p-4 mb-4">
      <h3
        className="text-[0.75rem] font-medium uppercase tracking-wider mb-3"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        New Agent
      </h3>

      <GlassInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Agent name"
        className="w-full mb-2"
        uiSize="md"
      />

      <GlassTextarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full mb-2 resize-none"
        uiSize="sm"
      />

      <div className="flex gap-2 mb-3">
        <GlassSelect
          value={model}
          onChange={(val) => setModel(val)}
          options={MODELS.map((m) => ({ value: m, label: m }))}
          className="flex-1"
          size="sm"
        />

        <div className="flex items-center gap-2 flex-1">
          <label className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            Temp
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-[0.65rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
            {temperature}
          </span>
        </div>
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
          disabled={!name.trim()}
          className="text-[0.7rem] px-4 py-1.5 rounded-md font-medium transition-opacity disabled:opacity-30"
          style={{ background: "#a78bfa", color: "#fff" }}
        >
          Create
        </button>
      </div>
    </form>
  );
}
