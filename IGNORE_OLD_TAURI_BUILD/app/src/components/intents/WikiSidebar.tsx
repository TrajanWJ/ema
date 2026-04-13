import type { WikiNamespace } from "@/stores/wiki-engine-store";
import { useWikiEngineStore } from "@/stores/wiki-engine-store";
import type { VaultNote } from "@/types/vault";

export function WikiSidebar() {
  const namespaces = useWikiEngineStore((s) => s.namespaces);
  const activeNamespace = useWikiEngineStore((s) => s.activeNamespace);
  const selectedPath = useWikiEngineStore((s) => s.selectedPath);
  const notes = useWikiEngineStore((s) => s.getNotesForNamespace(s.activeNamespace));

  return (
    <div className="flex flex-col h-full">
      {/* Namespace list */}
      <div className="shrink-0 px-2 py-2" style={{ borderBottom: "1px solid var(--border-color-subtle)" }}>
        <div className="wiki-sidebar-section-title">Namespaces</div>
        <button
          type="button"
          onClick={() => useWikiEngineStore.getState().setNamespace(null)}
          className={`wiki-sidebar-link ${activeNamespace === null ? "active" : ""}`}
        >
          All ({namespaces.reduce((s, n) => s + n.count, 0)})
        </button>
        <div className="max-h-[200px] overflow-auto space-y-0.5 mt-0.5">
          {namespaces.map((ns) => (
            <NamespaceButton key={ns.name} ns={ns} active={activeNamespace === ns.name} />
          ))}
        </div>
      </div>

      {/* Page list */}
      <div className="flex-1 overflow-auto px-1 py-1">
        <div className="wiki-sidebar-section-title" style={{ marginTop: "0.25rem" }}>
          Pages ({notes.length})
        </div>
        {notes.length === 0 ? (
          <div style={{ padding: "0.75rem 0.5rem", textAlign: "center", fontSize: "0.65rem", color: "var(--color-disabled)" }}>
            No pages found
          </div>
        ) : (
          notes.slice(0, 200).map((note) => (
            <PageButton key={note.id} note={note} selected={selectedPath === note.file_path} />
          ))
        )}
      </div>
    </div>
  );
}

function NamespaceButton({ ns, active }: { readonly ns: WikiNamespace; readonly active: boolean }) {
  return (
    <button
      type="button"
      onClick={() => useWikiEngineStore.getState().setNamespace(ns.name)}
      className={`wiki-sidebar-link ${active ? "active" : ""}`}
      style={active ? { color: ns.color } : undefined}
    >
      <span className="wiki-sidebar-link-icon">{ns.icon}</span>
      <span className="flex-1 truncate">{ns.name}</span>
      <span className="wiki-sidebar-link-count">{ns.count}</span>
    </button>
  );
}

function PageButton({ note, selected }: { readonly note: VaultNote; readonly selected: boolean }) {
  return (
    <button
      type="button"
      onClick={() => useWikiEngineStore.getState().selectPage(note.file_path)}
      className={`wiki-sidebar-link ${selected ? "active" : ""}`}
      style={{ fontSize: "0.65rem" }}
    >
      {note.title || note.file_path.split("/").pop()?.replace(".md", "")}
    </button>
  );
}
