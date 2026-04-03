import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useGapStore } from "@/stores/gap-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["gaps"];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

const SOURCE_LABELS: Record<string, string> = {
  superman: "Code Intel",
  todos: "TODOs",
  wiki: "Wiki Links",
  tasks: "Stale Tasks",
  goals: "Goals",
  docs: "Missing Docs",
  orphans: "Orphan Notes",
};

export function GapInboxApp() {
  const [ready, setReady] = useState(false);
  const gaps = useGapStore((s) => s.gaps);
  const counts = useGapStore((s) => s.counts);
  const loading = useGapStore((s) => s.loading);
  const filterSource = useGapStore((s) => s.filterSource);
  const filterSeverity = useGapStore((s) => s.filterSeverity);
  const setFilterSource = useGapStore((s) => s.setFilterSource);
  const setFilterSeverity = useGapStore((s) => s.setFilterSeverity);
  const resolveGap = useGapStore((s) => s.resolveGap);
  const createTaskFromGap = useGapStore((s) => s.createTaskFromGap);
  const scan = useGapStore((s) => s.scan);

  useEffect(() => {
    async function init() {
      await useGapStore.getState().loadViaRest().catch(() => {});
      setReady(true);
      useGapStore.getState().connect().catch(() => {});
    }
    init();
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="gaps" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const totalOpen = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <AppWindowChrome appId="gaps" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex flex-col gap-3 h-full">
        {/* Summary header */}
        <div className="flex items-center gap-3">
          {(["critical", "high", "medium", "low"] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
              style={{
                background: filterSeverity === sev ? `${SEVERITY_COLORS[sev]}20` : `${SEVERITY_COLORS[sev]}08`,
                border: filterSeverity === sev ? `1px solid ${SEVERITY_COLORS[sev]}40` : "1px solid transparent",
              }}
            >
              <span className="text-[0.8rem] font-bold font-mono" style={{ color: SEVERITY_COLORS[sev] }}>
                {counts[sev] ?? 0}
              </span>
              <span className="text-[0.6rem] font-mono uppercase" style={{ color: `${SEVERITY_COLORS[sev]}90` }}>
                {sev}
              </span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[0.65rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
              {totalOpen} open
            </span>
            <button
              onClick={scan}
              disabled={loading}
              className="px-3 py-1.5 rounded-md text-[0.65rem] font-mono transition-all hover:brightness-110"
              style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              {loading ? "Scanning..." : "Scan Now"}
            </button>
          </div>
        </div>

        {/* Source filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setFilterSource(null)}
            className="px-2 py-1 rounded text-[0.6rem] font-mono transition-all"
            style={{
              background: filterSource === null ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
              color: filterSource === null ? "rgba(255,255,255,0.87)" : "rgba(255,255,255,0.4)",
            }}
          >
            All
          </button>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterSource(filterSource === key ? null : key)}
              className="px-2 py-1 rounded text-[0.6rem] font-mono transition-all"
              style={{
                background: filterSource === key ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                color: filterSource === key ? "rgba(255,255,255,0.87)" : "rgba(255,255,255,0.4)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Gap list */}
        <div className="flex-1 overflow-auto space-y-1">
          {gaps.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
                No gaps found. Run a scan to detect issues.
              </span>
            </div>
          ) : (
            gaps.map((gap) => (
              <div
                key={gap.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-[rgba(255,255,255,0.03)]"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                {/* Severity indicator */}
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: SEVERITY_COLORS[gap.severity], boxShadow: `0 0 6px ${SEVERITY_COLORS[gap.severity]}40` }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <SourceBadge source={gap.source} />
                    <span className="text-[0.75rem] font-medium truncate" style={{ color: "rgba(255,255,255,0.87)" }}>
                      {gap.title}
                    </span>
                  </div>
                  {gap.description && (
                    <div className="text-[0.65rem] leading-relaxed mb-1" style={{ color: "var(--pn-text-tertiary)" }}>
                      {gap.description}
                    </div>
                  )}
                  {gap.file_path && (
                    <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                      {gap.file_path}{gap.line_number ? `:${gap.line_number}` : ""}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => createTaskFromGap(gap.id)}
                    className="px-2 py-1 rounded text-[0.6rem] font-mono transition-all hover:brightness-110"
                    style={{ background: "rgba(107,149,240,0.15)", color: "#6b95f0" }}
                    title="Create Task"
                  >
                    Task
                  </button>
                  <button
                    onClick={() => resolveGap(gap.id)}
                    className="px-2 py-1 rounded text-[0.6rem] font-mono transition-all hover:brightness-110"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
                    title="Resolve"
                  >
                    Done
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function SourceBadge({ source }: { readonly source: string }) {
  const colors: Record<string, string> = {
    superman: "#a78bfa",
    todos: "#f59e0b",
    wiki: "#5eead4",
    tasks: "#6b95f0",
    goals: "#f43f5e",
    docs: "#10b981",
    orphans: "#8b5cf6",
  };
  const color = colors[source] ?? "#6b7280";
  const label = SOURCE_LABELS[source] ?? source;

  return (
    <span
      className="text-[0.5rem] font-mono uppercase px-1.5 py-0.5 rounded shrink-0"
      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
    >
      {label}
    </span>
  );
}
