import { useState } from "react";
import { useMetaMindStore } from "@/stores/metamind-store";
import type { SavedPrompt, PromptCategory } from "@/types/metamind";

const CATEGORIES: PromptCategory[] = [
  "system",
  "review",
  "metaprompt",
  "template",
  "technique",
  "research",
];

interface PromptEditorProps {
  prompt: SavedPrompt | null;
  onClose: () => void;
}

export function PromptEditor({ prompt, onClose }: PromptEditorProps) {
  const savePrompt = useMetaMindStore((s) => s.savePrompt);
  const deletePrompt = useMetaMindStore((s) => s.deletePrompt);
  const trackOutcome = useMetaMindStore((s) => s.trackOutcome);

  const [name, setName] = useState(prompt?.name ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [category, setCategory] = useState<PromptCategory>(prompt?.category ?? "template");
  const [tagsInput, setTagsInput] = useState(prompt?.tags.join(", ") ?? "");
  const [templateVarsInput, setTemplateVarsInput] = useState(
    prompt?.template_vars.join(", ") ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const isEditing = prompt !== null;
  const hasChanges = isEditing && (name !== prompt.name || body !== prompt.body);

  const templateVars = body.match(/\{\{(\w+)\}\}/g)?.map((v) => v.slice(2, -2)) ?? [];

  const previewBody = templateVars.reduce(
    (text, v) => text.replace(new RegExp(`\\{\\{${v}\\}\\}`, "g"), `[${v}]`),
    body
  );

  async function handleSave() {
    setSaving(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const vars = templateVarsInput
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    await savePrompt({
      ...(prompt ? { id: prompt.id } : {}),
      name,
      body,
      category,
      tags,
      template_vars: vars.length > 0 ? vars : templateVars,
    });
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!prompt) return;
    await deletePrompt(prompt.id);
    onClose();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="text-[0.75rem] flex items-center gap-1"
          style={{ color: "var(--pn-text-secondary)" }}
          onClick={onClose}
        >
          {"\u2190"} Back
        </button>
        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              <button
                type="button"
                className="text-[0.65rem] px-2 py-1 rounded"
                style={{
                  background: showDiff ? "rgba(107,149,240,0.15)" : "rgba(255,255,255,0.04)",
                  color: showDiff ? "#6b95f0" : "var(--pn-text-secondary)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onClick={() => setShowDiff(!showDiff)}
              >
                Diff
              </button>
              <button
                type="button"
                className="text-[0.65rem] px-2 py-1 rounded"
                style={{
                  background: "rgba(34,197,94,0.10)",
                  color: "#22c55e",
                  border: "1px solid rgba(34,197,94,0.20)",
                }}
                onClick={() => trackOutcome(prompt.id, true)}
              >
                {"\u2714"} Success
              </button>
              <button
                type="button"
                className="text-[0.65rem] px-2 py-1 rounded"
                style={{
                  background: "rgba(239,68,68,0.10)",
                  color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.20)",
                }}
                onClick={() => trackOutcome(prompt.id, false)}
              >
                {"\u2718"} Fail
              </button>
            </>
          )}
        </div>
      </div>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Prompt name..."
        className="w-full px-3 py-2 rounded-lg text-[0.85rem] font-medium mb-3 outline-none"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "var(--pn-text-primary)",
        }}
      />

      {/* Category & Tags Row */}
      <div className="flex gap-2 mb-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PromptCategory)}
          className="px-2 py-1.5 rounded-lg text-[0.75rem] outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--pn-text-primary)",
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} style={{ background: "#141620" }}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Tags (comma-separated)..."
          className="flex-1 px-3 py-1.5 rounded-lg text-[0.75rem] outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--pn-text-primary)",
          }}
        />
      </div>

      {/* Template vars */}
      <input
        type="text"
        value={templateVarsInput}
        onChange={(e) => setTemplateVarsInput(e.target.value)}
        placeholder="Template variables (comma-separated, or auto-detected from {{var}})..."
        className="w-full px-3 py-1.5 rounded-lg text-[0.7rem] mb-3 outline-none"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "var(--pn-text-secondary)",
        }}
      />

      {/* Detected vars */}
      {templateVars.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            Detected:
          </span>
          {templateVars.map((v) => (
            <span
              key={v}
              className="text-[0.6rem] px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(45,212,168,0.10)",
                color: "#2dd4a8",
                border: "1px solid rgba(45,212,168,0.20)",
              }}
            >
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      {/* Body Editor / Diff */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 mb-3">
        {showDiff && isEditing ? (
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="text-[0.6rem] mb-1" style={{ color: "var(--pn-text-tertiary)" }}>
                Original (v{prompt.version})
              </div>
              <div
                className="flex-1 p-3 rounded-lg text-[0.75rem] overflow-auto font-mono"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--pn-text-secondary)",
                }}
              >
                {prompt.body}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="text-[0.6rem] mb-1" style={{ color: "#2dd4a8" }}>
                Edited
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="flex-1 p-3 rounded-lg text-[0.75rem] outline-none resize-none font-mono"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(45,212,168,0.15)",
                  color: "var(--pn-text-primary)",
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your prompt here... Use {{variable}} for template variables."
              className="flex-1 p-3 rounded-lg text-[0.75rem] outline-none resize-none font-mono"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--pn-text-primary)",
              }}
            />
            {body.trim() && (
              <div>
                <div className="text-[0.6rem] mb-1" style={{ color: "var(--pn-text-tertiary)" }}>
                  Preview
                </div>
                <div
                  className="p-3 rounded-lg text-[0.75rem] max-h-24 overflow-auto"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "var(--pn-text-secondary)",
                  }}
                >
                  {previewBody}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {isEditing && (
          <button
            type="button"
            className="text-[0.7rem] px-3 py-1.5 rounded-lg"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.15)",
            }}
            onClick={handleDelete}
          >
            Delete
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {hasChanges && (
            <span className="text-[0.6rem]" style={{ color: "#f59e0b" }}>
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            className="text-[0.75rem] px-4 py-1.5 rounded-lg font-medium disabled:opacity-40"
            style={{
              background: "rgba(45,212,168,0.15)",
              color: "#2dd4a8",
              border: "1px solid rgba(45,212,168,0.25)",
            }}
            disabled={!name.trim() || !body.trim() || saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : isEditing ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
