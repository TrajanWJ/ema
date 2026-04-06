import { useMemo, useState } from "react";
import * as hq from "../../api/hq";
import { useExecutionStore } from "../../store/executionStore";
import { useProjectStore } from "../../store/projectStore";

export function AgentWidget() {
  const [input, setInput] = useState("");
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projects = useProjectStore((state) => state.projects);
  const addExecution = useExecutionStore((state) => state.addExecution);
  const running = useExecutionStore(useMemo(() => (state) => state.getRunning(), []));

  async function handleDispatch() {
    if (!input.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await hq.dispatchExecution({ title: input.trim(), instruction: input.trim(), projectId: projectId || undefined });
      addExecution({
        id: result.executionId,
        title: input.trim(),
        status: "running",
        project_id: projectId || null
      });
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-list">
      <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="What do you want the agent to do?" />
      <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
        <option value="">No project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
      </select>
      <button style={{ background: "rgba(56,189,248,0.18)" }} onClick={handleDispatch} disabled={submitting}>
        {submitting ? "Dispatching..." : "Dispatch Agent"}
      </button>
      {error && <div style={{ color: "var(--red)" }}>{error}</div>}

      <div className="row-between" style={{ marginTop: 8 }}>
        <strong>Active</strong>
        <span className="badge">{running.length}</span>
      </div>

      {running.length === 0 ? (
        <div className="muted">No agents running</div>
      ) : (
        running.map((execution) => (
          <div key={execution.id} className="card row-between">
            <div>
              <div>{execution.title}</div>
              <div className="muted">{execution.project_name || "No project"}</div>
            </div>
            <button>Cancel</button>
          </div>
        ))
      )}
    </div>
  );
}
