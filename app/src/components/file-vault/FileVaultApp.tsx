import { useEffect, useState } from "react";
import { useFileVaultStore } from "@/stores/file-vault-store";
import type { ManagedFile } from "@/stores/file-vault-store";

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeIcon(mime: string): string {
  if (mime.startsWith("text/")) return "\u{1F4C4}";
  if (mime.startsWith("image/")) return "\u{1F5BC}";
  if (
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("gzip") ||
    mime.includes("archive")
  )
    return "\u{1F4E6}";
  return "\u{1F4C1}";
}

function FileCard({
  file,
  onDelete,
}: {
  readonly file: ManagedFile;
  readonly onDelete: () => void;
}) {
  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20 }}>{mimeIcon(file.mime_type)}</span>
          <div>
            <div
              style={{
                color: "var(--pn-text-primary)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {file.filename}
            </div>
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {file.path}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginTop: 6,
              }}
            >
              <span
                style={{
                  color: "var(--pn-text-secondary)",
                  fontSize: 11,
                }}
              >
                {formatSize(file.size_bytes)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: "rgba(107,149,240,0.1)",
                  color: "#6B95F0",
                }}
              >
                {file.mime_type}
              </span>
              {file.project_id && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "rgba(45,212,168,0.1)",
                    color: "#2DD4A8",
                  }}
                >
                  {file.project_id}
                </span>
              )}
            </div>
            {file.tags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {file.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(245,158,11,0.1)",
                      color: "#F59E0B",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          style={{
            background: "rgba(248,113,113,0.12)",
            color: "#f87171",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function FileVaultApp() {
  const { files, loading, error, loadViaRest, createFile, deleteFile } =
    useFileVaultStore();

  const [showForm, setShowForm] = useState(false);
  const [filename, setFilename] = useState("");
  const [path, setPath] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [projectId, setProjectId] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  const handleCreate = () => {
    if (!filename.trim() || !path.trim()) return;
    createFile({
      filename: filename.trim(),
      path: path.trim(),
      mime_type: mimeType.trim() || "application/octet-stream",
      project_id: projectId.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setFilename("");
    setPath("");
    setMimeType("");
    setProjectId("");
    setTags("");
    setShowForm(false);
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            color: "var(--pn-text-primary)",
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
          }}
        >
          File Vault
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: showForm
              ? "rgba(239,68,68,0.12)"
              : "rgba(107,149,240,0.12)",
            color: showForm ? "#ef4444" : "#6B95F0",
          }}
        >
          {showForm ? "Cancel" : "+ Add File"}
        </button>
      </div>

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

      {showForm && (
        <div style={card}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Filename *"
              style={inputStyle}
            />
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="Path *"
              style={inputStyle}
            />
            <input
              value={mimeType}
              onChange={(e) => setMimeType(e.target.value)}
              placeholder="MIME type"
              style={inputStyle}
            />
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Project ID (optional)"
              style={inputStyle}
            />
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              style={{ ...inputStyle, gridColumn: "1 / -1" }}
            />
          </div>
          <button onClick={handleCreate} style={btnPrimary}>
            Add File
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && files.length === 0 && (
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

        {files.map((f) => (
          <FileCard key={f.id} file={f} onDelete={() => deleteFile(f.id)} />
        ))}

        {!loading && files.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No files yet
          </div>
        )}
      </div>
    </div>
  );
}
