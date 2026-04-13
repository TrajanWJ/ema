import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useDecisionLogStore } from "@/stores/decision-log-store";
import type { Decision } from "@/stores/decision-log-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["decision-log"];

function Stars({ score, onRate }: { score: number | null; onRate?: (n: number) => void }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onRate?.(n)}
          style={{
            cursor: onRate ? "pointer" : "default",
            color: (score ?? 0) >= n ? "#f59e0b" : "rgba(255,255,255,0.12)",
            fontSize: 14,
          }}
        >
          \u2605
        </span>
      ))}
    </span>
  );
}

export function DecisionLogApp() {
  const store = useDecisionLogStore();
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContext, setFormContext] = useState("");
  const [formDecidedBy, setFormDecidedBy] = useState("");
  const [formReasoning, setFormReasoning] = useState("");
  const [formOptions, setFormOptions] = useState([{ label: "", pros: "", cons: "" }]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await store.loadViaRest();
      } catch (err) {
        if (!cancelled) console.warn("Failed to load decisions:", err);
      }
      if (!cancelled) setReady(true);
      store.connect().catch(() => {
        console.warn("Decision Log WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="decision-log" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const filtered = filter
    ? store.decisions.filter((d) =>
        d.title.toLowerCase().includes(filter.toLowerCase()) ||
        d.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase()))
      )
    : store.decisions;

  function resetForm() {
    setFormTitle("");
    setFormContext("");
    setFormDecidedBy("");
    setFormReasoning("");
    setFormOptions([{ label: "", pros: "", cons: "" }]);
    setShowForm(false);
  }

  async function handleCreate() {
    if (!formTitle.trim()) return;
    await store.createDecision({
      title: formTitle.trim(),
      context: formContext.trim(),
      decided_by: formDecidedBy.trim() || "Trajan",
      reasoning: formReasoning.trim() || null,
      options: formOptions
        .filter((o) => o.label.trim())
        .map((o) => ({
          label: o.label.trim(),
          pros: o.pros.split(",").map((s) => s.trim()).filter(Boolean),
          cons: o.cons.split(",").map((s) => s.trim()).filter(Boolean),
        })),
      tags: [],
    });
    resetForm();
    await store.loadViaRest();
  }

  function updateOption(idx: number, field: string, value: string) {
    setFormOptions(formOptions.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));
  }

  return (
    <AppWindowChrome appId="decision-log" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ display: "flex", height: "100%" }}>
        {/* Left: Decision list */}
        <div style={{ width: 300, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 12px 8px", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pn-text-primary)", flex: 1 }}>Decisions</span>
            <button
              onClick={() => { setShowForm(true); store.selectDecision(null); }}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(192,132,252,0.12)",
                color: "#c084fc",
                border: "1px solid rgba(192,132,252,0.2)",
                cursor: "pointer",
              }}
            >
              + New
            </button>
          </div>
          <div style={{ padding: "0 12px 8px" }}>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by title or tag..."
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                color: "var(--pn-text-primary)",
                outline: "none",
              }}
            />
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.length === 0 && (
              <span style={{ color: "var(--pn-text-muted)", fontSize: 12, padding: 12 }}>No decisions yet</span>
            )}
            {filtered.map((d) => (
              <div
                key={d.id}
                onClick={() => { store.selectDecision(d); setShowForm(false); }}
                style={{
                  background: store.selected?.id === d.id ? "rgba(192,132,252,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${store.selected?.id === d.id ? "rgba(192,132,252,0.2)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{d.title}</div>
                <div style={{ fontSize: 11, color: "var(--pn-text-secondary)", display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{d.decided_by}</span>
                  <span>{new Date(d.inserted_at).toLocaleDateString()}</span>
                  {d.outcome_score != null && <Stars score={d.outcome_score} />}
                </div>
                {d.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {d.tags.map((t) => (
                      <span key={t} style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(192,132,252,0.08)",
                        color: "rgba(192,132,252,0.7)",
                        border: "1px solid rgba(192,132,252,0.12)",
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail or form */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {showForm ? (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>New Decision</span>
                <button onClick={resetForm} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", color: "var(--pn-text-secondary)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>Cancel</button>
              </div>
              <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Title" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--pn-text-primary)", outline: "none" }} />
              <textarea value={formContext} onChange={(e) => setFormContext(e.target.value)} placeholder="Context - what prompted this decision?" rows={3} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--pn-text-primary)", outline: "none", resize: "vertical" }} />
              <input value={formDecidedBy} onChange={(e) => setFormDecidedBy(e.target.value)} placeholder="Decided by" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--pn-text-primary)", outline: "none" }} />

              <div>
                <div style={{ fontSize: 11, color: "var(--pn-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Options</div>
                {formOptions.map((opt, idx) => (
                  <div key={idx} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <input value={opt.label} onChange={(e) => updateOption(idx, "label", e.target.value)} placeholder="Option label" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--pn-text-primary)", outline: "none", marginBottom: 6 }} />
                    <input value={opt.pros} onChange={(e) => updateOption(idx, "pros", e.target.value)} placeholder="Pros (comma separated)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#2dd4a8", outline: "none", marginBottom: 4 }} />
                    <input value={opt.cons} onChange={(e) => updateOption(idx, "cons", e.target.value)} placeholder="Cons (comma separated)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#ef4444", outline: "none" }} />
                  </div>
                ))}
                <button onClick={() => setFormOptions([...formOptions, { label: "", pros: "", cons: "" }])} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", color: "var(--pn-text-secondary)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>+ Add Option</button>
              </div>

              <textarea value={formReasoning} onChange={(e) => setFormReasoning(e.target.value)} placeholder="Reasoning - why did you choose this option?" rows={3} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--pn-text-primary)", outline: "none", resize: "vertical" }} />
              <button
                onClick={handleCreate}
                disabled={!formTitle.trim()}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px 0",
                  borderRadius: 8,
                  background: "rgba(192,132,252,0.15)",
                  color: "#c084fc",
                  border: "1px solid rgba(192,132,252,0.25)",
                  cursor: formTitle.trim() ? "pointer" : "default",
                  opacity: formTitle.trim() ? 1 : 0.4,
                }}
              >
                Save Decision
              </button>
            </div>
          ) : store.selected ? (
            <DecisionDetail
              decision={store.selected}
              onUpdate={(attrs) => store.updateDecision(store.selected!.id, attrs)}
              onDelete={() => store.deleteDecision(store.selected!.id)}
            />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ color: "var(--pn-text-muted)", fontSize: 13 }}>Select a decision or create a new one</span>
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function DecisionDetail({
  decision,
  onUpdate,
  onDelete,
}: {
  readonly decision: Decision;
  readonly onUpdate: (attrs: Record<string, unknown>) => void;
  readonly onDelete: () => void;
}) {
  return (
    <div style={{ padding: 20, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{decision.title}</h2>
          <div style={{ fontSize: 12, color: "var(--pn-text-secondary)", marginTop: 4 }}>
            {decision.decided_by} &middot; {new Date(decision.inserted_at).toLocaleDateString()}
          </div>
        </div>
        <button onClick={onDelete} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
          Delete
        </button>
      </div>

      {decision.context && (
        <div style={{
          background: "rgba(14, 16, 23, 0.55)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, color: "var(--pn-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Context</div>
          <div style={{ fontSize: 13, color: "var(--pn-text-secondary)", whiteSpace: "pre-wrap" }}>{decision.context}</div>
        </div>
      )}

      {decision.options.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "var(--pn-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Options</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {decision.options.map((opt) => (
              <div
                key={opt.label}
                style={{
                  background: "rgba(14, 16, 23, 0.55)",
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${decision.chosen_option === opt.label ? "rgba(192,132,252,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  {opt.label}
                  {decision.chosen_option === opt.label && (
                    <span style={{ color: "rgba(192,132,252,0.7)", fontSize: 10, marginLeft: 8 }}>CHOSEN</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    {opt.pros.map((p) => (
                      <div key={p} style={{ fontSize: 12, color: "#2dd4a8" }}>+ {p}</div>
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    {opt.cons.map((c) => (
                      <div key={c} style={{ fontSize: 12, color: "#ef4444" }}>- {c}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {decision.reasoning && (
        <div style={{
          background: "rgba(14, 16, 23, 0.55)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, color: "var(--pn-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reasoning</div>
          <div style={{ fontSize: 13, color: "var(--pn-text-secondary)", whiteSpace: "pre-wrap" }}>{decision.reasoning}</div>
        </div>
      )}

      <div style={{
        background: "rgba(14, 16, 23, 0.55)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 10, color: "var(--pn-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Outcome</div>
        <div style={{ fontSize: 13, color: "var(--pn-text-secondary)", marginBottom: 6 }}>
          {decision.outcome ?? "Not yet reviewed"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--pn-text-muted)" }}>Score:</span>
          <Stars score={decision.outcome_score} onRate={(n) => onUpdate({ outcome_score: n })} />
        </div>
      </div>

      {decision.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {decision.tags.map((t) => (
            <span key={t} style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(192,132,252,0.08)",
              color: "rgba(192,132,252,0.7)",
              border: "1px solid rgba(192,132,252,0.12)",
            }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
