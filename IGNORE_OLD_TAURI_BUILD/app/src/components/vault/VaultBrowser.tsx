import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { useObsidianVaultStore } from "@/stores/obsidian-vault-store";
import type { ObsidianNote } from "@/stores/obsidian-vault-store";

const ACCENT = "#7c3aed";

function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className="text-[0.55rem] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: "rgba(124,58,237,0.12)", color: ACCENT }}
    >
      {tag}
    </span>
  );
}

function NoteCard({
  note,
  active,
  onClick,
}: {
  note: ObsidianNote;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg p-3 transition-colors"
      style={{
        background: active ? "rgba(124,58,237,0.1)" : "var(--pn-surface-2)",
        border: active ? `1px solid ${ACCENT}40` : "1px solid var(--pn-border-subtle)",
        marginBottom: "6px",
      }}
    >
      <div className="text-[0.8rem] font-medium truncate" style={{ color: "var(--pn-text-primary)" }}>
        {note.title}
      </div>
      <div
        className="text-[0.65rem] font-mono truncate mt-0.5"
        style={{ color: "var(--pn-text-tertiary)" }}
      >
        {note.path}
      </div>
      {note.content && (
        <div
          className="text-[0.7rem] mt-1 line-clamp-2"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          {note.content.slice(0, 120)}
        </div>
      )}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {note.tags.slice(0, 4).map((t) => (
            <TagBadge key={t} tag={t} />
          ))}
        </div>
      )}
    </button>
  );
}

function CreateNoteModal({ onClose }: { onClose: () => void }) {
  const createNote = useObsidianVaultStore((s) => s.createNote);
  const loadRecent = useObsidianVaultStore((s) => s.loadRecent);
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!path.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createNote(path.trim(), content);
      await loadRecent();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="rounded-xl p-5 w-[480px] shadow-2xl"
        style={{ background: "var(--pn-surface-2)", border: "1px solid var(--pn-border-default)" }}
      >
        <h2 className="text-[0.9rem] font-semibold mb-4" style={{ color: "var(--pn-text-primary)" }}>
          Create Vault Note
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[0.7rem] mb-1" style={{ color: "var(--pn-text-tertiary)" }}>
              Path (relative to vault root, e.g. "Notes/My Note.md")
            </label>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="Notes/My Note.md"
              className="w-full text-[0.8rem] px-3 py-2 rounded-lg outline-none"
              style={{
                background: "var(--pn-surface-3)",
                color: "var(--pn-text-primary)",
                border: "1px solid var(--pn-border-default)",
              }}
            />
          </div>
          <div>
            <label className="block text-[0.7rem] mb-1" style={{ color: "var(--pn-text-tertiary)" }}>
              Content (markdown)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full text-[0.8rem] px-3 py-2 rounded-lg outline-none resize-none font-mono"
              style={{
                background: "var(--pn-surface-3)",
                color: "var(--pn-text-primary)",
                border: "1px solid var(--pn-border-default)",
              }}
            />
          </div>
          {error && (
            <div className="text-[0.75rem]" style={{ color: "#f87171" }}>
              {error}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-[0.8rem] px-4 py-1.5 rounded-lg"
              style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-secondary)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!path.trim() || saving}
              className="text-[0.8rem] px-4 py-1.5 rounded-lg font-medium disabled:opacity-40"
              style={{ background: ACCENT, color: "#fff" }}
            >
              {saving ? "Saving\u2026" : "Create Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VaultBrowser() {
  const notes = useObsidianVaultStore((s) => s.notes);
  const searchResults = useObsidianVaultStore((s) => s.searchResults);
  const selectedNote = useObsidianVaultStore((s) => s.selectedNote);
  const loading = useObsidianVaultStore((s) => s.loading);
  const searchLoading = useObsidianVaultStore((s) => s.searchLoading);
  const activeTab = useObsidianVaultStore((s) => s.activeTab);
  const loadRecent = useObsidianVaultStore((s) => s.loadRecent);
  const search = useObsidianVaultStore((s) => s.search);
  const loadNote = useObsidianVaultStore((s) => s.loadNote);
  const setTab = useObsidianVaultStore((s) => s.setTab);
  const clearSelection = useObsidianVaultStore((s) => s.clearSelection);

  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadRecent();
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) search(query.trim());
  }

  const displayList = activeTab === "search" ? searchResults : notes;

  return (
    <Shell>
      {showCreate && <CreateNoteModal onClose={() => setShowCreate(false)} />}
      <div className="flex h-full overflow-hidden">
        {/* Left panel */}
        <div
          className="flex flex-col"
          style={{
            width: "340px",
            minWidth: "280px",
            borderRight: "1px solid var(--pn-border-subtle)",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: ACCENT }}>📚</span>
              <span className="text-[0.85rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                Obsidian Vault
              </span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="text-[0.7rem] px-2.5 py-1 rounded-lg font-medium"
              style={{ background: ACCENT, color: "#fff" }}
            >
              + New Note
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 shrink-0">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vault\u2026"
                className="flex-1 text-[0.78rem] px-3 py-1.5 rounded-lg outline-none"
                style={{
                  background: "var(--pn-surface-3)",
                  color: "var(--pn-text-primary)",
                  border: "1px solid var(--pn-border-default)",
                }}
              />
              <button
                type="submit"
                disabled={!query.trim() || searchLoading}
                className="text-[0.75rem] px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
                style={{ background: ACCENT, color: "#fff" }}
              >
                {searchLoading ? "\u2026" : "Go"}
              </button>
            </form>
          </div>

          {/* Tabs */}
          <div className="flex px-3 gap-2 shrink-0 pb-2">
            {(["recent", "search"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                className="text-[0.72rem] px-3 py-1 rounded-lg capitalize font-medium"
                style={{
                  background: activeTab === tab ? ACCENT : "var(--pn-surface-3)",
                  color: activeTab === tab ? "#fff" : "var(--pn-text-secondary)",
                }}
              >
                {tab === "recent"
                  ? "Recent"
                  : `Search${searchResults.length ? ` (${searchResults.length})` : ""}`}
              </button>
            ))}
          </div>

          {/* Note list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading && displayList.length === 0 && (
              <div
                className="py-8 text-center text-[0.75rem]"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                Loading\u2026
              </div>
            )}
            {!loading && displayList.length === 0 && (
              <div
                className="py-8 text-center text-[0.75rem]"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                {activeTab === "search" ? "No results" : "No notes found"}
              </div>
            )}
            {displayList.map((note) => (
              <NoteCard
                key={note.path}
                note={note}
                active={selectedNote?.path === note.path}
                onClick={() => {
                  clearSelection();
                  loadNote(note.path);
                }}
              />
            ))}
          </div>
        </div>

        {/* Right panel — note content */}
        <div className="flex-1 overflow-y-auto p-5">
          {!selectedNote ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3" style={{ opacity: 0.3 }}>
                  📚
                </div>
                <div className="text-[0.8rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                  Select a note to read it
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1
                    className="text-[1.1rem] font-bold"
                    style={{ color: "var(--pn-text-primary)" }}
                  >
                    {selectedNote.title}
                  </h1>
                  <div
                    className="text-[0.65rem] font-mono mt-0.5"
                    style={{ color: "var(--pn-text-tertiary)" }}
                  >
                    {selectedNote.path}
                  </div>
                  {selectedNote.tags && selectedNote.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedNote.tags.map((t) => (
                        <TagBadge key={t} tag={t} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <pre
                className="whitespace-pre-wrap text-[0.8rem] leading-relaxed font-sans"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {selectedNote.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
