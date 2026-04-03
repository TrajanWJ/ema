import { useEffect, useState, useCallback } from "react";
import { useFileVaultStore } from "@/stores/file-vault-store";
import type { VaultFile } from "@/stores/file-vault-store";

const card = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "10px",
};
const input = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "6px",
  color: "var(--pn-text-primary)",
  padding: "8px 12px",
  width: "100%",
  outline: "none",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileCard({ file, selected, onSelect, onDelete }: {
  readonly file: VaultFile;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        ...card,
        padding: "12px",
        cursor: "pointer",
        outline: selected ? "1px solid rgba(56, 189, 248, 0.4)" : "none",
      }}
    >
      <div style={{ color: "var(--pn-text-primary)", fontSize: 13, fontWeight: 500 }}>{file.name}</div>
      <div style={{ color: "var(--pn-text-muted)", fontSize: 11, marginTop: 4 }}>
        {formatSize(file.size)} &middot; {file.mime_type}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        style={{ marginTop: 6, fontSize: 11, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}
      >
        Delete
      </button>
    </div>
  );
}

export function FileVaultApp() {
  const { files, selectedFileId, loading, error, loadFiles, selectFile, deleteFile } = useFileVaultStore();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const selectedFile = files.find((f) => f.id === selectedFileId) ?? null;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // Upload would read files from e.dataTransfer.files when backend exists
  }, []);

  if (loading && files.length === 0) {
    return (
      <div style={{ background: "rgba(8, 9, 14, 0.95)", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--pn-text-muted)", fontSize: 13 }}>Loading files...</span>
      </div>
    );
  }

  return (
    <div style={{ background: "rgba(8, 9, 14, 0.95)", height: "100%", display: "flex", flexDirection: "column" }}>
      <div data-tauri-drag-region style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ color: "var(--pn-text-primary)", fontSize: 16, fontWeight: 600, margin: 0 }}>File Vault</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setView("grid")} style={{ ...input, width: "auto", padding: "4px 10px", fontSize: 11, opacity: view === "grid" ? 1 : 0.5 }}>Grid</button>
          <button onClick={() => setView("list")} style={{ ...input, width: "auto", padding: "4px 10px", fontSize: 11, opacity: view === "list" ? 1 : 0.5 }}>List</button>
        </div>
      </div>

      {error && <div style={{ padding: "0 20px", color: "#f87171", fontSize: 12 }}>{error}</div>}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: "0 20px 20px", overflowY: "auto" }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              ...card,
              padding: 20,
              marginBottom: 16,
              textAlign: "center",
              border: dragOver ? "1px dashed rgba(56, 189, 248, 0.5)" : "1px dashed rgba(255, 255, 255, 0.1)",
              color: "var(--pn-text-muted)",
              fontSize: 12,
            }}
          >
            Drop files here to upload
          </div>

          {files.length === 0 ? (
            <div style={{ color: "var(--pn-text-muted)", fontSize: 13, textAlign: "center", marginTop: 32 }}>No files yet</div>
          ) : (
            <div style={{ display: view === "grid" ? "grid" : "flex", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, flexDirection: "column" }}>
              {files.map((f) => (
                <FileCard key={f.id} file={f} selected={f.id === selectedFileId} onSelect={() => selectFile(f.id)} onDelete={() => deleteFile(f.id)} />
              ))}
            </div>
          )}
        </div>

        {selectedFile && (
          <div style={{ width: 260, padding: "0 20px 20px", borderLeft: "1px solid rgba(255, 255, 255, 0.06)", overflowY: "auto" }}>
            <h3 style={{ color: "var(--pn-text-primary)", fontSize: 14, fontWeight: 600 }}>Preview</h3>
            <div style={{ color: "var(--pn-text-secondary)", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <span>Name: {selectedFile.name}</span>
              <span>Size: {formatSize(selectedFile.size)}</span>
              <span>Type: {selectedFile.mime_type}</span>
              <span>Created: {new Date(selectedFile.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
