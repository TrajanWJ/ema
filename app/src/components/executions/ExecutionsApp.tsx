import { useEffect, useState, useRef } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { GlassInput } from "@/components/ui/GlassInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { useExecutionStore } from "@/stores/execution-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Execution, ExecutionStatus, ExecutionMode, ExecutionEvent } from "@/types/executions";
import { api } from "@/lib/api";

const config = APP_CONFIGS["executions"];

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
  research: "\uD83D\uDD0D",
  outline: "\uD83D\uDCD0",
  implement: "\u2699\uFE0F",
  review: "\uD83D\uDC41",
  harvest: "\uD83C\uDF3E",
  refactor: "\u267B\uFE0F",
};

const ALL_MODES: ExecutionMode[] = [
  "research", "outline", "implement", "review", "harvest", "refactor",
];

const FILTER_STATUSES: ExecutionStatus[] = [
  "running", "awaiting_approval", "completed", "failed",
];

function formatAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ExecutionsApp() {
  const {
    connect, loadViaRest, connected, loading, error,
    filteredExecutions, approve, cancel,
    statusFilter, setStatusFilter,
    create,
  } = useExecutionStore();

  const [ready, setReady] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState<ExecutionMode>("research");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<readonly ExecutionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await connect();
      } catch {
        await loadViaRest().catch(() => {});
      }
      setReady(true);
    }
    init();
  }, []);

  const executions = filteredExecutions();
  const active = executions.filter((e) => !["completed", "failed", "cancelled"].includes(e.status));
  const done = executions.filter((e) => ["completed", "failed", "cancelled"].includes(e.status));
  const selected = executions.find((e) => e.id === selectedId) ?? null;

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

  async function handleSelectExecution(id: string) {
    setSelectedId(id);
    setLoadingEvents(true);
    try {
      const res = await api.get<{ events: ExecutionEvent[] }>(`/executions/${id}/events`);
      setEvents(res.events);
    } catch {
      setEvents([]);
    }
    setLoadingEvents(false);
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="executions" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="executions" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: connected ? "#22C55E" : "var(--pn-text-muted)" }}>
            {connected ? "\u25CF live" : "\u25CB polling"}
          </span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--pn-text-muted)" }}>
            {executions.length} executions
          </span>
          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setShowCreate(!showCreate)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: "rgba(99,102,241,0.15)",
                color: "#818cf8",
                border: "1px solid rgba(99,102,241,0.25)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              + New
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(14, 16, 23, 0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <GlassInput
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Execution title..."
              className="flex-1"
              uiSize="sm"
            />
            <NativeSelect
              value={newMode}
              onChange={(e) => setNewMode(e.target.value as ExecutionMode)}
              uiSize="sm"
              wrapperClassName="min-w-[10rem]"
            >
              {ALL_MODES.map((m) => (
                <option key={m} value={m}>{MODE_ICONS[m]} {m}</option>
              ))}
            </NativeSelect>
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: "#6366f1",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                opacity: creating || !newTitle.trim() ? 0.5 : 1,
              }}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        )}

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setStatusFilter(null)}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 10,
              background: !statusFilter ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
              color: !statusFilter ? "#818cf8" : "var(--pn-text-muted)",
              border: "none",
              cursor: "pointer",
            }}
          >
            All
          </button>
          {FILTER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 10,
                background: statusFilter === s ? `${STATUS_COLORS[s]}30` : "rgba(255,255,255,0.04)",
                color: statusFilter === s ? STATUS_COLORS[s] : "var(--pn-text-muted)",
                border: statusFilter === s ? `1px solid ${STATUS_COLORS[s]}44` : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Main content: list + detail */}
        <div style={{ display: "flex", flex: 1, gap: 12, minHeight: 0 }}>
          {/* Execution list */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {loading && (
              <div style={{ color: "var(--pn-text-muted)", textAlign: "center", paddingTop: 40, fontSize: 12 }}>Loading...</div>
            )}
            {error && (
              <div style={{ color: "#ef4444", fontSize: 12, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)" }}>
                {error}
              </div>
            )}

            {active.length > 0 && (
              <>
                <SectionLabel label="Active" count={active.length} />
                {active.map((e) => (
                  <ExecutionCard
                    key={e.id}
                    execution={e}
                    selected={selectedId === e.id}
                    onSelect={() => handleSelectExecution(e.id)}
                    onApprove={approve}
                    onCancel={cancel}
                  />
                ))}
              </>
            )}

            {done.length > 0 && (
              <>
                <SectionLabel label="Completed" count={done.length} />
                {done.map((e) => (
                  <ExecutionCard
                    key={e.id}
                    execution={e}
                    selected={selectedId === e.id}
                    onSelect={() => handleSelectExecution(e.id)}
                    onApprove={approve}
                    onCancel={cancel}
                  />
                ))}
              </>
            )}

            {!loading && executions.length === 0 && (
              <div style={{ color: "var(--pn-text-muted)", textAlign: "center", paddingTop: 60, fontSize: 13 }}>
                No executions yet. Create one to start.
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div
              style={{
                width: 320,
                overflowY: "auto",
                borderRadius: 10,
                padding: 16,
                background: "rgba(14, 16, 23, 0.55)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ExecutionDetail
                execution={selected}
                events={events}
                loadingEvents={loadingEvents}
                onApprove={approve}
                onCancel={cancel}
              />
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function SectionLabel({ label, count }: { readonly label: string; readonly count: number }) {
  return (
    <div style={{
      fontSize: 11,
      color: "var(--pn-text-muted)",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      marginBottom: 2,
      marginTop: 4,
    }}>
      {label} \u00B7 {count}
    </div>
  );
}

function ExecutionCard({ execution, selected, onSelect, onApprove, onCancel }: {
  readonly execution: Execution;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onApprove: (id: string) => void;
  readonly onCancel: (id: string) => void;
}) {
  const color = STATUS_COLORS[execution.status] || "#6b7280";
  const icon = MODE_ICONS[execution.mode] || "\u26A1";

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        background: selected ? `${color}12` : "rgba(255,255,255,0.03)",
        border: selected ? `1px solid ${color}30` : "1px solid rgba(255,255,255,0.05)",
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        cursor: "pointer",
        transition: "background 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--pn-text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {execution.title}
        </span>
        <span style={{
          fontSize: 10,
          padding: "2px 8px",
          borderRadius: 10,
          background: `${color}20`,
          color,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}>
          {execution.status.replace("_", " ")}
        </span>
      </div>

      {execution.objective && (
        <p style={{ fontSize: 11, color: "var(--pn-text-tertiary)", margin: 0, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {execution.objective}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        {execution.intent_slug && (
          <span style={{ fontSize: 10, color: "var(--pn-text-muted)", fontFamily: "monospace" }}>
            {execution.intent_slug}
          </span>
        )}
        <span style={{ fontSize: 10, color: "var(--pn-text-muted)", marginLeft: "auto" }}>
          {formatAge(execution.inserted_at)}
        </span>

        {execution.status === "awaiting_approval" && (
          <button
            onClick={(ev) => { ev.stopPropagation(); onApprove(execution.id); }}
            style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 6,
              background: "#3b82f6", color: "#fff", border: "none",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            Approve
          </button>
        )}
        {["created", "proposed", "awaiting_approval", "approved", "delegated"].includes(execution.status) && (
          <button
            onClick={(ev) => { ev.stopPropagation(); onCancel(execution.id); }}
            style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 6,
              background: "rgba(239,68,68,0.15)", color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </button>
  );
}


function ExecutionLog({ executionId, isRunning }: { readonly executionId: string; readonly isRunning: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const { subscribeToStream } = useExecutionStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRunning) return;
    setLines([]);
    const unsubscribe = subscribeToStream(executionId, (chunk) => {
      const newLines = chunk.split("\n").filter((l) => l.trim().length > 0);
      setLines((prev) => [...prev, ...newLines].slice(-500));
    });
    return unsubscribe;
  }, [executionId, isRunning, subscribeToStream]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!isRunning) {
    return (
      <div style={{ fontSize: 11, color: "var(--pn-text-muted)", fontStyle: "italic", padding: "8px 0" }}>
        Live stream not available — execution not running
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        background: "rgba(0,0,0,0.5)",
        color: "#4ade80",
        padding: "10px 12px",
        borderRadius: 8,
        height: 200,
        overflowY: "auto",
        border: "1px solid rgba(74,222,128,0.15)",
      }}
    >
      {lines.length === 0 ? (
        <span style={{ color: "rgba(74,222,128,0.5)" }}>Waiting for output...</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function ExecutionDetail({ execution, events, loadingEvents, onApprove, onCancel }: {
  readonly execution: Execution;
  readonly events: readonly ExecutionEvent[];
  readonly loadingEvents: boolean;
  readonly onApprove: (id: string) => void;
  readonly onCancel: (id: string) => void;
}) {
  const color = STATUS_COLORS[execution.status] || "#6b7280";
  const icon = MODE_ICONS[execution.mode] || "\u26A1";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pn-text-primary)" }}>
        {icon} {execution.title}
      </div>

      {/* Status + mode badges */}
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{
          fontSize: 10, padding: "3px 8px", borderRadius: 6,
          background: `${color}20`, color, fontWeight: 600,
          textTransform: "uppercase",
        }}>
          {execution.status.replace("_", " ")}
        </span>
        <span style={{
          fontSize: 10, padding: "3px 8px", borderRadius: 6,
          background: "rgba(255,255,255,0.06)", color: "var(--pn-text-secondary)",
          textTransform: "uppercase",
        }}>
          {execution.mode}
        </span>
      </div>

      {/* Objective */}
      {execution.objective && (
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--pn-text-secondary)" }}>
          {execution.objective}
        </div>
      )}

      {/* Metadata */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
        {execution.project_slug && (
          <div>
            <span style={{ color: "var(--pn-text-muted)" }}>Project: </span>
            <span style={{ color: "var(--pn-text-secondary)", fontFamily: "monospace" }}>{execution.project_slug}</span>
          </div>
        )}
        {execution.intent_slug && (
          <div>
            <span style={{ color: "var(--pn-text-muted)" }}>Intent: </span>
            <span style={{ color: "var(--pn-text-secondary)", fontFamily: "monospace" }}>{execution.intent_slug}</span>
          </div>
        )}
        <div>
          <span style={{ color: "var(--pn-text-muted)" }}>Created: </span>
          <span style={{ color: "var(--pn-text-secondary)" }}>{formatAge(execution.inserted_at)}</span>
        </div>
        {execution.completed_at && (
          <div>
            <span style={{ color: "var(--pn-text-muted)" }}>Completed: </span>
            <span style={{ color: "var(--pn-text-secondary)" }}>{formatAge(execution.completed_at)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        {execution.status === "awaiting_approval" && (
          <button
            onClick={() => onApprove(execution.id)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 6,
              background: "rgba(59,130,246,0.2)", color: "#3b82f6",
              border: "1px solid rgba(59,130,246,0.3)", cursor: "pointer",
              fontSize: 12, fontWeight: 600,
            }}
          >
            Approve
          </button>
        )}
        {["created", "proposed", "awaiting_approval", "approved", "delegated"].includes(execution.status) && (
          <button
            onClick={() => onCancel(execution.id)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 6,
              background: "rgba(239,68,68,0.12)", color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer",
              fontSize: 12, fontWeight: 600,
            }}
          >
            Cancel
          </button>
        )}
      </div>


      {/* Live Output Stream */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--pn-text-secondary)", marginBottom: 8 }}>
          Live Output
        </div>
        <ExecutionLog
          executionId={execution.id}
          isRunning={execution.status === "running"}
        />
      </div>

      {/* Events timeline */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--pn-text-secondary)", marginBottom: 8 }}>
          Events
        </div>
        {loadingEvents ? (
          <div style={{ fontSize: 11, color: "var(--pn-text-muted)", textAlign: "center", padding: 16 }}>
            Loading events...
          </div>
        ) : events.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--pn-text-muted)", textAlign: "center", padding: 16 }}>
            No events recorded
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#818cf8", marginTop: 4, flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--pn-text-secondary)" }}>
                    {ev.type.replace(/_/g, " ")}
                  </div>
                  {ev.actor_kind && (
                    <span style={{ fontSize: 10, color: "var(--pn-text-muted)", fontFamily: "monospace" }}>
                      {ev.actor_kind}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, color: "var(--pn-text-muted)", flexShrink: 0 }}>
                  {formatAge(ev.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
