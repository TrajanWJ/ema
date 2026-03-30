import { useState, useEffect } from "react";
import { useVaultStore } from "@/stores/vault-store";

export function NoteEditor() {
  const selectedNote = useVaultStore((s) => s.selectedNote);
  const updateNote = useVaultStore((s) => s.updateNote);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (selectedNote?.content !== undefined) {
      setContent(selectedNote.content);
      setDirty(false);
    }
  }, [selectedNote]);

  if (!selectedNote) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Select a file to edit
        </span>
      </div>
    );
  }

  async function handleSave() {
    if (!selectedNote) return;
    await updateNote(selectedNote.file_path, content);
    setDirty(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Title bar */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-[0.875rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
            {selectedNote.title}
          </h3>
          <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
            {selectedNote.file_path}
          </span>
        </div>
        {dirty && (
          <button
            onClick={handleSave}
            className="text-[0.7rem] px-3 py-1 rounded-md font-medium"
            style={{ background: "var(--color-pn-primary-400)", color: "#fff" }}
          >
            Save
          </button>
        )}
      </div>

      {/* Tags */}
      {selectedNote.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedNote.tags.map((tag) => (
            <span
              key={tag}
              className="text-[0.6rem] px-1.5 py-0.5 rounded-md"
              style={{ background: "rgba(45, 212, 168, 0.1)", color: "#2dd4a8" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setDirty(true); }}
        className="flex-1 text-[0.75rem] px-3 py-2 rounded-lg outline-none resize-none font-mono"
        style={{
          background: "var(--pn-surface-3)",
          color: "var(--pn-text-primary)",
          border: "1px solid var(--pn-border-default)",
          lineHeight: "1.6",
        }}
      />
    </div>
  );
}
