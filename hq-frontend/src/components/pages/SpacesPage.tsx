import { useState } from "react";
import { useSpaceStore } from "../../store/spaceStore";
import { useOrgStore } from "../../store/orgStore";

const TYPE_COLORS: Record<string, string> = {
  personal: "var(--accent)",
  team: "var(--green)",
  project: "var(--purple)",
};

export function SpacesPage() {
  const { spaces, activeSpaceId, setActiveSpace, createSpace, loading } = useSpaceStore();
  const orgs = useOrgStore((s) => s.orgs);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", space_type: "personal", org_id: "" });

  async function handleCreate() {
    if (!form.name.trim()) return;
    await createSpace({
      name: form.name,
      space_type: form.space_type,
      org_id: form.org_id || "default",
    });
    setModalOpen(false);
    setForm({ name: "", space_type: "personal", org_id: "" });
  }

  // Group spaces by org
  const grouped = spaces.reduce<Record<string, typeof spaces>>((acc, space) => {
    const key = space.org_id || "none";
    if (!acc[key]) acc[key] = [];
    acc[key].push(space);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-title">
        <h1>Spaces</h1>
        <button onClick={() => setModalOpen(true)}>New Space</button>
      </div>

      {loading && spaces.length === 0 && (
        <div className="muted" style={{ textAlign: "center", padding: 32 }}>Loading spaces...</div>
      )}

      {Object.entries(grouped).map(([orgId, orgSpaces]) => {
        const org = orgs.find((o) => o.id === orgId);
        return (
          <div key={orgId}>
            <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", marginBottom: 8 }}>
              {org?.name || "Personal"}
            </div>
            <div className="project-grid">
              {orgSpaces.map((space) => (
                <div
                  key={space.id}
                  className="glass"
                  style={{
                    overflow: "hidden",
                    border: space.id === activeSpaceId ? "1px solid var(--accent)" : undefined,
                  }}
                >
                  <div style={{ height: 3, background: space.color || TYPE_COLORS[space.space_type] || "var(--dim)" }} />
                  <div className="panel">
                    <div className="row-between">
                      <div className="row">
                        {space.icon && <span>{space.icon}</span>}
                        <strong>{space.name}</strong>
                      </div>
                      <span className="badge" style={{ color: TYPE_COLORS[space.space_type] }}>
                        {space.space_type}
                      </span>
                    </div>
                    <div className="row" style={{ marginTop: 12 }}>
                      <button
                        onClick={() => setActiveSpace(space.id)}
                        style={{
                          background: space.id === activeSpaceId ? "rgba(56,189,248,0.15)" : undefined,
                        }}
                      >
                        {space.id === activeSpaceId ? "Active" : "Switch"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="glass modal" onClick={(e) => e.stopPropagation()}>
            <h1 style={{ fontSize: 18, marginBottom: 12 }}>New Space</h1>
            <div className="card-list">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Space name"
                autoFocus
              />
              <select
                value={form.space_type}
                onChange={(e) => setForm({ ...form, space_type: e.target.value })}
              >
                <option value="personal">Personal</option>
                <option value="team">Team</option>
                <option value="project">Project</option>
              </select>
              {orgs.length > 0 && (
                <select
                  value={form.org_id}
                  onChange={(e) => setForm({ ...form, org_id: e.target.value })}
                >
                  <option value="">No organization</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              )}
              <div className="row">
                <button onClick={handleCreate}>Create</button>
                <button onClick={() => setModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
