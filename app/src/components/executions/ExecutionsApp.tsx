import { useEffect, useState } from "react";
import { useExecutionStore } from "@/stores/execution-store";
import type { Execution, ExecutionStatus, ExecutionMode } from "@/types/executions";

const STATUS_COLORS: Record<ExecutionStatus, string> = {
  created: "#6b7280",
  proposed: "#8b5cf6",
  awaiting_approval: "#f59e0b",
  approved: "#3b82f6",
  delegated: "#06b6d4",
  running: "#10b981",
  harvesting: "#6366f1",
  completed: "#22c55e",
  failed: "#ef4444",
  cancelled: "#374151",
};

const MODE_ICONS: Record<ExecutionMode, string> = {
  research: "🔍",
  outline: "📐",
  implement: "⚙️",
  review: "👁",
  harvest: "🌾",
  refactor: "♻️",
};

const ALL_STATUSES: ExecutionStatus[] = [
  "created", "proposed", "awaiting_approval", "approved",
  "delegated", "running", "harvesting", "completed", "failed", "cancelled",
];

const ALL_MODES: ExecutionMode[] = [
  "research", "outline", "implement", "review", "harvest", "refactor",
];

function ExecutionCard({ execution, onApprove, onCancel }: {
  execution: Execution;
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const color = STATUS_COLORS[execution.status] || "#6b7280";
  const icon = MODE_ICONS[execution.mode] || "⚡";
  const ts = new Date(execution.inserted_at);
  const age = Math.floor((Date.now() - ts.getTime()) / 60000);
  const ageStr = age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`;

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${color}33`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#f1f5f9", flex: 1 }}>
          {execution.title}
        </span>
        <span style={{
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 10,
          background: `${color}22`,
          color,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}>
          {execution.status}
        </span>
      </div>

      {execution.objective && (
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
          {execution.objective.length > 120
            ? execution.objective.slice(0, 120) + "…"
            : execution.objective}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        {execution.intent_slug && (
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
            📁 {execution.intent_slug}
          </span>
        )}
        <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>{ageStr}</span>

        {execution.status === "awaiting_approval" && (
          <button
            onClick={() => onApprove(execution.id)}
            style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 6,
              background: "#3b82f6", color: "#fff", border: "none",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            Approve
          </button>
        )}
        {["created", "proposed", "awaiting_approval", "approved", "delegated"].includes(execution.status) && (
          <button
            onClick={() => onCancel(execution.id)}
            style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 6,
              background: "rgba(239,68,68,0.15)", color: "#ef4444",
              border: "1px solid #ef444433", cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function ExecutionsApp() {
  const {
    connect, loadViaRest, connected, loading, error,
    filteredExecutions, approve, cancel,
    statusFilter, modeFilter, setStatusFilter, setModeFilter,
    create,
  } = useExecutionStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState<ExecutionMode>("research");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    connect().catch(() => loadViaRest());
  }, []);

  const executions = filteredExecutions();
  const active = executions.filter((e) => !["completed", "failed", "cancelled"].includes(e.status));
  const done = executions.filter((e) => ["completed", "failed", "cancelled"].includes(e.status));

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await create({ title: newTitle.trim(), mode: newMode, requires_approval: false });
      setNewTitle("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{
      height: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #0a0a0f 100%)",
      color: "#f1f5f9",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>⚡</span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
            HQ — Executions
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            {connected ? "● live" : "○ polling"} · {executions.length} executions
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: "8px 16px", borderRadius: 8,
            background: "rgba(99,102,241,0.2)", color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.3)",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >
          + New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Execution title…"
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 6,
              background: "rgba(255,255,255,0.06)", color: "#f1f5f9",
              border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, outline: "none",
            }}
          />
          <select
            value={newMode}
            onChange={(e) => setNewMode(e.target.value as ExecutionMode)}
            style={{
              padding: "8px 12px", borderRadius: 6,
              background: "rgba(255,255,255,0.06)", color: "#f1f5f9",
              border: "1px solid rgba(255,255,255,0.12)", fontSize: 13,
            }}
          >
            {ALL_MODES.map((m) => (
              <option key={m} value={m}>{MODE_ICONS[m]} {m}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
            style={{
              padding: "8px 16px", borderRadius: 6,
              background: "#6366f1", color: "#fff",
              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              opacity: creating || !newTitle.trim() ? 0.5 : 1,
            }}
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{
        padding: "10px 24px",
        display: "flex",
        gap: 8,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        flexWrap: "wrap",
      }}>
        <button
          onClick={() => setStatusFilter(null)}
          style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 10,
            background: !statusFilter ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)",
            color: !statusFilter ? "#818cf8" : "#64748b",
            border: "none", cursor: "pointer",
          }}
        >
          All
        </button>
        {["running", "awaiting_approval", "completed", "failed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 10,
              background: statusFilter === s ? `${STATUS_COLORS[s as ExecutionStatus]}33` : "rgba(255,255,255,0.04)",
              color: statusFilter === s ? STATUS_COLORS[s as ExecutionStatus] : "#64748b",
              border: `1px solid ${statusFilter === s ? STATUS_COLORS[s as ExecutionStatus] + "44" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && (
          <div style={{ color: "#64748b", textAlign: "center", paddingTop: 40 }}>Loading…</div>
        )}
        {error && (
          <div style={{ color: "#ef4444", fontSize: 13, padding: 12 }}>Error: {error}</div>
        )}

        {active.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>
              Active · {active.length}
            </div>
            {active.map((e) => (
              <ExecutionCard key={e.id} execution={e} onApprove={approve} onCancel={cancel} />
            ))}
          </>
        )}

        {done.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: "#374151", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", margin: "12px 0 4px" }}>
              Completed · {done.length}
            </div>
            {done.map((e) => (
              <ExecutionCard key={e.id} execution={e} onApprove={approve} onCancel={cancel} />
            ))}
          </>
        )}

        {!loading && executions.length === 0 && (
          <div style={{ color: "#374151", textAlign: "center", paddingTop: 60, fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            No executions yet. Create one to start the loop.
          </div>
        )}
      </div>
    </div>
  );
}
