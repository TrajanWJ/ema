import { useEffect, useState } from "react";
import { useOrgStore } from "../../store/orgStore";

export function OrgsPage() {
  const {
    orgs,
    activeOrg,
    members,
    invitations,
    loading,
    setActiveOrg,
    loadOrgs,
    createOrg,
    deleteOrg,
    createInvitation,
    revokeInvitation,
  } = useOrgStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  async function handleCreate() {
    if (!form.name.trim()) return;
    await createOrg({
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"),
      description: form.description || null,
    });
    setModalOpen(false);
    setForm({ name: "", slug: "", description: "" });
  }

  async function handleInvite() {
    if (!activeOrg) return;
    const result = await createInvitation(activeOrg.id, { role: "member" });
    setInviteLink(result.link);
  }

  return (
    <div className="page">
      <div className="page-title">
        <h1>Organizations</h1>
        <button onClick={() => setModalOpen(true)}>New Org</button>
      </div>

      <div className="split">
        <div className="card-list">
          {orgs.map((org) => (
            <button
              key={org.id}
              className="glass panel"
              style={{
                textAlign: "left",
                width: "100%",
                border: activeOrg?.id === org.id ? "1px solid var(--accent)" : undefined,
              }}
              onClick={() => setActiveOrg(org)}
            >
              <div className="row-between">
                <strong>{org.name}</strong>
                <span className="badge">{org.slug}</span>
              </div>
              {org.description && (
                <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
                  {org.description}
                </div>
              )}
            </button>
          ))}
          {orgs.length === 0 && !loading && (
            <div className="muted" style={{ textAlign: "center", padding: 32 }}>
              No organizations yet
            </div>
          )}
        </div>

        {activeOrg && (
          <div className="card-list">
            <div className="glass panel">
              <div className="row-between">
                <strong>{activeOrg.name}</strong>
                <div className="row">
                  <button onClick={handleInvite} style={{ fontSize: 11 }}>Invite</button>
                  <button
                    onClick={() => deleteOrg(activeOrg.id)}
                    style={{ fontSize: 11, color: "var(--red)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {inviteLink && (
                <div className="card" style={{ marginTop: 8, fontSize: 11 }}>
                  <div className="muted">Invite link (share this):</div>
                  <code style={{ wordBreak: "break-all" }}>{inviteLink}</code>
                </div>
              )}
            </div>

            <div className="glass panel">
              <strong style={{ fontSize: 11 }}>Members ({members.length})</strong>
              <div className="card-list" style={{ marginTop: 8 }}>
                {members.map((m) => (
                  <div key={m.id} className="card row-between">
                    <div>
                      <div>{m.display_name}</div>
                      {m.email && <div className="muted" style={{ fontSize: 10 }}>{m.email}</div>}
                    </div>
                    <span className="badge">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {invitations.length > 0 && (
              <div className="glass panel">
                <strong style={{ fontSize: 11 }}>Invitations ({invitations.length})</strong>
                <div className="card-list" style={{ marginTop: 8 }}>
                  {invitations.map((inv) => (
                    <div key={inv.id} className="card row-between">
                      <div>
                        <span className="badge">{inv.role}</span>
                        <span className="muted" style={{ marginLeft: 8, fontSize: 10 }}>
                          Used: {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => revokeInvitation(activeOrg.id, inv.id)}
                        style={{ fontSize: 11, color: "var(--red)" }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="glass modal" onClick={(e) => e.stopPropagation()}>
            <h1 style={{ fontSize: 18, marginBottom: 12 }}>New Organization</h1>
            <div className="card-list">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Organization name"
                autoFocus
              />
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="Slug (auto-generated if empty)"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description"
              />
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
