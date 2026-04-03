import { useEffect, useState } from "react";
import { useContactsStore } from "@/stores/contacts-store";
import type { Contact } from "@/stores/contacts-store";

const card = {
  background: "rgba(14,16,23,0.55)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
} as const;

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--pn-text-primary)",
  width: "100%",
  outline: "none",
  fontSize: 13,
} as const;

const btnPrimary = {
  background: "#2DD4A8",
  color: "#000",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
} as const;

const STATUS_COLORS: Record<Contact["status"], string> = {
  active: "#2DD4A8",
  archived: "#888",
};

export function ContactsCRMApp() {
  const { contacts, loading, error, loadViaRest, createContact, deleteContact } =
    useContactsStore();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.company?.toLowerCase().includes(q) ?? false) ||
      (c.role?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleCreate = async () => {
    if (!formName.trim()) return;
    try {
      await createContact({
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        company: formCompany.trim() || undefined,
        role: formRole.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
      setFormName("");
      setFormEmail("");
      setFormPhone("");
      setFormCompany("");
      setFormRole("");
      setFormNotes("");
      setShowForm(false);
    } catch (err) {
      console.warn("Failed to create contact:", err);
    }
  };

  if (loading && contacts.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--pn-text-secondary)", fontSize: 13 }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ color: "var(--pn-text-primary)", fontSize: 16, fontWeight: 600, margin: 0 }}>Contacts</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: showForm ? "rgba(239,68,68,0.12)" : "rgba(107,149,240,0.12)",
            color: showForm ? "#ef4444" : "#6B95F0",
          }}
        >
          {showForm ? "Cancel" : "+ New Contact"}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>
          {error}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search contacts..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      {showForm && (
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Name *" style={inputStyle} />
            <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Email" style={inputStyle} />
            <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Phone" style={inputStyle} />
            <input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="Company" style={inputStyle} />
            <input value={formRole} onChange={(e) => setFormRole(e.target.value)} placeholder="Role" style={inputStyle} />
          </div>
          <textarea
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Notes"
            rows={2}
            style={{ ...inputStyle, marginBottom: 10, resize: "vertical" }}
          />
          <button onClick={handleCreate} style={btnPrimary}>Create Contact</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ color: "var(--pn-text-secondary)", fontSize: 13, textAlign: "center", marginTop: 32 }}>
            No contacts yet
          </div>
        )}
        {filtered.map((contact) => (
          <div key={contact.id} style={{ ...card, marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: "var(--pn-text-primary)", fontSize: 14, fontWeight: 600 }}>
                    {contact.name}
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${STATUS_COLORS[contact.status]}20`,
                      color: STATUS_COLORS[contact.status],
                    }}
                  >
                    {contact.status}
                  </span>
                </div>
                {(contact.company || contact.role) && (
                  <div style={{ color: "var(--pn-text-secondary)", fontSize: 12, marginBottom: 2 }}>
                    {[contact.role, contact.company].filter(Boolean).join(" @ ")}
                  </div>
                )}
                {contact.email && (
                  <div style={{ color: "var(--pn-text-secondary)", fontSize: 12 }}>{contact.email}</div>
                )}
                {contact.phone && (
                  <div style={{ color: "var(--pn-text-secondary)", fontSize: 12 }}>{contact.phone}</div>
                )}
              </div>
              <button
                onClick={() => deleteContact(contact.id)}
                style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 11 }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
