import { useEffect, useState } from "react";
import * as hq from "../../api/hq";
import { useProjectStore } from "../../store/projectStore";

const filters = ["unprocessed", "all", "archived"] as const;

export function BrainDumpPage() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projects = useProjectStore((state) => state.projects);
  const [filter, setFilter] = useState<(typeof filters)[number]>("unprocessed");
  const [items, setItems] = useState<any[]>([]);
  const [content, setContent] = useState("");

  async function load() {
    const result = await hq.getBrainDump({ status: filter === "all" ? undefined : filter, projectId: activeProjectId || undefined });
    setItems(result);
  }

  useEffect(() => {
    void load();
  }, [filter, activeProjectId]);

  return (
    <div className="page">
      <div className="page-title">
        <h1>Brain Dump</h1>
        <div className="row">
          {filters.map((item) => (
            <button key={item} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="glass panel card-list">
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Capture a thought, rough spec, or instruction" />
        <button onClick={async () => { await hq.addBrainDumpItem({ content, projectId: activeProjectId || undefined }); setContent(""); await load(); }}>Save</button>
      </div>
      <div className="row">
        <select onChange={async (event) => {
          const [brainDumpId, projectId] = event.target.value.split(":");
          if (brainDumpId && projectId) {
            await hq.updateBrainDumpItem(brainDumpId, { project_id: projectId, status: "processed" });
            await load();
          }
        }}>
          <option value="">Assign selected item to project</option>
          {items.flatMap((item) =>
            projects.map((project) => (
              <option key={`${item.id}:${project.id}`} value={`${item.id}:${project.id}`}>
                {project.name} ← {item.content.slice(0, 24)}
              </option>
            ))
          )}
        </select>
      </div>
      <div className="card-list">
        {items.map((item) => (
          <div key={item.id} className="glass panel">
            <div>{item.content}</div>
            <div className="muted" style={{ marginTop: 8 }}>{item.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
