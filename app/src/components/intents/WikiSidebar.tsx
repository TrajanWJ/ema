import type { WikiNamespace } from "@/stores/wiki-engine-store";
import { useWikiEngineStore } from "@/stores/wiki-engine-store";
import type { VaultNote } from "@/types/vault";

const isStandalone =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("mode") === "standalone";

export function WikiSidebar() {
  const namespaces = useWikiEngineStore((s) => s.namespaces);
  const activeNamespace = useWikiEngineStore((s) => s.activeNamespace);
  const selectedPath = useWikiEngineStore((s) => s.selectedPath);

  const notes = useWikiEngineStore((s) => s.getNotesForNamespace(s.activeNamespace));

  return (
    <div className="flex flex-col h-full">
      {/* Namespace list */}
      <div
        className="shrink-0 px-2 py-2"
        style={{ borderBottom: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}` }}
      >
        <div
          className="text-[0.55rem] uppercase tracking-wider font-semibold px-2 mb-1"
          style={{ color: isStandalone ? "#72777d" : "var(--pn-text-muted)" }}
        >
          Namespaces
        </div>
        <button
          type="button"
          onClick={() => useWikiEngineStore.getState().setNamespace(null)}
          className="w-full text-left px-2 py-1 rounded text-[0.68rem] transition-colors"
          style={{
            background: activeNamespace === null
              ? isStandalone ? "rgba(51,102,204,0.08)" : "rgba(167,139,250,0.1)"
              : "transparent",
            color: activeNamespace === null
              ? isStandalone ? "#3366cc" : "#a78bfa"
              : isStandalone ? "#252525" : "var(--pn-text-secondary)",
          }}
        >
          All ({namespaces.reduce((s, n) => s + n.count, 0)})
        </button>
        <div className="max-h-[200px] overflow-auto space-y-0.5 mt-0.5">
          {namespaces.map((ns) => (
            <NamespaceButton key={ns.name} ns={ns} active={activeNamespace === ns.name} />
          ))}
        </div>
      </div>

      {/* Page list for active namespace */}
      <div className="flex-1 overflow-auto px-1 py-1">
        <div
          className="text-[0.55rem] uppercase tracking-wider font-semibold px-2 mb-1 mt-1"
          style={{ color: isStandalone ? "#72777d" : "var(--pn-text-muted)" }}
        >
          Pages ({notes.length})
        </div>
        {notes.length === 0 ? (
          <div className="px-2 py-3 text-center text-[0.65rem]"
            style={{ color: isStandalone ? "#a2a9b1" : "var(--pn-text-muted)" }}>
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

function NamespaceButton({
  ns,
  active,
}: {
  readonly ns: WikiNamespace;
  readonly active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => useWikiEngineStore.getState().setNamespace(ns.name)}
      className="w-full text-left px-2 py-1 rounded text-[0.65rem] flex items-center gap-1.5 transition-colors"
      style={{
        background: active
          ? isStandalone ? "rgba(51,102,204,0.08)" : `${ns.color}15`
          : "transparent",
        color: active
          ? ns.color
          : isStandalone ? "#252525" : "var(--pn-text-secondary)",
      }}
    >
      <span className="text-[0.7rem]">{ns.icon}</span>
      <span className="flex-1 truncate">{ns.name}</span>
      <span
        className="text-[0.5rem] tabular-nums"
        style={{ color: isStandalone ? "#a2a9b1" : "var(--pn-text-muted)" }}
      >
        {ns.count}
      </span>
    </button>
  );
}

function PageButton({
  note,
  selected,
}: {
  readonly note: VaultNote;
  readonly selected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => useWikiEngineStore.getState().selectPage(note.file_path)}
      className="w-full text-left px-2 py-0.5 rounded text-[0.65rem] truncate transition-colors"
      style={{
        background: selected
          ? isStandalone ? "rgba(51,102,204,0.08)" : "rgba(167,139,250,0.1)"
          : "transparent",
        color: selected
          ? isStandalone ? "#3366cc" : "#a78bfa"
          : isStandalone ? "#252525" : "var(--pn-text-secondary)",
      }}
    >
      {note.title || note.file_path.split("/").pop()?.replace(".md", "")}
    </button>
  );
}
