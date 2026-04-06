import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useUIStore } from "../../store/uiStore";

const swatches = ["#38bdf8", "#34d399", "#a78bfa", "#fb923c", "#f472b6", "#fbbf24", "#f87171", "#94a3b8"];

export function ProjectsPage() {
  const { projects, createProject, updateProject, setActiveProject } = useProjectStore();
  const setPage = useUIStore((state) => state.setPage);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", path: "", color: swatches[0], github: "", deployment: "", notes: "" });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", path: "", color: swatches[0], github: "", deployment: "", notes: "" });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    if (editing) {
      await updateProject(editing.id, { name: form.name, description: form.description, path: form.path, color: form.color });
    } else {
      await createProject({ name: form.name, description: form.description, path: form.path, color: form.color });
    }
    setModalOpen(false);
  }

  return (
    <div className="page">
      <div className="page-title">
        <h1>Projects</h1>
        <button onClick={openCreate}>New Project</button>
      </div>

      <div className="project-grid">
        {projects.map((project) => (
          <div key={project.id} className="glass" style={{ overflow: "hidden" }}>
            <div style={{ height: 3, background: project.color || "var(--accent)" }} />
            <div className="panel">
              <div className="row-between">
                <strong>{project.name}</strong>
                <span className="badge">{project.status || "active"}</span>
              </div>
              <div className="muted" style={{ marginTop: 8, minHeight: 40 }}>{project.description || "No description"}</div>
              <div className="row-between" style={{ marginTop: 12 }}>
                <span>{project.total_executions || 0} executions</span>
                <span className="muted">
                  {project.last_execution ? new Date(project.last_execution * 1000).toLocaleString() : "Never"}
                </span>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button onClick={async () => { await setActiveProject(project.id); setPage("dashboard"); }}>
                  Set Active
                </button>
                <button onClick={() => {
                  setEditing(project);
                  setForm({
                    name: project.name,
                    description: project.description || "",
                    path: project.path || "",
                    color: project.color || swatches[0],
                    github: "",
                    deployment: "",
                    notes: ""
                  });
                  setModalOpen(true);
                }}>
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="glass modal" onClick={(event) => event.stopPropagation()}>
            <div className="page-title" style={{ marginBottom: 12 }}>
              <h1 style={{ fontSize: 18 }}>{editing ? "Edit Project" : "New Project"}</h1>
            </div>
            <div className="card-list">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name" />
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" />
              <input value={form.path} onChange={(event) => setForm({ ...form, path: event.target.value })} placeholder="Path on disk" />
              <div className="row">
                {swatches.map((swatch) => (
                  <button
                    key={swatch}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: swatch,
                      border: form.color === swatch ? "2px solid white" : "1px solid transparent"
                    }}
                    onClick={() => setForm({ ...form, color: swatch })}
                  />
                ))}
              </div>
              <input value={form.github} onChange={(event) => setForm({ ...form, github: event.target.value })} placeholder="GitHub URL" />
              <input value={form.deployment} onChange={(event) => setForm({ ...form, deployment: event.target.value })} placeholder="Deployment URL" />
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes" />
              <div className="row">
                <button onClick={save}>Save</button>
                <button onClick={() => setModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
