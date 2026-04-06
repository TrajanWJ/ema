import { useEffect, useState } from "react";
import { useExecutionStore } from "../../store/executionStore";

function colorForStatus(status: string) {
  if (status === "completed") return "var(--green)";
  if (status === "running") return "var(--yellow)";
  if (status === "failed") return "var(--red)";
  return "var(--dim)";
}

function formatDuration(ms?: number | null) {
  if (!ms) return "0s";
  const seconds = Math.floor(ms / 1000);
  return `${seconds}s`;
}

export function ExecutionFeed() {
  const executions = useExecutionStore((state) => state.executions);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (executions.length === 0) {
    return <div className="muted" style={{ textAlign: "center", paddingTop: 48 }}>No executions yet — dispatch your first agent task</div>;
  }

  return (
    <div className="card-list">
      {executions.slice(0, 8).map((execution) => {
        const runningMs = execution.status === "running" && execution.started_at ? tick - execution.started_at * 1000 : execution.ms || 0;
        return (
          <div key={execution.id} className="card execution-row">
            <span className={`status-dot ${execution.status === "running" ? "pulse" : ""}`} style={{ background: colorForStatus(execution.status) }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{execution.title}</div>
              <div className="muted" style={{ fontSize: 10 }}>
                <span className="status-dot" style={{ background: execution.project_color || "var(--dim)", marginRight: 6 }} />
                {execution.project_name || "No project"}
              </div>
            </div>
            <div className="dim">{formatDuration(runningMs)}</div>
          </div>
        );
      })}
    </div>
  );
}
