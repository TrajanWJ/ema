import { useEffect, useState } from "react";
import { useIntentStore, type Intent } from "../../store/intentStore";
import { TagPanel } from "../shared/TagPanel";
import * as hq from "../../api/hq";

const LEVEL_LABELS = ["Vision", "Strategy", "Objective", "Initiative", "Task", "Step"];
const LEVEL_COLORS = [
  "var(--yellow)", "var(--orange)", "var(--purple)",
  "var(--accent)", "var(--green)", "var(--dim)",
];

const STATUS_COLORS: Record<string, string> = {
  planned: "var(--dim)",
  active: "var(--accent)",
  researched: "var(--purple)",
  outlined: "var(--purple)",
  implementing: "var(--orange)",
  complete: "var(--green)",
  blocked: "var(--red)",
  archived: "var(--muted)",
};

type ViewMode = "tree" | "flat";

export function IntentsPage() {
  const { intents, loading, loadIntents, createIntent } = useIntentStore();
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", level: 4, kind: "task", parent_id: "",
  });

  useEffect(() => {
    void loadIntents();
  }, [loadIntents]);

  const filtered = filterLevel != null
    ? intents.filter((i) => i.level === filterLevel)
    : intents;

  async function handleCreate() {
    if (!form.title.trim()) return;
    await createIntent({
      title: form.title,
      description: form.description || null,
      level: form.level,
      kind: form.kind,
      parent_id: form.parent_id || null,
    });
    setModalOpen(false);
    setForm({ title: "", description: "", level: 4, kind: "task", parent_id: "" });
  }

  const detailIntent = detailId ? intents.find((i) => i.id === detailId) : null;

  return (
    <div className="page">
      <div className="page-title">
        <h1>Intents</h1>
        <div className="row">
          <button
            onClick={() => setViewMode(viewMode === "tree" ? "flat" : "tree")}
            style={{ fontSize: 11 }}
          >
            {viewMode === "tree" ? "◫ Flat" : "◇ Tree"}
          </button>
          <button
            onClick={() => setFilterLevel(null)}
            style={{ background: filterLevel == null ? "rgba(255,255,255,0.12)" : undefined }}
          >
            All
          </button>
          {LEVEL_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setFilterLevel(i)}
              style={{
                background: filterLevel === i ? `${LEVEL_COLORS[i]}20` : undefined,
                color: filterLevel === i ? LEVEL_COLORS[i] : undefined,
                fontSize: 11,
              }}
            >
              L{i}
            </button>
          ))}
          <button onClick={() => setModalOpen(true)}>New</button>
        </div>
      </div>

      {loading && intents.length === 0 && (
        <div className="muted" style={{ textAlign: "center", padding: 32 }}>Loading intents...</div>
      )}

      <div className="split">
        <div style={{ flex: 2 }}>
          {viewMode === "tree" ? (
            <IntentTree
              intents={filtered}
              allIntents={intents}
              selectedId={detailId}
              onSelect={setDetailId}
            />
          ) : (
            <IntentFlat
              intents={filtered}
              selectedId={detailId}
              onSelect={setDetailId}
            />
          )}
        </div>

        {detailIntent && (
          <div style={{ flex: 1, minWidth: 280 }}>
            <IntentDetail
              intent={detailIntent}
              allIntents={intents}
              onClose={() => setDetailId(null)}
            />
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="glass modal" onClick={(e) => e.stopPropagation()}>
            <h1 style={{ fontSize: 18, marginBottom: 12 }}>New Intent</h1>
            <div className="card-list">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" autoFocus />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
              <div className="row">
                <select value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}>
                  {LEVEL_LABELS.map((label, i) => (
                    <option key={i} value={i}>L{i} — {label}</option>
                  ))}
                </select>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {["goal", "question", "task", "exploration", "fix", "audit", "system"].map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
                <option value="">No parent</option>
                {intents
                  .filter((i) => i.level < form.level)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      L{i.level} {i.title}
                    </option>
                  ))}
              </select>
              <div className="row">
                <button onClick={handleCreate}>Create</button>
                <button onClick={() => setModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Tree View ---

function IntentTree({
  intents,
  allIntents,
  selectedId,
  onSelect,
}: {
  intents: Intent[];
  allIntents: Intent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Build tree: roots are intents with no parent (or parent not in set)
  const intentIds = new Set(allIntents.map((i) => i.id));
  const roots = intents.filter((i) => !i.parent_id || !intentIds.has(i.parent_id));
  const childrenOf = (parentId: string) =>
    allIntents.filter((i) => i.parent_id === parentId);

  if (roots.length === 0) {
    return <div className="muted" style={{ textAlign: "center", padding: 32 }}>No intents</div>;
  }

  return (
    <div className="card-list">
      {roots
        .sort((a, b) => a.level - b.level || b.priority - a.priority)
        .map((intent) => (
          <IntentTreeNode
            key={intent.id}
            intent={intent}
            childrenOf={childrenOf}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

function IntentTreeNode({
  intent,
  childrenOf,
  depth,
  selectedId,
  onSelect,
}: {
  intent: Intent;
  childrenOf: (parentId: string) => Intent[];
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const children = childrenOf(intent.id);
  const hasChildren = children.length > 0;
  const isSelected = intent.id === selectedId;
  const levelColor = LEVEL_COLORS[intent.level] || "var(--dim)";

  return (
    <div>
      <div
        className="card"
        onClick={() => onSelect(intent.id)}
        style={{
          marginLeft: depth * 20,
          cursor: "pointer",
          border: isSelected ? `1px solid ${levelColor}` : undefined,
          background: isSelected ? `${levelColor}10` : undefined,
        }}
      >
        <div className="row-between">
          <div className="row">
            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                style={{ background: "none", border: "none", fontSize: 10, padding: 0, color: "var(--muted)" }}
              >
                {expanded ? "▾" : "▸"}
              </button>
            )}
            <span
              className="status-dot"
              style={{ background: STATUS_COLORS[intent.status] || "var(--dim)" }}
            />
            <span style={{ color: levelColor, fontSize: 10, fontWeight: 600 }}>
              L{intent.level}
            </span>
            <strong style={{ fontSize: 12 }}>{intent.title}</strong>
          </div>
          <div className="row">
            {intent.priority > 0 && (
              <span className="badge" style={{ fontSize: 9, color: "var(--yellow)" }}>
                P{intent.priority}
              </span>
            )}
            <span className="badge" style={{ fontSize: 9 }}>{intent.status}</span>
          </div>
        </div>
        {intent.completion_pct != null && intent.completion_pct > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 999 }}>
              <div style={{ width: `${intent.completion_pct}%`, height: "100%", background: levelColor, borderRadius: 999 }} />
            </div>
          </div>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {children
            .sort((a, b) => a.level - b.level || b.priority - a.priority)
            .map((child) => (
              <IntentTreeNode
                key={child.id}
                intent={child}
                childrenOf={childrenOf}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// --- Flat View ---

function IntentFlat({
  intents,
  selectedId,
  onSelect,
}: {
  intents: Intent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const grouped = intents.reduce<Record<number, Intent[]>>((acc, intent) => {
    if (!acc[intent.level]) acc[intent.level] = [];
    acc[intent.level].push(intent);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(grouped)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([level, levelIntents]) => (
          <div key={level} style={{ marginBottom: 16 }}>
            <div className="row" style={{ marginBottom: 8, color: LEVEL_COLORS[Number(level)], fontSize: 12, fontWeight: 600 }}>
              L{level} — {LEVEL_LABELS[Number(level)] || "Unknown"}
              <span className="badge" style={{ fontSize: 10 }}>{levelIntents.length}</span>
            </div>
            <div className="card-list">
              {levelIntents.map((intent) => (
                <div
                  key={intent.id}
                  className="glass panel"
                  onClick={() => onSelect(intent.id)}
                  style={{
                    cursor: "pointer",
                    border: selectedId === intent.id ? `1px solid ${LEVEL_COLORS[intent.level]}` : undefined,
                  }}
                >
                  <div className="row-between">
                    <div className="row">
                      <span className="status-dot" style={{ background: STATUS_COLORS[intent.status] || "var(--dim)" }} />
                      <strong>{intent.title}</strong>
                    </div>
                    <div className="row">
                      <span className="badge">{intent.status}</span>
                      <span className="badge">{intent.kind}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

// --- Detail Panel ---

function IntentDetail({
  intent,
  allIntents,
  onClose,
}: {
  intent: Intent;
  allIntents: Intent[];
  onClose: () => void;
}) {
  const [lineage, setLineage] = useState<unknown[]>([]);
  const [runtime, setRuntime] = useState<Record<string, unknown> | null>(null);

  const parent = intent.parent_id ? allIntents.find((i) => i.id === intent.parent_id) : null;
  const children = allIntents.filter((i) => i.parent_id === intent.id);
  const levelColor = LEVEL_COLORS[intent.level] || "var(--dim)";

  useEffect(() => {
    hq.getIntentLineage(intent.id)
      .then((data) => setLineage(Array.isArray(data) ? data : []))
      .catch(() => {});
    hq.getIntentRuntime(intent.id)
      .then((data) => setRuntime(data as Record<string, unknown>))
      .catch(() => {});
  }, [intent.id]);

  return (
    <div className="card-list">
      <div className="glass panel">
        <div className="row-between">
          <span style={{ color: levelColor, fontWeight: 600 }}>
            L{intent.level} — {LEVEL_LABELS[intent.level]}
          </span>
          <button onClick={onClose} style={{ fontSize: 10 }}>×</button>
        </div>
        <h2 style={{ margin: "8px 0 0", fontSize: 16 }}>{intent.title}</h2>
        {intent.description && (
          <div style={{ marginTop: 8, fontSize: 12 }}>{intent.description}</div>
        )}
        <div style={{ marginTop: 12, fontSize: 11 }} className="card-list">
          <div className="row-between">
            <span className="muted">Status</span>
            <span className="badge" style={{ color: STATUS_COLORS[intent.status] }}>{intent.status}</span>
          </div>
          <div className="row-between">
            <span className="muted">Kind</span>
            <span>{intent.kind}</span>
          </div>
          <div className="row-between">
            <span className="muted">Priority</span>
            <span>P{intent.priority}</span>
          </div>
          {intent.phase != null && (
            <div className="row-between">
              <span className="muted">Phase</span>
              <span>{intent.phase}</span>
            </div>
          )}
          {intent.completion_pct != null && (
            <div className="row-between">
              <span className="muted">Completion</span>
              <span>{intent.completion_pct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Hierarchy */}
      {(parent || children.length > 0) && (
        <div className="glass panel">
          <strong style={{ fontSize: 11 }}>Hierarchy</strong>
          {parent && (
            <div className="card" style={{ marginTop: 8, fontSize: 11 }}>
              <span className="muted">Parent: </span>
              <span style={{ color: LEVEL_COLORS[parent.level] }}>L{parent.level}</span>
              {" "}{parent.title}
            </div>
          )}
          {children.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span className="muted" style={{ fontSize: 10 }}>Children ({children.length})</span>
              {children.map((c) => (
                <div key={c.id} className="card" style={{ marginTop: 4, fontSize: 11 }}>
                  <span style={{ color: LEVEL_COLORS[c.level] }}>L{c.level}</span>
                  {" "}{c.title}
                  <span className="badge" style={{ marginLeft: 8, fontSize: 9 }}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Runtime */}
      {runtime && Object.keys(runtime).length > 0 && (
        <div className="glass panel">
          <strong style={{ fontSize: 11 }}>Runtime</strong>
          <pre style={{
            marginTop: 8, fontSize: 10, whiteSpace: "pre-wrap",
            fontFamily: "JetBrains Mono, monospace",
            background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 8,
          }}>
            {JSON.stringify(runtime, null, 2)}
          </pre>
        </div>
      )}

      {/* Tags */}
      <div className="glass panel">
        <strong style={{ fontSize: 11, marginBottom: 8, display: "block" }}>Tags</strong>
        <TagPanel entityType="intent" entityId={intent.id} />
      </div>
    </div>
  );
}
