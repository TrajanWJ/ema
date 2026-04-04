import { useEffect, useState, useCallback } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useExecutionStore } from "@/stores/execution-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Execution, ExecutionStatus, ExecutionMode } from "@/types/executions";
import { api } from "@/lib/api";

const config = APP_CONFIGS["dispatch-board"];

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

const STATUS_BG: Record<ExecutionStatus, string> = {
  created: "rgba(107,114,128,0.12)",
  proposed: "rgba(139,92,246,0.12)",
  awaiting_approval: "rgba(245,158,11,0.12)",
  approved: "rgba(59,130,246,0.12)",
  delegated: "rgba(6,182,212,0.12)",
  running: "rgba(16,185,129,0.12)",
  harvesting: "rgba(99,102,241,0.12)",
  completed: "rgba(34,197,94,0.10)",
  failed: "rgba(239,68,68,0.10)",
  cancelled: "rgba(55,65,81,0.12)",
};

const MODE_ICONS: Record<ExecutionMode, string> = {
  research: "🔍",
  outline: "📐",
  implement: "⚙️",
  review: "👁",
  harvest: "🌾",
  refactor: "♻️",
};

const ACTIVE_STATUSES: readonly ExecutionStatus[] = [
  "running", "delegated", "harvesting", "approved",
];
const QUEUED_STATUSES: readonly ExecutionStatus[] = [
  "created", "proposed", "awaiting_approval",
];

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface BoardStats {
  total: number;
  today: number;
  running: number;
  queued: number;
  completed_today: number;
  failed_today: number;
  avg_duration_seconds: number | null;
  last_updated_at: string;
}

