import { useState } from "react";
import { GlassInput } from "@/components/ui/GlassInput";
import { NativeSelect } from "@/components/ui/NativeSelect";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_OPTIONS = [
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
  { value: "haiku", label: "Haiku" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionFormProps {
  readonly onClose: () => void;
  readonly onCreate: (projectPath: string, model: string) => void;
}

export function SessionForm({ onClose, onCreate }: SessionFormProps) {
  const [projectPath, setProjectPath] = useState("");
  const [model, setModel] = useState("sonnet");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = projectPath.trim();
    if (!trimmed) return;
    onCreate(trimmed, model);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="glass-elevated rounded-xl p-5 w-full max-w-md flex flex-col gap-4"
        style={{ border: "1px solid var(--pn-border-subtle)" }}
      >
        <h3
          className="text-[0.875rem] font-medium"
          style={{ color: "var(--pn-text-primary)" }}
        >
          New Session
        </h3>

        {/* Project path */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[0.7rem]"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Project Path
          </label>
          <GlassInput
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="~/Projects/..."
            className="w-full"
            uiSize="md"
          />
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[0.7rem]"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Model
          </label>
          <NativeSelect
            value={model}
            onChange={(e) => setModel(e.target.value)}
            uiSize="md"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-[0.7rem] px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--pn-text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!projectPath.trim()}
            className="text-[0.7rem] px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{ background: "#6b95f0", color: "#fff" }}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
