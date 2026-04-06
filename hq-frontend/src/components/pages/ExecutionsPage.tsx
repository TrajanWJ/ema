import { useState } from "react";
import { useExecutionStore } from "../../store/executionStore";

const tabs = ["All", "Running", "Completed", "Failed"] as const;

export function ExecutionsPage() {
  const executions = useExecutionStore((state) => state.executions);
  const [filter, setFilter] = useState<(typeof tabs)[number]>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = executions.filter((execution) => {
    if (filter === "All") return true;
    return execution.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="page">
      <div className="page-title">
        <h1>Executions</h1>
        <div className="row">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)} style={{ background: filter === tab ? "rgba(255,255,255,0.12)" : undefined }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="card-list">
        {filtered.map((execution) => (
          <div key={execution.id} className="glass panel">
            <div className="row-between" onClick={() => setExpandedId(expandedId === execution.id ? null : execution.id)} style={{ cursor: "pointer" }}>
              <div className="row">
                <span className="status-dot" style={{ background: execution.status === "completed" ? "var(--green)" : execution.status === "running" ? "var(--yellow)" : execution.status === "failed" ? "var(--red)" : "var(--dim)" }} />
                <strong>{execution.title}</strong>
                <span className="badge">{execution.project_name || "No project"}</span>
                <span className="badge">{execution.agent_model || "default"}</span>
              </div>
              <div className="row">
                <span>{execution.ms ? `${Math.floor(execution.ms / 1000)}s` : "-"}</span>
                <span className="muted">{execution.created_at ? new Date(execution.created_at * 1000).toLocaleString() : ""}</span>
              </div>
            </div>
            {expandedId === execution.id && (
              <div className="card" style={{ marginTop: 12 }}>
                <div>{execution.summary || "No summary yet"}</div>
                <div className="muted" style={{ marginTop: 8 }}>
                  Tool calls: {Array.isArray(JSON.parse(execution.tool_calls || "[]")) ? JSON.parse(execution.tool_calls || "[]").length : 0}
                </div>
                <div className="muted">
                  Events: {Array.isArray(JSON.parse(execution.events || "[]")) ? JSON.parse(execution.events || "[]").length : 0}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
