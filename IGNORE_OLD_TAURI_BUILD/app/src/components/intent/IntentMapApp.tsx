import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useIntentStore, type Intent } from "@/stores/intent-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["intent-map"];

const LEVEL_COLORS = ["#fbbf24", "#fb923c", "#a78bfa", "#38bdf8", "#34d399", "#6b7280"];
const LEVEL_NAMES = ["Vision", "Strategy", "Objective", "Initiative", "Task", "Step"];

const STATUS_COLORS: Record<string, string> = {
  planned: "#6b7280",
  active: "#38bdf8",
  researched: "#a78bfa",
  outlined: "#a78bfa",
  implementing: "#fb923c",
  complete: "#22c55e",
  blocked: "#ef4444",
  archived: "#374151",
};

type ViewMode = "tree" | "flat";

export function IntentMapApp() {
  const {
    intents, connected,
    loadViaRest, connect, selectIntent, selectedIntent,
    runtime, createIntent, getChildren, getRoots, levelName,
  } = useIntentStore();

  const [ready, setReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", level: 4, kind: "task", parent_id: "" });

  useEffect(() => {
    async function init() {
      try { await connect(); } catch { await loadViaRest().catch(() => {}); }
      setReady(true);
    }
    init();
  }, []);

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
    } as Partial<Intent>);
    setForm({ title: "", description: "", level: 4, kind: "task", parent_id: "" });
    setShowCreate(false);
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="intent-map" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="intent-map" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: connected ? "#22C55E" : "var(--pn-text-muted)" }}>
            {connected ? "\u25CF live" : "\u25CB rest"}
          </span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--pn-text-muted)" }}>
            {intents.length} intents
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button
              onClick={() => setViewMode(viewMode === "tree" ? "flat" : "tree")}
              style={pillStyle(false)}
            >
              {viewMode === "tree" ? "Flat" : "Tree"}
            </button>
            <button onClick={() => setShowCreate(!showCreate)} style={pillStyle(false)}>
              + New
            </button>
          </div>
        </div>

        {/* Level filters */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button onClick={() => setFilterLevel(null)} style={pillStyle(filterLevel === null)}>
            All
          </button>
          {LEVEL_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => setFilterLevel(i)}
              style={{
                ...pillStyle(filterLevel === i),
                color: filterLevel === i ? LEVEL_COLORS[i] : "var(--pn-text-muted)",
                borderColor: filterLevel === i ? `${LEVEL_COLORS[i]}44` : "transparent",
              }}
            >
              L{i} {name}
            </button>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{
            display: "flex", flexDirection: "column", gap: 6,
            padding: 10, borderRadius: 8,
            background: "rgba(14,16,23,0.55)", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Intent title"
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })} style={inputStyle}>
                {LEVEL_NAMES.map((n, i) => <option key={i} value={i}>L{i} — {n}</option>)}
              </select>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={inputStyle}>
                {["goal", "question", "task", "exploration", "fix", "audit", "system"].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} style={inputStyle}>
                <option value="">No parent</option>
                {intents.filter((i) => i.level < form.level).map((i) => (
                  <option key={i.id} value={i.id}>L{i.level} {i.title}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleCreate} style={{ ...pillStyle(true), background: "#6366f1", color: "#fff" }}>
                Create
              </button>
              <button onClick={() => setShowCreate(false)} style={pillStyle(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{ display: "flex", flex: 1, gap: 10, minHeight: 0 }}>
          {/* Intent list/tree */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {viewMode === "tree" ? (
              <TreeView intents={filtered} selectedId={selectedIntent?.id ?? null} onSelect={(i) => selectIntent(i)} getChildren={getChildren} getRoots={getRoots} />
            ) : (
              <FlatView intents={filtered} selectedId={selectedIntent?.id ?? null} onSelect={(i) => selectIntent(i)} />
            )}
          </div>

          {/* Detail panel */}
          {selectedIntent && (
            <div style={{
              width: 300, flexShrink: 0, overflowY: "auto",
              borderRadius: 10, padding: 14,
              background: "rgba(14,16,23,0.60)", backdropFilter: "blur(20px)",
              border: `1px solid ${LEVEL_COLORS[selectedIntent.level]}30`,
            }}>
              <DetailPanel
                intent={selectedIntent}
                allIntents={intents}
                runtime={runtime}
                levelName={levelName}
                onClose={() => selectIntent(null)}
              />
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}

// --- Tree View ---

function TreeView({ intents, selectedId, onSelect, getChildren, getRoots }: {
  intents: readonly Intent[];
  selectedId: string | null;
  onSelect: (i: Intent) => void;
  getChildren: (id: string) => readonly Intent[];
  getRoots: () => readonly Intent[];
}) {
  const filteredIds = new Set(intents.map((i) => i.id));
  const roots = getRoots().filter((r) => filteredIds.has(r.id));

  if (roots.length === 0) {
    return <div style={{ color: "var(--pn-text-muted)", textAlign: "center", paddingTop: 40, fontSize: 12 }}>No intents</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {roots.sort((a, b) => a.level - b.level || b.priority - a.priority).map((intent) => (
        <TreeNode key={intent.id} intent={intent} depth={0} selectedId={selectedId} onSelect={onSelect} getChildren={getChildren} />
      ))}
    </div>
  );
}

function TreeNode({ intent, depth, selectedId, onSelect, getChildren }: {
  intent: Intent;
  depth: number;
  selectedId: string | null;
  onSelect: (i: Intent) => void;
  getChildren: (id: string) => readonly Intent[];
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const children = getChildren(intent.id);
  const hasChildren = children.length > 0;
  const isSelected = intent.id === selectedId;
  const color = LEVEL_COLORS[intent.level] || "#6b7280";

  return (
    <div>
      <button
        onClick={() => onSelect(intent)}
        style={{
          width: "100%", textAlign: "left",
          marginLeft: depth * 18, maxWidth: `calc(100% - ${depth * 18}px)`,
          padding: "8px 10px", borderRadius: 6, cursor: "pointer",
          background: isSelected ? `${color}12` : "rgba(255,255,255,0.02)",
          border: isSelected ? `1px solid ${color}30` : "1px solid rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 2,
        }}
      >
        {hasChildren && (
          <span
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ fontSize: 9, color: "var(--pn-text-muted)", cursor: "pointer", width: 10 }}
          >
            {expanded ? "\u25BE" : "\u25B8"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 10 }} />}
        <span style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
          background: STATUS_COLORS[intent.status] || "#6b7280",
        }} />
        <span style={{ fontSize: 10, color, fontWeight: 600, flexShrink: 0 }}>L{intent.level}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pn-text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {intent.title}
        </span>
        {intent.priority > 0 && (
          <span style={{ fontSize: 9, color: "#fbbf24", fontFamily: "monospace" }}>P{intent.priority}</span>
        )}
        <span style={{
          fontSize: 9, padding: "1px 6px", borderRadius: 6,
          background: `${STATUS_COLORS[intent.status] || "#6b7280"}15`,
          color: STATUS_COLORS[intent.status] || "#6b7280",
        }}>
          {intent.status}
        </span>
      </button>
      {expanded && hasChildren && (
        <div>
          {[...children].sort((a, b) => b.priority - a.priority).map((child) => (
            <TreeNode key={child.id} intent={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} getChildren={getChildren} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Flat View ---

function FlatView({ intents, selectedId, onSelect }: {
  intents: readonly Intent[];
  selectedId: string | null;
  onSelect: (i: Intent) => void;
}) {
  const grouped = intents.reduce<Record<number, Intent[]>>((acc, i) => {
    if (!acc[i.level]) acc[i.level] = [];
    acc[i.level].push(i);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([level, items]) => (
        <div key={level}>
          <div style={{ fontSize: 11, fontWeight: 600, color: LEVEL_COLORS[Number(level)], marginBottom: 6 }}>
            L{level} — {LEVEL_NAMES[Number(level)]}
            <span style={{ fontSize: 10, marginLeft: 6, color: "var(--pn-text-muted)" }}>({items.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((intent) => (
              <button
                key={intent.id}
                onClick={() => onSelect(intent)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                  background: selectedId === intent.id ? `${LEVEL_COLORS[intent.level]}12` : "rgba(255,255,255,0.02)",
                  border: selectedId === intent.id ? `1px solid ${LEVEL_COLORS[intent.level]}30` : "1px solid rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[intent.status] || "#6b7280" }} />
                <span style={{ fontSize: 12, flex: 1, color: "var(--pn-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {intent.title}
                </span>
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 6, background: `${STATUS_COLORS[intent.status]}15`, color: STATUS_COLORS[intent.status] }}>
                  {intent.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Detail Panel ---

function DetailPanel({ intent, allIntents, runtime, levelName, onClose }: {
  intent: Intent;
  allIntents: readonly Intent[];
  runtime: Record<string, unknown> | null;
  levelName: (l: number) => string;
  onClose: () => void;
}) {
  const color = LEVEL_COLORS[intent.level] || "#6b7280";
  const parent = intent.parent_id ? allIntents.find((i) => i.id === intent.parent_id) : null;
  const children = allIntents.filter((i) => i.parent_id === intent.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color }}>
          L{intent.level} — {levelName(intent.level)}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--pn-text-muted)", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pn-text-primary)" }}>{intent.title}</div>

      {intent.description && (
        <div style={{ fontSize: 12, color: "var(--pn-text-secondary)", lineHeight: 1.5 }}>{intent.description}</div>
      )}

      {intent.completion_pct != null && intent.completion_pct > 0 && (
        <div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999 }}>
            <div style={{ width: `${intent.completion_pct}%`, height: "100%", background: color, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 10, color }}>{intent.completion_pct}%</span>
        </div>
      )}

      {/* Metadata */}
      <div style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
        <MetaRow label="Status" value={intent.status} color={STATUS_COLORS[intent.status]} />
        <MetaRow label="Kind" value={intent.kind} />
        <MetaRow label="Priority" value={`P${intent.priority}`} />
        {intent.phase != null && <MetaRow label="Phase" value={String(intent.phase)} />}
        <MetaRow label="Slug" value={intent.slug} mono />
      </div>

      {/* Hierarchy */}
      {(parent || children.length > 0) && (
        <div style={{ fontSize: 11 }}>
          <div style={{ fontWeight: 600, color: "var(--pn-text-secondary)", marginBottom: 4 }}>Hierarchy</div>
          {parent && (
            <div style={{ color: "var(--pn-text-muted)", marginBottom: 4 }}>
              Parent: <span style={{ color: LEVEL_COLORS[parent.level] }}>L{parent.level}</span> {parent.title}
            </div>
          )}
          {children.length > 0 && (
            <div>
              <span style={{ color: "var(--pn-text-muted)" }}>Children ({children.length})</span>
              {children.slice(0, 8).map((c) => (
                <div key={c.id} style={{ marginTop: 2, color: "var(--pn-text-muted)", paddingLeft: 8 }}>
                  <span style={{ color: LEVEL_COLORS[c.level] }}>L{c.level}</span> {c.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Runtime */}
      {runtime && Object.keys(runtime).length > 0 && (
        <div style={{ fontSize: 11 }}>
          <div style={{ fontWeight: 600, color: "var(--pn-text-secondary)", marginBottom: 4 }}>Runtime</div>
          <pre style={{
            fontSize: 10, whiteSpace: "pre-wrap", margin: 0,
            fontFamily: "JetBrains Mono, monospace",
            background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 6,
          }}>
            {JSON.stringify(runtime, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ color: "var(--pn-text-muted)", width: 60, flexShrink: 0 }}>{label}</span>
      <span style={{ color: color || "var(--pn-text-secondary)", fontFamily: mono ? "monospace" : undefined }}>
        {value}
      </span>
    </div>
  );
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 11, padding: "3px 10px", borderRadius: 10, cursor: "pointer",
  background: active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
  color: active ? "#818cf8" : "var(--pn-text-muted)",
  border: "none",
});

const inputStyle: React.CSSProperties = {
  fontSize: 12, padding: "6px 10px", borderRadius: 6,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  color: "var(--pn-text-primary)", outline: "none", flex: 1,
};
