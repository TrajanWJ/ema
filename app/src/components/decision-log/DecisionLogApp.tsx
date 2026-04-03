import { useEffect, useState, type CSSProperties } from "react";
import { useDecisionStore } from "@/stores/decision-store";
import type { Decision } from "@/stores/decision-store";

const card: CSSProperties = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
};
const inputStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--pn-text-primary)",
  fontSize: "0.82rem",
  width: "100%",
  outline: "none",
};
const btnStyle: CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  textAlign: "center",
  fontWeight: 500,
};

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
            fontSize: "0.9rem",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      style={{
        fontSize: "0.7rem",
        padding: "2px 7px",
        borderRadius: 4,
        background: "rgba(0, 210, 255, 0.08)",
        color: "rgba(0, 210, 255, 0.7)",
        border: "1px solid rgba(0, 210, 255, 0.12)",
      }}
    >
      {tag}
    </span>
  );
}

function DecisionList({ filter }: { filter: string }) {
  const { decisions, selected, selectDecision, setCreating } = useDecisionStore();
  const filtered = filter
    ? decisions.filter((d) => d.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase())))
    : decisions;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 260 }}>
      <div style={{ padding: "12px 14px 8px", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--pn-text-primary)", flex: 1 }}>
          Decisions
        </span>
        <button onClick={() => setCreating(true)} style={{ ...btnStyle, width: "auto", padding: "4px 12px", background: "rgba(0,210,255,0.1)", border: "1px solid rgba(0,210,255,0.2)" }}>
          + New
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 && (
          <span style={{ color: "var(--pn-text-muted)", fontSize: "0.8rem", padding: 12 }}>No decisions yet</span>
        )}
        {filtered.map((d) => (
          <div
            key={d.id}
            onClick={() => selectDecision(d)}
            style={{
              ...card,
              borderColor: selected?.id === d.id ? "rgba(0, 210, 255, 0.3)" : "rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontSize: "0.82rem", color: "var(--pn-text-primary)", fontWeight: 500, marginBottom: 4 }}>
              {d.title}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--pn-text-secondary)", display: "flex", gap: 8, alignItems: "center" }}>
              <span>{d.decided_by}</span>
              <span>{new Date(d.inserted_at).toLocaleDateString()}</span>
              {d.outcome_score != null && <Stars score={d.outcome_score} />}
            </div>
            {d.tags.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                {d.tags.map((t) => <TagBadge key={t} tag={t} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionDetail({ decision }: { decision: Decision }) {
  const { updateDecision, deleteDecision } = useDecisionStore();

  return (
    <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", color: "var(--pn-text-primary)", margin: 0, fontWeight: 600 }}>
            {decision.title}
          </h2>
          <div style={{ fontSize: "0.78rem", color: "var(--pn-text-secondary)", marginTop: 4 }}>
            {decision.decided_by} &middot; {new Date(decision.inserted_at).toLocaleDateString()}
          </div>
        </div>
        <button onClick={() => deleteDecision(decision.id)} style={{ ...btnStyle, width: "auto", padding: "4px 10px", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          Delete
        </button>
      </div>

      {decision.context && (
        <div style={{ ...card, cursor: "default", marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", color: "var(--pn-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Context</div>
          <div style={{ fontSize: "0.82rem", color: "var(--pn-text-secondary)", whiteSpace: "pre-wrap" }}>{decision.context}</div>
        </div>
      )}

      {decision.options.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", color: "var(--pn-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Options</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {decision.options.map((opt) => (
              <div
                key={opt.label}
                style={{
                  ...card,
                  cursor: "default",
                  borderColor: decision.chosen_option === opt.label ? "rgba(0, 210, 255, 0.3)" : "rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: "0.82rem", color: "var(--pn-text-primary)", fontWeight: 500, marginBottom: 6 }}>
                  {opt.label}
                  {decision.chosen_option === opt.label && (
                    <span style={{ color: "rgba(0,210,255,0.7)", fontSize: "0.7rem", marginLeft: 8 }}>CHOSEN</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    {opt.pros.map((p) => (
                      <div key={p} style={{ fontSize: "0.76rem", color: "#2dd4a8" }}>+ {p}</div>
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    {opt.cons.map((c) => (
                      <div key={c} style={{ fontSize: "0.76rem", color: "#ef4444" }}>- {c}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {decision.reasoning && (
        <div style={{ ...card, cursor: "default", marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", color: "var(--pn-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reasoning</div>
          <div style={{ fontSize: "0.82rem", color: "var(--pn-text-secondary)", whiteSpace: "pre-wrap" }}>{decision.reasoning}</div>
        </div>
      )}

      <div style={{ ...card, cursor: "default", marginBottom: 14 }}>
        <div style={{ fontSize: "0.72rem", color: "var(--pn-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Outcome</div>
        <div style={{ fontSize: "0.82rem", color: "var(--pn-text-secondary)", marginBottom: 6 }}>
          {decision.outcome ?? "Not yet reviewed"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.72rem", color: "var(--pn-text-muted)" }}>Score:</span>
          <Stars score={decision.outcome_score} onRate={(n) => updateDecision(decision.id, { outcome_score: n })} />
        </div>
      </div>

      {decision.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {decision.tags.map((t) => <TagBadge key={t} tag={t} />)}
        </div>
      )}
    </div>
  );
}

function NewDecisionForm() {
  const { createDecision, setCreating } = useDecisionStore();
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [decidedBy, setDecidedBy] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [options, setOptions] = useState([{ label: "", pros: "", cons: "" }]);

  function addOption() {
    setOptions([...options, { label: "", pros: "", cons: "" }]);
  }

  function updateOption(idx: number, field: string, value: string) {
    setOptions(options.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));
  }

  function handleSave() {
    if (!title.trim()) return;
    createDecision({
      title: title.trim(),
      context: context.trim(),
      decided_by: decidedBy.trim() || "Trajan",
      reasoning: reasoning.trim() || null,
      options: options
        .filter((o) => o.label.trim())
        .map((o) => ({
          label: o.label.trim(),
          pros: o.pros.split(",").map((s) => s.trim()).filter(Boolean),
          cons: o.cons.split(",").map((s) => s.trim()).filter(Boolean),
        })),
      tags: [],
    });
  }

  return (
    <div style={{ padding: 20, overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--pn-text-primary)" }}>New Decision</span>
        <button onClick={() => setCreating(false)} style={{ ...btnStyle, width: "auto", padding: "4px 10px" }}>Cancel</button>
      </div>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      <textarea placeholder="Context — what prompted this decision?" value={context} onChange={(e) => setContext(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      <input placeholder="Decided by" value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} style={inputStyle} />

      <div>
        <div style={{ fontSize: "0.72rem", color: "var(--pn-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Options</div>
        {options.map((opt, idx) => (
          <div key={idx} style={{ ...card, cursor: "default", marginBottom: 8 }}>
            <input placeholder="Option label" value={opt.label} onChange={(e) => updateOption(idx, "label", e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
            <input placeholder="Pros (comma separated)" value={opt.pros} onChange={(e) => updateOption(idx, "pros", e.target.value)} style={{ ...inputStyle, marginBottom: 4, color: "#2dd4a8" }} />
            <input placeholder="Cons (comma separated)" value={opt.cons} onChange={(e) => updateOption(idx, "cons", e.target.value)} style={{ ...inputStyle, color: "#ef4444" }} />
          </div>
        ))}
        <button onClick={addOption} style={{ ...btnStyle, padding: "4px 10px" }}>+ Add Option</button>
      </div>

      <textarea placeholder="Reasoning — why did you choose this option?" value={reasoning} onChange={(e) => setReasoning(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      <button onClick={handleSave} style={{ ...btnStyle, background: "rgba(0,210,255,0.12)", border: "1px solid rgba(0,210,255,0.25)", color: "rgba(0,210,255,0.9)", fontWeight: 600, padding: "10px 0" }}>
        Save Decision
      </button>
    </div>
  );
}

export function DecisionLogApp() {
  const [filter, setFilter] = useState("");
  const { selected, creating, loadDecisions } = useDecisionStore();

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  return (
    <div style={{ width: "100%", height: "100vh", background: "rgba(8, 9, 14, 0.95)", display: "flex", flexDirection: "column" }}>
      <div
        data-tauri-drag-region
        style={{ height: 36, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}
      >
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--pn-text-primary)" }}>Decision Log</span>
        <input
          placeholder="Filter by tag..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...inputStyle, width: 160, padding: "4px 8px", fontSize: "0.75rem", marginLeft: "auto" }}
        />
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: 300, borderRight: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <DecisionList filter={filter} />
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {creating ? (
            <NewDecisionForm />
          ) : selected ? (
            <DecisionDetail decision={selected} />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "var(--pn-text-muted)", fontSize: "0.82rem" }}>Select a decision or create a new one</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
