import { useState, useEffect } from "react";
import { useVaultStore } from "@/stores/vault-store";
import { EDGE_TYPE_CONFIG } from "@/types/vault";
import type { EdgeType } from "@/types/vault";

const EDGE_ICONS: Record<EdgeType, string> = {
  "references": "🔗",
  "depends-on": "⛓",
  "implements": "⚙",
  "contradicts": "✕",
  "blocks": "⊘",
  "enables": "▸",
  "supersedes": "⬆",
  "part-of": "◫",
  "related-to": "↔",
};

interface WikiPageProps {
  readonly onNavigate: (path: string) => void;
}

export function WikiPage({ onNavigate }: WikiPageProps) {
  const selectedNote = useVaultStore((s) => s.selectedNote);
  const typedNeighbors = useVaultStore((s) => s.typedNeighbors);
  const updateNote = useVaultStore((s) => s.updateNote);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (selectedNote?.content !== undefined) {
      setContent(selectedNote.content ?? "");
      setDirty(false);
    }
  }, [selectedNote]);

  if (!selectedNote) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Select a note to view
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
    <div className="flex gap-3 h-full">
      {/* Main editor area */}
      <div className="flex-1 min-w-0 flex flex-col">
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

        {(selectedNote.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {(selectedNote.tags ?? []).map((tag) => (
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

      {/* Right rail — outgoing links grouped by type */}
      <div
        className="shrink-0 overflow-auto rounded-lg flex flex-col"
        style={{
          width: "200px",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--pn-border-subtle)",
        }}
      >
        <div
          className="px-3 py-2 text-[0.6rem] uppercase tracking-wider font-semibold"
          style={{
            color: "var(--pn-text-muted)",
            borderBottom: "1px solid var(--pn-border-subtle)",
          }}
        >
          Linked Notes
        </div>

        <div className="flex-1 overflow-auto px-2 py-2">
          {typedNeighbors.length === 0 ? (
            <div className="text-[0.65rem] px-1 py-2" style={{ color: "var(--pn-text-tertiary)" }}>
              No linked notes
            </div>
          ) : (
            typedNeighbors.map((group) => {
              const config = EDGE_TYPE_CONFIG[group.edge_type];
              const icon = EDGE_ICONS[group.edge_type] ?? "🔗";

              return (
                <div key={group.edge_type} className="mb-3">
                  <div
                    className="flex items-center gap-1.5 px-1 mb-1"
                    style={{ color: config?.color ?? "var(--pn-text-secondary)" }}
                  >
                    <span className="text-[0.65rem]">{icon}</span>
                    <span className="text-[0.6rem] uppercase tracking-wider font-semibold">
                      {config?.label ?? group.edge_type}
                    </span>
                    <span
                      className="text-[0.55rem] ml-auto tabular-nums"
                      style={{ color: "var(--pn-text-muted)" }}
                    >
                      {group.notes.length}
                    </span>
                  </div>

                  {group.notes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => onNavigate(note.file_path)}
                      className="w-full text-left px-2 py-1 rounded text-[0.65rem] truncate transition-colors hover:bg-white/5"
                      style={{ color: "var(--pn-text-primary)" }}
                      title={note.file_path}
                    >
                      {note.title || note.file_path}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
