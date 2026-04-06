import { AgentWidget } from "../widgets/AgentWidget";
import { useExecutionStore } from "../../store/executionStore";

export function AgentsPage() {
  const executions = useExecutionStore((state) => state.executions);

  return (
    <div className="page">
      <div className="page-title">
        <h1>Agents</h1>
      </div>
      <div className="glass panel">
        <AgentWidget />
      </div>
      <div className="card-list">
        {executions.map((execution) => (
          <div key={execution.id} className="glass panel">
            <div className="row-between">
              <strong>{execution.title}</strong>
              <span className="badge">{execution.status}</span>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>{execution.summary || "No summary yet"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
