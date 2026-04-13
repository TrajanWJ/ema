import { useEffect, useRef } from "react";
import { usePipelineStore } from "@/stores/pipeline-store";

const STAGES = [
  { key: "seeds", label: "Seeds" },
  { key: "raw", label: "Raw" },
  { key: "refined", label: "Refined" },
  { key: "debated", label: "Debated" },
  { key: "queued", label: "Queued" },
  { key: "approved", label: "Approved" },
  { key: "tasks", label: "Tasks" },
] as const;

function stageCount(
  stats: { seeds: number; proposals: Record<string, number>; tasks: Record<string, number> } | null,
  key: string,
): number {
  if (!stats) return 0;
  if (key === "seeds") return stats.seeds;
  if (key === "tasks") {
    return Object.values(stats.tasks).reduce((a, b) => a + b, 0);
  }
  return stats.proposals[key] ?? 0;
}

function stageColor(count: number, isBottleneck: boolean): string {
  if (isBottleneck) return "#ef4444";
  if (count === 0) return "rgba(255,255,255,0.15)";
  return "#2dd4a8";
}

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.floor(ms / 60_000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function PipelineApp() {
  const { stats, bottlenecks, throughput, loading, loadStats, loadBottlenecks, loadThroughput } =
    usePipelineStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadStats();
    loadBottlenecks();
    loadThroughput();

    intervalRef.current = setInterval(() => {
      loadStats();
      loadBottlenecks();
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadStats, loadBottlenecks, loadThroughput]);

  const bottleneckStages = new Set(bottlenecks.map((b) => b.stage));
  const maxThroughput = Math.max(1, ...throughput.map((t) => t.count));

  return (
    <div style={{ background: "rgba(8, 9, 14, 0.95)", minHeight: "100vh", color: "var(--pn-text-primary)" }}>
      {/* Title bar */}
      <div
        data-tauri-drag-region
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--pn-text-secondary)",
          letterSpacing: "0.04em",
          userSelect: "none",
        }}
      >
        <span style={{ marginRight: 8, color: "#2dd4a8" }}>&#9670;</span>
        PIPELINE COMMANDER
        {loading && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--pn-text-muted)" }}>
            loading...
          </span>
        )}
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Funnel visualization */}
        <section>
          <h2 style={{ fontSize: 12, fontWeight: 600, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Pipeline Funnel
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
            {STAGES.map((stage, i) => {
              const count = stageCount(stats, stage.key);
              const isBn = bottleneckStages.has(stage.key);
              const color = stageColor(count, isBn);

              return (
                <div key={stage.key} style={{ display: "flex", alignItems: "center" }}>
                  {/* Stage card */}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${isBn ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 10,
                      padding: "16px 20px",
                      minWidth: 80,
                      textAlign: "center",
                      position: "relative",
                    }}
                  >
                    {isBn && (
                      <div style={{
                        position: "absolute", top: 6, right: 6, width: 8, height: 8,
                        borderRadius: "50%", background: "#ef4444",
                        animation: "pulse 1.5s ease-in-out infinite",
                      }} />
                    )}
                    <div style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--pn-text-secondary)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {stage.label}
                    </div>
                  </div>

                  {/* Flow line */}
                  {i < STAGES.length - 1 && (
                    <div style={{
                      width: 32, height: 2, position: "relative", margin: "0 2px",
                      background: "rgba(255,255,255,0.08)", overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute", top: 0, left: 0, height: "100%", width: "40%",
                        background: "linear-gradient(90deg, transparent, #2dd4a8, transparent)",
                        animation: "flowLine 2s linear infinite",
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottleneck alerts */}
        <section>
          <h2 style={{ fontSize: 12, fontWeight: 600, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Bottleneck Alerts
          </h2>
          {bottlenecks.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--pn-text-muted)", padding: "12px 0" }}>
              No bottlenecks detected. Pipeline is flowing.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bottlenecks.map((b) => (
                <div
                  key={b.id}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#ef4444", flexShrink: 0,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--pn-text-muted)", marginTop: 2 }}>
                      Stuck in <span style={{ color: "#f59e0b" }}>{b.stage}</span> for {timeSince(b.stuck_since)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Throughput chart */}
        <section>
          <h2 style={{ fontSize: 12, fontWeight: 600, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Throughput (Last 7 Days)
          </h2>
          {throughput.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--pn-text-muted)", padding: "12px 0" }}>
              No throughput data yet.
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
              {throughput.map((t) => {
                const pct = (t.count / maxThroughput) * 100;
                return (
                  <div key={t.period} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--pn-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                      {t.count}
                    </span>
                    <div style={{
                      width: "100%", maxWidth: 48, height: `${Math.max(pct, 4)}%`,
                      background: "linear-gradient(to top, #2dd4a8, rgba(45,212,168,0.3))",
                      borderRadius: "4px 4px 0 0",
                      transition: "height 0.3s ease",
                    }} />
                    <span style={{ fontSize: 10, color: "var(--pn-text-muted)" }}>
                      {t.period.slice(-5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes flowLine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