export function DispatchBoardApp() {
  const { connect, loadViaRest, connected, executions } = useExecutionStore();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Tick every second to update elapsed timers
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await api.get<BoardStats>("/dispatch-board/stats");
      setStats(statsData);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await connect();
      } catch {
        await loadViaRest().catch(() => {});
      }
      await loadStats();
      setReady(true);
    }
    init();
  }, []);

  // Refresh stats every 10s
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [ready, loadStats]);

  // Derive sections from WS-synced execution store
  const activeExecs = executions.filter((e) =>
    (ACTIVE_STATUSES as readonly string[]).includes(e.status)
  );
  const queuedExecs = executions.filter((e) =>
    (QUEUED_STATUSES as readonly string[]).includes(e.status)
  );
  const completedExecs = executions
    .filter((e) => ["completed", "failed", "cancelled"].includes(e.status))
    .slice(0, 20);

  const selected = executions.find((e) => e.id === selectedId) ?? null;

  if (!ready) {
    return (
      <AppWindowChrome appId="dispatch-board" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading dispatch board...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="dispatch-board" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
        {/* Header: live indicator + stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: connected ? "#22C55E" : "#6b7280",
              display: "inline-block",
              boxShadow: connected ? "0 0 6px #22C55E" : "none",
            }} />
            <span style={{ color: connected ? "#22C55E" : "var(--pn-text-muted)" }}>
              {connected ? "live" : "polling"}
            </span>
          </span>
          {stats && (
            <>
              <StatPill label="running" value={stats.running} color="#10b981" />
              <StatPill label="queued" value={stats.queued} color="#f59e0b" />
              <StatPill label="done today" value={stats.completed_today} color="#22c55e" />
              {stats.failed_today > 0 && (
                <StatPill label="failed" value={stats.failed_today} color="#ef4444" />
              )}
              {stats.avg_duration_seconds != null && (
                <span style={{ fontSize: 11, color: "var(--pn-text-muted)", marginLeft: "auto" }}>
                  avg {formatElapsed(stats.avg_duration_seconds)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Main area: board + detail panel */}
        <div style={{ display: "flex", flex: 1, gap: 12, minHeight: 0 }}>
          {/* Execution grid */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
            {activeExecs.length > 0 && (
              <BoardSection label="⚡ Active" count={activeExecs.length} color="#10b981">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                  {activeExecs.map((e) => (
                    <ExecutionCard
                      key={e.id}
                      execution={e}
                      selected={selectedId === e.id}
                      onSelect={() => setSelectedId(selectedId === e.id ? null : e.id)}
                      nowMs={now}
                    />
                  ))}
                </div>
              </BoardSection>
            )}

            {queuedExecs.length > 0 && (
              <BoardSection label="⏳ Queued" count={queuedExecs.length} color="#f59e0b">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                  {queuedExecs.map((e) => (
                    <ExecutionCard
                      key={e.id}
                      execution={e}
                      selected={selectedId === e.id}
                      onSelect={() => setSelectedId(selectedId === e.id ? null : e.id)}
                      nowMs={now}
                    />
                  ))}
                </div>
              </BoardSection>
            )}

            {completedExecs.length > 0 && (
              <BoardSection label="✓ Recent" count={completedExecs.length} color="#6b7280">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                  {completedExecs.map((e) => (
                    <ExecutionCard
                      key={e.id}
                      execution={e}
                      selected={selectedId === e.id}
                      onSelect={() => setSelectedId(selectedId === e.id ? null : e.id)}
                      nowMs={now}
                    />
                  ))}
                </div>
              </BoardSection>
            )}

            {activeExecs.length === 0 && queuedExecs.length === 0 && completedExecs.length === 0 && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 12, padding: 48, color: "var(--pn-text-muted)",
              }}>
                <span style={{ fontSize: 40 }}>📡</span>
                <span style={{ fontSize: 13 }}>No active executions</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>
                  Dispatch board is live — agents will appear here when running
                </span>
              </div>
            )}
          </div>

          {/* Detail side panel */}
          {selected && (
            <DetailPanel
              execution={selected}
              nowMs={now}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatPill({ label, value, color }: {
  readonly label: string;
  readonly value: number;
  readonly color: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 10,
      background: `${color}18`, border: `1px solid ${color}30`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--pn-text-muted)" }}>{label}</span>
    </div>
  );
}

function BoardSection({ label, count, color, children }: {
  readonly label: string;
  readonly count: number;
  readonly color: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 10, paddingBottom: 6,
        borderBottom: `1px solid ${color}25`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color, letterSpacing: "0.3px" }}>{label}</span>
        <span style={{
          fontSize: 10, padding: "1px 7px", borderRadius: 8,
          background: `${color}18`, color,
        }}>
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function ExecutionCard({ execution, selected, onSelect, nowMs }: {
  readonly execution: Execution;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly nowMs: number;
}) {
  const color = STATUS_COLORS[execution.status] || "#6b7280";
  const bg = STATUS_BG[execution.status] || "rgba(255,255,255,0.04)";
  const icon = MODE_ICONS[execution.mode] || "⚡";
  const isActive = (ACTIVE_STATUSES as readonly string[]).includes(execution.status);

  const elapsedSeconds = execution.completed_at
    ? Math.floor((new Date(execution.completed_at).getTime() - new Date(execution.inserted_at).getTime()) / 1000)
    : Math.floor((nowMs - new Date(execution.inserted_at).getTime()) / 1000);

  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: "left",
        background: selected ? bg : "rgba(255,255,255,0.025)",
        border: selected ? `1px solid ${color}40` : "1px solid rgba(255,255,255,0.06)",
        borderTop: `2px solid ${color}`,
        borderRadius: 8,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
        <span style={{
          flex: 1, fontWeight: 600, fontSize: 12,
          color: "var(--pn-text-primary)", lineHeight: 1.4,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {execution.title}
        </span>
      </div>

      {/* Status + elapsed */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 7,
          background: `${color}22`, color, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.4px",
        }}>
          {execution.status.replace(/_/g, " ")}
        </span>
        {isActive && (
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: color, flexShrink: 0,
            boxShadow: `0 0 5px ${color}`,
          }} />
        )}
        <span style={{
          fontSize: 10, fontFamily: "monospace",
          color: "var(--pn-text-muted)", marginLeft: "auto",
        }}>
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>

      {/* Tags */}
      {(execution.project_slug || execution.intent_slug) && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {execution.project_slug && (
            <span style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 4,
              background: "rgba(255,255,255,0.06)",
              color: "var(--pn-text-muted)", fontFamily: "monospace",
            }}>
              {execution.project_slug}
            </span>
          )}
          {execution.intent_slug && (
            <span style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 4,
              background: "rgba(255,255,255,0.04)",
              color: "var(--pn-text-muted)", fontFamily: "monospace",
            }}>
              {execution.intent_slug}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function DetailPanel({ execution, nowMs, onClose }: {
  readonly execution: Execution;
  readonly nowMs: number;
  readonly onClose: () => void;
}) {
  const color = STATUS_COLORS[execution.status] || "#6b7280";
  const icon = MODE_ICONS[execution.mode] || "⚡";
  const isActive = (ACTIVE_STATUSES as readonly string[]).includes(execution.status);

  const elapsedSeconds = execution.completed_at
    ? Math.floor((new Date(execution.completed_at).getTime() - new Date(execution.inserted_at).getTime()) / 1000)
    : Math.floor((nowMs - new Date(execution.inserted_at).getTime()) / 1000);

  return (
    <div style={{
      width: 296, flexShrink: 0, overflowY: "auto",
      borderRadius: 10, padding: 16,
      background: "rgba(14, 16, 23, 0.70)",
      backdropFilter: "blur(24px)",
      border: `1px solid ${color}30`,
      borderTop: `2px solid ${color}`,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--pn-text-primary)", lineHeight: 1.4 }}>
            {execution.title}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none",
            color: "var(--pn-text-muted)", cursor: "pointer",
            fontSize: 18, padding: "0 2px", lineHeight: 1, flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 11, padding: "3px 10px", borderRadius: 8,
          background: `${color}20`, color, fontWeight: 600, textTransform: "uppercase",
        }}>
          {execution.status.replace(/_/g, " ")}
        </span>
        {isActive && <span style={{ fontSize: 10, color, fontFamily: "monospace" }}>● live</span>}
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--pn-text-secondary)", marginLeft: "auto" }}>
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>

      {/* Objective */}
      {execution.objective && (
        <div style={{
          fontSize: 12, lineHeight: 1.6, color: "var(--pn-text-secondary)",
          padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)",
        }}>
          {execution.objective}
        </div>
      )}

      {/* Metadata */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
        {execution.project_slug && <MetaRow label="Project" value={execution.project_slug} mono />}
        {execution.intent_slug && <MetaRow label="Intent" value={execution.intent_slug} mono />}
        <MetaRow label="Mode" value={execution.mode} />
        <MetaRow label="Created" value={formatAge(execution.inserted_at)} />
        {execution.completed_at && <MetaRow label="Completed" value={formatAge(execution.completed_at)} />}
      </div>

      <div style={{
        fontSize: 10, color: "var(--pn-text-muted)", textAlign: "center",
        padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        Open Executions app for full detail &amp; controls
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono = false }: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ color: "var(--pn-text-muted)", width: 65, flexShrink: 0 }}>{label}</span>
      <span style={{
        color: "var(--pn-text-secondary)",
        fontFamily: mono ? "monospace" : undefined,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
      </span>
    </div>
  );
}
