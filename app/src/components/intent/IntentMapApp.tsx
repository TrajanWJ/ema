import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useIntentMapStore, type IntentNode } from "@/stores/intent-map-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Execution, ExecutionEvent } from "@/types/executions";

const config = APP_CONFIGS["intent-map"];

const STATUS_COLORS: Record<string, string> = {
  completed: "#22C55E",
  in_progress: "#6b95f0",
  researched: "#eab308",
  outlined: "#f59e0b",
  blocked: "#ef4444",
  idle: "#6b7280",
};

const EXEC_STATUS_COLORS: Record<string, string> = {
  completed: "#22C55E",
  running: "#6b95f0",
  approved: "#5eead4",
  created: "#a78bfa",
  failed: "#ef4444",
  cancelled: "#6b7280",
  awaiting_approval: "#eab308",
  proposed: "#eab308",
  delegated: "#8b5cf6",
  harvesting: "#f59e0b",
};

const MODE_COLORS: Record<string, string> = {
  research: "#a78bfa",
  outline: "#6b95f0",
  implement: "#22C55E",
  review: "#5eead4",
  harvest: "#f59e0b",
  refactor: "#f43f5e",
};

function toTitleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function IntentMapApp() {
  const [ready, setReady] = useState(false);
  const intents = useIntentMapStore((s) => s.intents);
  const loading = useIntentMapStore((s) => s.loading);
  const expandedSlug = useIntentMapStore((s) => s.expandedSlug);
  const expandedExecutionId = useIntentMapStore((s) => s.expandedExecutionId);
  const events = useIntentMapStore((s) => s.events);
  const fetchIntents = useIntentMapStore((s) => s.fetchIntents);
  const toggleExpanded = useIntentMapStore((s) => s.toggleExpanded);
  const toggleExecutionEvents = useIntentMapStore((s) => s.toggleExecutionEvents);

  useEffect(() => {
    async function init() {
      await fetchIntents().catch(() => {});
      setReady(true);
    }
    init();
  }, [fetchIntents]);

  if (!ready) {
    return (
      <AppWindowChrome appId="intent-map" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="intent-map" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
              Intent Map
            </span>
            <span className="text-[0.65rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
              {intents.length} intents
            </span>
          </div>
          <button
            onClick={() => fetchIntents()}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-[0.65rem] font-mono transition-all hover:brightness-110"
            style={{ background: "rgba(107,149,240,0.15)", color: "#6b95f0", border: "1px solid rgba(107,149,240,0.2)" }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Status legend */}
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(STATUS_COLORS).map(([status, color]) => {
            const count = intents.filter((i) => i.status === status).length;
            if (count === 0) return null;
            return (
              <span
                key={status}
                className="flex items-center gap-1 text-[0.55rem] font-mono uppercase"
                style={{ color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {status.replace("_", " ")} ({count})
              </span>
            );
          })}
        </div>

        {/* Intent list */}
        <div className="flex-1 overflow-auto space-y-1.5">
          {intents.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
                No intents with executions found.
              </span>
            </div>
          ) : (
            intents.map((intent) => (
              <IntentCard
                key={intent.intent_slug}
                intent={intent}
                expanded={expandedSlug === intent.intent_slug}
                expandedExecutionId={expandedExecutionId}
                events={events}
                onToggle={() => toggleExpanded(intent.intent_slug)}
                onToggleExecution={toggleExecutionEvents}
              />
            ))
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function IntentCard({
  intent,
  expanded,
  expandedExecutionId,
  events,
  onToggle,
  onToggleExecution,
}: {
  readonly intent: IntentNode;
  readonly expanded: boolean;
  readonly expandedExecutionId: string | null;
  readonly events: Record<string, readonly ExecutionEvent[]>;
  readonly onToggle: () => void;
  readonly onToggleExecution: (id: string) => void;
}) {
  const statusColor = STATUS_COLORS[intent.status] ?? "#6b7280";
  const pct = Math.round(intent.completion_pct);

  return (
    <div
      className="rounded-lg transition-all"
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${expanded ? `${statusColor}30` : "rgba(255,255,255,0.05)"}` }}
    >
      {/* Intent header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[rgba(255,255,255,0.02)] rounded-lg transition-all"
      >
        <span className="text-[0.5rem]" style={{ color: "var(--pn-text-muted)" }}>
          {expanded ? "\u25BC" : "\u25B6"}
        </span>

        {/* Status badge */}
        <span
          className="text-[0.55rem] font-mono uppercase px-1.5 py-0.5 rounded shrink-0"
          style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}25` }}
        >
          {intent.status.replace("_", " ")}
        </span>

        {/* Title */}
        <span className="text-[0.75rem] font-medium flex-1 truncate" style={{ color: "rgba(255,255,255,0.87)" }}>
          {toTitleCase(intent.intent_slug)}
        </span>

        {/* Completion bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: statusColor }}
            />
          </div>
          <span className="text-[0.55rem] font-mono w-8 text-right" style={{ color: statusColor }}>
            {pct}%
          </span>
        </div>

        {/* Mode badges */}
        <div className="flex items-center gap-1 shrink-0">
          {Object.entries(intent.modes_executed).map(([mode, modeStatus]) => (
            <span
              key={mode}
              className="text-[0.5rem] font-mono px-1 py-0.5 rounded"
              style={{
                background: `${MODE_COLORS[mode] ?? "#6b7280"}10`,
                color: MODE_COLORS[mode] ?? "#6b7280",
              }}
            >
              {mode.slice(0, 3)} {modeStatus === "completed" ? "\u2713" : "\u2717"}
            </span>
          ))}
        </div>
      </button>

      {/* Expanded: execution timeline */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="text-[0.6rem] font-mono uppercase pt-2 pb-1" style={{ color: "var(--pn-text-muted)" }}>
            Executions ({intent.executions.length})
          </div>
          {intent.executions.map((exec) => (
            <ExecutionRow
              key={exec.id}
              execution={exec}
              expanded={expandedExecutionId === exec.id}
              events={events[exec.id]}
              onToggle={() => onToggleExecution(exec.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExecutionRow({
  execution,
  expanded,
  events,
  onToggle,
}: {
  readonly execution: Execution;
  readonly expanded: boolean;
  readonly events: readonly ExecutionEvent[] | undefined;
  readonly onToggle: () => void;
}) {
  const modeColor = MODE_COLORS[execution.mode] ?? "#6b7280";
  const statusColor = EXEC_STATUS_COLORS[execution.status] ?? "#6b7280";

  return (
    <div className="rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
      <button
        onClick={onToggle}
        className="w-full text-left px-2.5 py-2 flex items-center gap-2 hover:bg-[rgba(255,255,255,0.02)] rounded transition-all"
      >
        <span
          className="text-[0.5rem] font-mono uppercase px-1.5 py-0.5 rounded shrink-0"
          style={{ background: `${modeColor}15`, color: modeColor }}
        >
          {execution.mode}
        </span>
        <span
          className="text-[0.5rem] font-mono uppercase px-1.5 py-0.5 rounded shrink-0"
          style={{ background: `${statusColor}15`, color: statusColor }}
        >
          {execution.status.replace("_", " ")}
        </span>
        <span className="text-[0.65rem] truncate flex-1" style={{ color: "var(--pn-text-secondary)" }}>
          {execution.title}
        </span>
        <span className="text-[0.55rem] font-mono shrink-0" style={{ color: "var(--pn-text-muted)" }}>
          {relativeTime(execution.inserted_at)}
        </span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
          {execution.result_path && (
            <div className="flex items-center gap-2 pt-1.5">
              <span className="text-[0.55rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
                Result: {execution.result_path}
              </span>
            </div>
          )}
          {events === undefined ? (
            <div className="text-[0.6rem] py-1" style={{ color: "var(--pn-text-muted)" }}>Loading events...</div>
          ) : events.length === 0 ? (
            <div className="text-[0.6rem] py-1" style={{ color: "var(--pn-text-muted)" }}>No events recorded.</div>
          ) : (
            <div className="space-y-0.5 pt-1">
              {events.map((evt) => (
                <div key={evt.id} className="flex items-center gap-2 text-[0.55rem] font-mono">
                  <span style={{ color: "var(--pn-text-muted)" }}>
                    {new Date(evt.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span
                    className="px-1 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.04)", color: "var(--pn-text-secondary)" }}
                  >
                    {evt.type}
                  </span>
                  {evt.actor_kind && (
                    <span style={{ color: "var(--pn-text-tertiary)" }}>{evt.actor_kind}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
