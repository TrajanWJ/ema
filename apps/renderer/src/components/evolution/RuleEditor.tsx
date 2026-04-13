import { useState } from "react";
import { useEvolutionStore } from "@/stores/evolution-store";
import type { BehaviorRule } from "@/types/evolution";

interface RuleEditorProps {
  readonly rule: BehaviorRule;
  readonly onClose: () => void;
}

export function RuleEditor({ rule, onClose }: RuleEditorProps) {
  const [content, setContent] = useState(rule.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateRule, applyVersion } = useEvolutionStore();

  const hasChanges = content !== rule.content;

  async function handleSave() {
    if (!hasChanges) return;
    setSaving(true);
    setError(null);
    try {
      if (rule.status === "active") {
        await applyVersion(rule.id, content);
      } else {
        await updateRule(rule.id, { content });
      }
      onClose();
    } catch {
      setError("Failed to save rule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="glass-elevated rounded-xl p-4 w-full max-w-lg mx-4 flex flex-col gap-3"
        style={{ border: "1px solid var(--pn-border-default)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[0.8rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            Edit Rule
          </h3>
          <button
            onClick={onClose}
            className="text-[0.7rem] px-2 py-0.5 rounded hover:opacity-80"
            style={{ color: "var(--pn-text-muted)" }}
          >
            esc
          </button>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2">
          <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>
            {rule.source}
          </span>
          <span className="text-[0.55rem] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,149,240,0.12)", color: "#6b95f0" }}>
            v{rule.version}
          </span>
          <span className="text-[0.55rem]" style={{ color: "var(--pn-text-muted)" }}>
            {rule.status}
          </span>
        </div>

        {/* Content editor */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="w-full rounded-lg px-3 py-2 text-[0.7rem] leading-relaxed resize-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            outline: "none",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          }}
        />

        {/* Diff preview */}
        {hasChanges && (
          <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--pn-border-subtle)" }}>
            <span className="text-[0.55rem] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--pn-text-muted)" }}>
              Changes
            </span>
            <div className="text-[0.6rem] leading-relaxed" style={{ fontFamily: "var(--font-mono, monospace)" }}>
              <div style={{ color: "#ef4444" }}>- {rule.content.slice(0, 120)}{rule.content.length > 120 ? "..." : ""}</div>
              <div style={{ color: "#22c55e" }}>+ {content.slice(0, 120)}{content.length > 120 ? "..." : ""}</div>
            </div>
          </div>
        )}

        {/* Existing diff from previous version */}
        {rule.diff && (
          <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--pn-border-subtle)" }}>
            <span className="text-[0.55rem] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--pn-text-muted)" }}>
              Version Diff
            </span>
            <pre className="text-[0.6rem] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--pn-text-secondary)" }}>
              {rule.diff}
            </pre>
          </div>
        )}

        {error && (
          <div className="text-[0.65rem] px-2 py-1 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-[0.65rem] px-3 py-1.5 rounded transition-opacity hover:opacity-80"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="text-[0.65rem] font-medium px-3 py-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
          >
            {saving ? "Saving..." : rule.status === "active" ? "Save New Version" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
