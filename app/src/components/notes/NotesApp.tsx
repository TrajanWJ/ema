import { useEffect, useState, useCallback } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

interface Note { id: string; title: string; content: string; updated_at: string; }

export function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Note[]>("/notes").then(setNotes).catch(() => []);
  }, []);

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const select = (n: Note) => { setSelected(n); setContent(n.content); };

  const save = useCallback(() => {
    if (!selected) return;
    setSaving(true);
    api.put(`/notes/${selected.id}`, { content })
      .then(() => setNotes((prev) => prev.map((n) => n.id === selected.id ? { ...n, content } : n)))
      .finally(() => setSaving(false));
  }, [selected, content]);

  const newNote = () => {
    api.post<Note>("/notes", { title: "New Note", content: "" })
      .then((n) => { setNotes((prev) => [n, ...prev]); select(n); });
  };

  return (
    <AppWindowChrome appId="notes" title="Notes">
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <div style={{ width: 260, borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              style={{ flex: 1, padding: "5px 8px", borderRadius: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 12 }} />
            <button onClick={newNote} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "rgba(251,191,36,0.2)", color: "#fde68a", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.map((n) => (
              <div key={n.id} onClick={() => select(n)} style={{
                padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: selected?.id === n.id ? "rgba(255,255,255,0.07)" : "transparent",
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 11, opacity: 0.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.content.slice(0, 60)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selected ? (
            <>
              <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.title}</span>
                <button onClick={save} disabled={saving} style={{ padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(251,191,36,0.2)", color: "#fde68a", fontSize: 11 }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={save}
                style={{ flex: 1, padding: 16, background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.87)", fontSize: 13, lineHeight: 1.7, resize: "none", fontFamily: "inherit" }}
                placeholder="Start writing…"
              />
            </>
          ) : (
            <div style={{ opacity: 0.4, fontSize: 13, margin: "auto", textAlign: "center" }}>Select a note or create a new one</div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
