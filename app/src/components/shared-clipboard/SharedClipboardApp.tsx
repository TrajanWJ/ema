import { useEffect, useState } from "react";
import { useClipboardStore } from "@/stores/clipboard-store";
import type { Clip } from "@/stores/clipboard-store";

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

const CONTENT_TYPE_COLORS: Record<string, string> = {
  text: "#6B95F0",
  code: "#A78BFA",
  url: "#2DD4A8",
  image: "#F59E0B",
};

const SOURCE_COLORS: Record<string, string> = {
  manual: "var(--pn-text-secondary)",
  agent: "#2DD4A8",
  pipe: "#6B95F0",
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function ClipCard({
  clip,
  onPin,
  onCopy,
  onDelete,
}: {
  readonly clip: Clip;
  readonly onPin: () => void;
  readonly onCopy: () => void;
  readonly onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isCode = clip.content_type === "code";

  return (
    <div style={card}>
      <div
        style={{
          color: "var(--pn-text-primary)",
          fontSize: 13,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: isCode ? "JetBrains Mono, monospace" : "inherit",
          lineHeight: 1.5,
        }}
      >
        {truncate(clip.content, 200)}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 6,
              background: `${CONTENT_TYPE_COLORS[clip.content_type] ?? "#6B95F0"}18`,
              color: CONTENT_TYPE_COLORS[clip.content_type] ?? "#6B95F0",
            }}
          >
            {clip.content_type}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 6,
              background: `${SOURCE_COLORS[clip.source] ?? "var(--pn-text-secondary)"}18`,
              color: SOURCE_COLORS[clip.source] ?? "var(--pn-text-secondary)",
            }}
          >
            {clip.source}
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {copied && (
            <span style={{ fontSize: 10, color: "#2DD4A8" }}>Copied</span>
          )}
          <button
            onClick={handleCopy}
            style={{
              fontSize: 11,
              color: "var(--pn-text-secondary)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Copy
          </button>
          <button
            onClick={onPin}
            style={{
              fontSize: 11,
              color: clip.pinned ? "#F59E0B" : "var(--pn-text-secondary)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {clip.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={onDelete}
            style={{
              fontSize: 11,
              color: "#f87171",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function SharedClipboardApp() {
  const { clips, loading, error, loadViaRest, createClip, pinClip, deleteClip } =
    useClipboardStore();
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<Clip["content_type"]>("text");

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  const handleCreate = () => {
    if (!content.trim()) return;
    createClip({ content: content.trim(), content_type: contentType });
    setContent("");
  };

  const pinnedClips = clips.filter((c) => c.pinned);
  const otherClips = [...clips]
    .filter((c) => !c.pinned)
    .sort(
      (a, b) =>
        new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime(),
    );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 20,
      }}
    >
      <h2
        style={{
          color: "var(--pn-text-primary)",
          fontSize: 16,
          fontWeight: 600,
          margin: "0 0 16px",
        }}
      >
        Shared Clipboard
      </h2>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Create form */}
      <div style={{ ...card, marginBottom: 16 }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste or type content..."
          rows={3}
          style={{
            ...inputStyle,
            resize: "vertical",
            marginBottom: 10,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <select
            value={contentType}
            onChange={(e) =>
              setContentType(e.target.value as Clip["content_type"])
            }
            style={{
              ...inputStyle,
              width: "auto",
              cursor: "pointer",
            }}
          >
            <option value="text">text</option>
            <option value="code">code</option>
            <option value="url">url</option>
            <option value="image">image</option>
          </select>
          <button onClick={handleCreate} style={btnPrimary}>
            Add Clip
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && clips.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            Loading...
          </div>
        )}

        {/* Pinned section */}
        {pinnedClips.length > 0 && (
          <>
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Pinned
            </div>
            {pinnedClips.map((c) => (
              <ClipCard
                key={c.id}
                clip={c}
                onPin={() => pinClip(c.id)}
                onCopy={() => navigator.clipboard.writeText(c.content)}
                onDelete={() => deleteClip(c.id)}
              />
            ))}
          </>
        )}

        {/* All clips */}
        {otherClips.length > 0 && (
          <>
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 8,
                marginTop: pinnedClips.length > 0 ? 8 : 0,
              }}
            >
              All Clips
            </div>
            {otherClips.map((c) => (
              <ClipCard
                key={c.id}
                clip={c}
                onPin={() => pinClip(c.id)}
                onCopy={() => navigator.clipboard.writeText(c.content)}
                onDelete={() => deleteClip(c.id)}
              />
            ))}
          </>
        )}

        {!loading && clips.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No clips yet
          </div>
        )}
      </div>
    </div>
  );
}
