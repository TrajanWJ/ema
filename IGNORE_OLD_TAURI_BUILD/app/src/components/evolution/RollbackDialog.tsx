import { useEffect, useState } from "react";
import { useEvolutionStore } from "@/stores/evolution-store";
import type { BehaviorRule } from "@/types/evolution";

interface RollbackDialogProps {
  readonly rule: BehaviorRule;
  readonly onClose: () => void;
}

export function RollbackDialog({ rule, onClose }: RollbackDialogProps) {
  const [versions, setVersions] = useState<readonly BehaviorRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rollbackRule, getVersionHistory } = useEvolutionStore();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const history = await getVersionHistory(rule.id);
        if (!cancelled) setVersions(history);
      } catch {
        if (!cancelled) setError("Failed to load version history");
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [rule.id, getVersionHistory]);

  async function handleRollback() {
    setRolling(true);
    setError(null);
    try {
      await rollbackRule(rule.id);
      onClose();
    } catch {
      setError("Failed to rollback rule");
    } finally {
      setRolling(false);
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
            Rollback Rule
          </h3>
          <button
            onClick={onClose}
            className="text-[0.7rem] px-2 py-0.5 rounded hover:opacity-80"
            style={{ color: "var(--pn-text-muted)" }}
          >
            esc
          </button>
        </div>

        {/* Current rule preview */}
        <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <span className="text-[0.55rem] font-medium uppercase tracking-wider block mb-1" style={{ color: "#ef4444" }}>
            Rolling Back
          </span>
          <p className="text-[0.7rem] leading-relaxed" style={{ color: "var(--pn-text-primary)", fontFamily: "var(--font-mono, monospace)" }}>
            {rule.content}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[0.55rem] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,149,240,0.12)", color: "#6b95f0" }}>
              v{rule.version}
            </span>
            <span className="text-[0.55rem]" style={{ color: "var(--pn-text-muted)" }}>
              {new Date(rule.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Version history timeline */}
        {loading ? (
          <div className="py-4 text-center">
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>Loading history...</span>
          </div>
        ) : versions.length > 1 ? (
          <div>
            <span className="text-[0.65rem] font-medium block mb-2" style={{ color: "var(--pn-text-secondary)" }}>
              Version History
            </span>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg p-2 flex items-start gap-2"
                  style={{
                    background: v.id === rule.id ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${v.id === rule.id ? "rgba(239,68,68,0.15)" : "var(--pn-border-subtle)"}`,
                  }}
                >
                  <div
                    className="shrink-0 w-1 rounded-full mt-0.5"
                    style={{
                      height: "100%",
                      minHeight: "16px",
                      background: v.status === "active" ? "#22c55e" : v.status === "proposed" ? "#f59e0b" : "#ef4444",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.6rem] leading-relaxed truncate" style={{ color: "var(--pn-text-primary)" }}>
                      {v.content.slice(0, 100)}{v.content.length > 100 ? "..." : ""}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[0.5rem] px-1 py-0.5 rounded" style={{ background: "rgba(107,149,240,0.12)", color: "#6b95f0" }}>
                        v{v.version}
                      </span>
                      <span className="text-[0.5rem]" style={{ color: "var(--pn-text-muted)" }}>
                        {v.status}
                      </span>
                      <span className="text-[0.5rem] ml-auto" style={{ color: "var(--pn-text-muted)" }}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2 text-center">
            <span className="text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
              No previous versions — this is v1
            </span>
          </div>
        )}

        {/* Rollback preview */}
        {rule.previous_rule_id && (
          <div className="rounded-lg p-3" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
            <span className="text-[0.55rem] font-medium uppercase tracking-wider block mb-1" style={{ color: "#22c55e" }}>
              Will Reactivate Previous Version
            </span>
            <p className="text-[0.6rem]" style={{ color: "var(--pn-text-secondary)" }}>
              The previous version (v{rule.version - 1}) will be restored to active status.
            </p>
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
            onClick={handleRollback}
            disabled={rolling}
            className="text-[0.65rem] font-medium px-3 py-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            {rolling ? "Rolling back..." : "Confirm Rollback"}
          </button>
        </div>
      </div>
    </div>
  );
}
