import { useEffect, useState } from "react";
import { useExecutionStore } from "../../store/executionStore";
import * as hq from "../../api/hq";

interface DispatchStats {
  running?: number;
  queued?: number;
  completed_today?: number;
  failed_today?: number;
  total?: number;
}

export function DispatchWidget() {
  const running = useExecutionStore((s) => s.getRunning());
  const [stats, setStats] = useState<DispatchStats>({});
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    hq.getDispatchStats()
      .then((data) => setStats(data as DispatchStats))
      .catch(() => {});
  }, []);

  // Live timer tick for running executions
  useEffect(() => {
    if (running.length === 0) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running.length]);

  return (
    <div className="card-list">
      <div className="row" style={{ justifyContent: "space-around", padding: "8px 0" }}>
        <StatBubble
          value={running.length}
          label="Running"
          color="var(--orange)"
        />
        <StatBubble
          value={stats.queued ?? 0}
          label="Queued"
          color="var(--accent)"
        />
        <StatBubble
          value={stats.completed_today ?? 0}
          label="Done"
          color="var(--green)"
        />
        <StatBubble
          value={stats.failed_today ?? 0}
          label="Failed"
          color="var(--red)"
        />
      </div>

      {running.length === 0 ? (
        <div className="muted" style={{ textAlign: "center", fontSize: 11, padding: 12 }}>
          No active executions
        </div>
      ) : (
        running.map((exec) => {
          const insertedAt = exec.inserted_at ? new Date(exec.inserted_at).getTime() : tick;
          const elapsed = Math.floor(
            (tick - insertedAt) / 1000
          );
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;

          return (
            <div key={exec.id} className="card">
              <div className="row-between">
                <div className="row">
                  <span
                    className="status-dot pulse"
                    style={{ background: "var(--orange)" }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {exec.title}
                    </div>
                    <div className="muted" style={{ fontSize: 10 }}>
                      {exec.mode || "dispatch"} · {exec.project_slug || "no project"}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 12,
                    color: "var(--orange)",
                  }}
                >
                  {minutes}:{seconds.toString().padStart(2, "0")}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function StatBubble({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>
        {value}
      </div>
      <div className="muted" style={{ fontSize: 9, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}
