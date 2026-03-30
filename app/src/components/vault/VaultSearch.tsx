import { useState } from "react";
import { useVaultStore } from "@/stores/vault-store";

interface VaultSearchProps {
  readonly onSelectNote: (path: string) => void;
}

export function VaultSearch({ onSelectNote }: VaultSearchProps) {
  const [query, setQuery] = useState("");
  const searchResults = useVaultStore((s) => s.searchResults);
  const search = useVaultStore((s) => s.search);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    search(trimmed);
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search vault..."
          className="flex-1 text-[0.8rem] px-3 py-2 rounded-lg outline-none"
          style={{
            background: "var(--pn-surface-3)",
            color: "var(--pn-text-primary)",
            border: "1px solid var(--pn-border-default)",
          }}
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="text-[0.8rem] px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-30"
          style={{ background: "#2dd4a8", color: "#fff" }}
        >
          Search
        </button>
      </form>

      {searchResults.length === 0 && query.trim() && (
        <div className="py-8 text-center">
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            No results found
          </span>
        </div>
      )}

      <div className="space-y-2">
        {searchResults.map((note) => (
          <button
            key={note.id}
            onClick={() => onSelectNote(note.file_path)}
            className="w-full text-left glass-surface rounded-lg p-3 transition-colors hover:bg-white/5"
          >
            <div className="text-[0.8rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
              {note.title}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
                {note.space}
              </span>
              <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                {note.word_count} words
              </span>
            </div>
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[0.55rem] px-1 py-0.5 rounded"
                    style={{ background: "rgba(45, 212, 168, 0.08)", color: "#2dd4a8" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
