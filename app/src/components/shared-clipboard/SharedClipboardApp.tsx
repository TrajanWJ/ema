import { useEffect, useState } from "react";
import { useClipboardStore } from "@/stores/clipboard-store";
import type { Clip } from "@/stores/clipboard-store";

const card = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "10px",
  padding: "14px",
};
const inputStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "6px",
  color: "var(--pn-text-primary)",
  padding: "8px 12px",
  outline: "none",
  fontSize: 13,
};

function isExpiringSoon(clip: Clip): boolean {
  if (!clip.expires_at) return false;
  const diff = new Date(clip.expires_at).getTime() - Date.now();
  return diff > 0 && diff < 3600_000;
}

function ClipCard({ clip, onPin, onDelete }: {
  readonly clip: Clip;
  readonly onPin: () => void;
  readonly onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(clip.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ ...card, cursor: "pointer", position: "relative" }} onClick={handleCopy}>
      {clip.pinned && (
        <span style={{ position: "absolute", top: 8, right: 8, fontSize: 10, color: "#fbbf24" }}>pinned</span>
      )}
      {isExpiringSoon(clip) && (
        <span style={{ position: "absolute", top: 8, right: clip.pinned ? 54 : 8, fontSize: 10, color: "#f87171" }}>expiring</span>
      )}
      <div style={{ color: "var(--pn-text-primary)", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 80, overflow: "hidden" }}>
        {clip.content}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 6,
            background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8",
          }}>
            {clip.device}
          </span>
          <span style={{ fontSize: 10, color: "var(--pn-text-muted)" }}>{clip.content_type}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {copied && <span style={{ fontSize: 10, color: "#34d399" }}>Copied</span>}
          <button onClick={(e) => { e.stopPropagation(); onPin(); }} style={{ fontSize: 11, color: clip.pinned ? "#fbbf24" : "var(--pn-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            {clip.pinned ? "Unpin" : "Pin"}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ fontSize: 11, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function SharedClipboardApp() {
  const { clips, loading, error, loadClips, createClip, pinClip, deleteClip } = useClipboardStore();
  const [draft, setDraft] = useState("");

  useEffect(() => { loadClips(); }, [loadClips]);

  const handleCreate = () => {
    if (!draft.trim()) return;
    createClip(draft.trim(), "text");
    setDraft("");
  };

  const sorted = [...clips].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div style={{ background: "rgba(8, 9, 14, 0.95)", height: "100%", display: "flex", flexDirection: "column" }}>
      <div data-tauri-drag-region style={{ padding: "14px 20px" }}>
        <h2 style={{ color: "var(--pn-text-primary)", fontSize: 16, fontWeight: 600, margin: 0 }}>Shared Clipboard</h2>
      </div>

      {error && <div style={{ padding: "0 20px", color: "#f87171", fontSize: 12 }}>{error}</div>}

      <div style={{ padding: "0 20px 12px", display: "flex", gap: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Paste or type content..." style={{ ...inputStyle, flex: 1 }} />
        <button onClick={handleCreate} style={{ ...inputStyle, width: "auto", cursor: "pointer", color: "#38bdf8", fontWeight: 500 }}>Add</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && clips.length === 0 && (
          <div style={{ color: "var(--pn-text-muted)", fontSize: 12, textAlign: "center", marginTop: 24 }}>Loading...</div>
        )}
        {sorted.map((c) => (
          <ClipCard key={c.id} clip={c} onPin={() => pinClip(c.id, !c.pinned)} onDelete={() => deleteClip(c.id)} />
        ))}
        {!loading && clips.length === 0 && (
          <div style={{ color: "var(--pn-text-muted)", fontSize: 13, textAlign: "center", marginTop: 32 }}>No clips yet</div>
        )}
      </div>
    </div>
  );
}
