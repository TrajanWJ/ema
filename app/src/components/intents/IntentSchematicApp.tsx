import { useEffect, useState, useMemo } from "react";
import { useWikiEngineStore } from "@/stores/wiki-engine-store";
import { WikiSidebar } from "./WikiSidebar";
import { WikiEditor } from "./tiptap/WikiEditor";
import { IntentChat } from "./IntentChat";
import { WikiPageRenderer } from "./WikiPageRenderer";
import { STATUS_COLORS, LEVEL_LABELS } from "@/types/intents";
import "./wiki-engine.css";

const isStandalone =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("mode") === "standalone";

export function IntentSchematicApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [tocOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const namespaces = useWikiEngineStore((s) => s.namespaces);
  const selectedPath = useWikiEngineStore((s) => s.selectedPath);
  const selectedContent = useWikiEngineStore((s) => s.selectedContent);
  const selectedIntent = useWikiEngineStore((s) => s.selectedIntent);
  const editContent = useWikiEngineStore((s) => s.editContent);
  const searchQuery = useWikiEngineStore((s) => s.searchQuery);
  const allNotes = useWikiEngineStore((s) => s.allNotes);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await useWikiEngineStore.getState().loadWiki();
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      }
      if (!cancelled) setReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const toc = useMemo(() => {
    if (!selectedContent) return [];
    const headings: { level: number; text: string }[] = [];
    for (const line of selectedContent.split("\n")) {
      const m = line.match(/^(#{1,4})\s+(.+)$/);
      if (m) headings.push({ level: m[1].length, text: m[2].replace(/\*\*/g, "").replace(/`/g, "") });
    }
    return headings;
  }, [selectedContent]);

  const frontmatter = useMemo(() => {
    if (!selectedContent) return {};
    const match = selectedContent.match(/^---\n([\s\S]*?)---/m);
    if (!match) return {};
    const fm: Record<string, string> = {};
    for (const line of match[1].split("\n")) {
      const m = line.match(/^(\w[\w_-]*):\s*(.+)$/);
      if (m) fm[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
    return fm;
  }, [selectedContent]);

  function handleNavigate(slug: string) {
    const match = allNotes.find((n) => {
      const basename = n.file_path?.split("/").pop()?.replace(".md", "") ?? "";
      const noteSlug = basename.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return noteSlug === slug;
    });
    if (match) {
      useWikiEngineStore.getState().selectPage(match.file_path);
      setEditMode(false);
    }
  }

  function handleSave() {
    useWikiEngineStore.getState().savePage();
    setEditMode(false);
  }

  if (!ready) {
    return (
      <div
        className={`h-screen flex items-center justify-center ${isStandalone ? "wiki-standalone" : ""}`}
        style={{ background: isStandalone ? "#fff" : "var(--color-pn-base)" }}
      >
        <span style={{ color: isStandalone ? "#72777d" : "var(--pn-text-secondary)", fontSize: "0.85rem" }}>
          Loading wiki...
        </span>
      </div>
    );
  }

  return (
    <div
      className={`h-screen flex flex-col ${isStandalone ? "wiki-standalone" : ""}`}
      style={{ background: isStandalone ? "#fff" : "var(--color-pn-base)" }}
    >
      {/* Header */}
      <header
        className="shrink-0 flex items-center justify-between px-5"
        style={{
          height: "46px",
          background: isStandalone ? "#f8f9fa" : "var(--color-pn-surface-1)",
          borderBottom: `1px solid ${isStandalone ? "#a7d7f9" : "var(--pn-border-default)"}`,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="text-[1rem] w-7 h-7 flex items-center justify-center rounded"
            style={{ color: isStandalone ? "#3366cc" : "#a78bfa" }}
          >
            ☰
          </button>
          <span
            className="text-[1.1rem] font-bold"
            style={{
              color: isStandalone ? "#000" : "#a78bfa",
              fontFamily: isStandalone ? "'Linux Libertine', Georgia, serif" : "inherit",
            }}
          >
            {isStandalone ? "EMA Wiki" : "EMA"}
          </span>
          {!isStandalone && (
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
              Wiki · {allNotes.length} pages · {namespaces.length} namespaces
            </span>
          )}
        </div>

        <div className="flex-1 max-w-lg mx-5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => useWikiEngineStore.getState().setSearch(e.target.value)}
            placeholder="Search wiki..."
            className="w-full text-[0.8rem] px-3 py-1.5 rounded-lg outline-none"
            style={{
              background: isStandalone ? "#fff" : "var(--pn-field-bg)",
              color: isStandalone ? "#252525" : "var(--pn-text-primary)",
              border: `1px solid ${isStandalone ? "#a2a9b1" : "var(--pn-border-default)"}`,
            }}
          />
        </div>

        <div className="flex items-center gap-1">
          {selectedPath && (
            <>
              <TabBtn label="Read" active={!editMode} onClick={() => setEditMode(false)} />
              <TabBtn
                label="Edit"
                active={editMode}
                onClick={() => {
                  useWikiEngineStore.getState().setEditMode(true);
                  setEditMode(true);
                }}
              />
              <TabBtn label="Talk" active={chatOpen} accent onClick={() => setChatOpen((o) => !o)} />
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="px-5 py-2 text-[0.7rem]" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar: namespaces + page list */}
        {sidebarOpen && (
          <aside
            className="shrink-0 overflow-hidden flex flex-col"
            style={{
              width: "250px",
              background: isStandalone ? "#f8f9fa" : "var(--color-pn-surface-1)",
              borderRight: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}`,
            }}
          >
            <WikiSidebar />
          </aside>
        )}

        {/* Article area */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Breadcrumb */}
          {selectedPath && (
            <div
              className="shrink-0 px-6 py-1.5 flex items-center gap-2 text-[0.7rem]"
              style={{ borderBottom: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}` }}
            >
              <Breadcrumb path={selectedPath} />
              {selectedIntent && (
                <span
                  className="ml-auto px-2 py-0.5 rounded-full text-[0.6rem]"
                  style={{
                    background: `${STATUS_COLORS[selectedIntent.status] ?? "#64748b"}20`,
                    color: STATUS_COLORS[selectedIntent.status] ?? "#64748b",
                  }}
                >
                  {selectedIntent.status} · {LEVEL_LABELS[selectedIntent.level]}
                </span>
              )}
            </div>
          )}

          <div className="flex-1 flex min-h-0">
            {/* Content */}
            <div className="flex-1 overflow-auto">
              <div style={{ maxWidth: "860px", margin: "0 auto", padding: "1.5rem 2rem" }}>
                {!selectedPath ? (
                  <MainPage />
                ) : editMode ? (
                  <div className="wiki-article">
                    <WikiEditor
                      content={editContent || selectedContent || ""}
                      editable
                      onUpdate={(html) => useWikiEngineStore.getState().setEditContent(html)}
                      onNavigate={handleNavigate}
                    />
                    <div className="flex justify-end mt-4 gap-2">
                      <button type="button" onClick={() => setEditMode(false)}
                        className="px-4 py-1.5 rounded text-[0.75rem]"
                        style={{ color: isStandalone ? "#72777d" : "var(--pn-text-tertiary)" }}>
                        Cancel
                      </button>
                      <button type="button" onClick={handleSave}
                        className="px-4 py-1.5 rounded text-[0.75rem] font-medium"
                        style={{ background: isStandalone ? "#3366cc" : "rgba(34,197,94,0.15)", color: isStandalone ? "#fff" : "#22c55e" }}>
                        Save changes
                      </button>
                    </div>
                  </div>
                ) : selectedContent ? (
                  <div className="wiki-article">
                    {frontmatter.intent_level && (
                      <Infobox frontmatter={frontmatter} intent={selectedIntent} />
                    )}
                    <WikiPageRenderer content={selectedContent} onNavigate={handleNavigate} />
                    {frontmatter.tags && (
                      <div className="wiki-categories">
                        <span style={{ fontSize: "0.6rem", color: isStandalone ? "#54595d" : "var(--pn-text-muted)" }}>
                          Categories:
                        </span>
                        {parseTags(frontmatter.tags).map((tag) => (
                          <span key={tag} className="wiki-category-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <span style={{ fontSize: "0.8rem", color: isStandalone ? "#72777d" : "var(--pn-text-tertiary)" }}>
                      Loading...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar: TOC or Chat */}
            {(tocOpen || chatOpen) && selectedPath && (
              <aside
                className="shrink-0 overflow-auto"
                style={{
                  width: chatOpen ? "320px" : "200px",
                  borderLeft: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}`,
                  background: isStandalone ? "#f8f9fa" : "var(--color-pn-surface-1)",
                }}
              >
                {chatOpen ? (
                  <IntentChat />
                ) : (
                  <div className="p-3">
                    <div className="text-[0.55rem] uppercase tracking-wider font-semibold mb-2"
                      style={{ color: isStandalone ? "#72777d" : "var(--pn-text-muted)" }}>
                      Contents
                    </div>
                    <nav className="wiki-toc">
                      {toc.map((h, i) => (
                        <button key={i} type="button" className="wiki-toc-item"
                          style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
                          {h.text}
                        </button>
                      ))}
                    </nav>
                  </div>
                )}
              </aside>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      {selectedPath && (
        <footer
          className="shrink-0 px-6 py-1.5 flex items-center justify-between text-[0.55rem]"
          style={{
            borderTop: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}`,
            color: isStandalone ? "#a2a9b1" : "var(--pn-text-muted)",
          }}
        >
          <span>{selectedPath}</span>
          <span>EMA Wiki · {allNotes.length} pages</span>
        </footer>
      )}
    </div>
  );
}

/* ── Subcomponents ───────────────────────────────── */

function MainPage() {
  const namespaces = useWikiEngineStore((s) => s.namespaces);
  const allNotes = useWikiEngineStore((s) => s.allNotes);

  return (
    <div className="wiki-article">
      <h1>EMA Wiki</h1>
      <p>
        Personal knowledge engine with {allNotes.length} pages across {namespaces.length} namespaces.
        Browse by namespace or search to find any page.
      </p>

      <h2>Namespaces</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        {namespaces.map((ns) => (
          <button
            key={ns.name}
            type="button"
            onClick={() => useWikiEngineStore.getState().setNamespace(ns.name)}
            className="text-left p-3 rounded-lg transition-colors"
            style={{
              background: isStandalone ? "#f8f9fa" : "rgba(255,255,255,0.02)",
              border: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[1rem]">{ns.icon}</span>
              <span className="text-[0.8rem] font-medium" style={{ color: ns.color }}>
                {ns.name}
              </span>
              <span className="text-[0.6rem] ml-auto" style={{ color: isStandalone ? "#a2a9b1" : "var(--pn-text-muted)" }}>
                {ns.count} pages
              </span>
            </div>
            {ns.description && (
              <span className="text-[0.65rem]" style={{ color: isStandalone ? "#72777d" : "var(--pn-text-muted)" }}>
                {ns.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function Infobox({
  frontmatter,
  intent,
}: {
  readonly frontmatter: Record<string, string>;
  readonly intent: import("@/types/intents").IntentNode | null;
}) {
  const level = parseInt(frontmatter.intent_level ?? "4");
  const status = frontmatter.intent_status ?? "planned";
  const kind = frontmatter.intent_kind ?? "task";
  const priority = frontmatter.intent_priority ?? "3";
  const statusColor = STATUS_COLORS[status] ?? "#64748b";

  return (
    <div className="wiki-infobox">
      <div className="wiki-infobox-title">{frontmatter.title ?? "Intent"}</div>
      <Row label="Type" value={LEVEL_LABELS[level] ?? `L${level}`} />
      <Row label="Kind" value={kind} />
      <div className="wiki-infobox-row">
        <span className="wiki-infobox-label">Status</span>
        <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: "3px", background: `${statusColor}20`, color: statusColor }}>
          {status}
        </span>
      </div>
      <Row label="Priority" value={`P${priority}`} />
      {intent && intent.completion_pct > 0 && (
        <div style={{ padding: "0.3rem 0" }}>
          <Row label="Progress" value={`${intent.completion_pct}%`} />
          <div style={{ height: "3px", borderRadius: "2px", background: isStandalone ? "#eaecf0" : "rgba(255,255,255,0.06)", marginTop: "0.2rem" }}>
            <div style={{ height: "100%", borderRadius: "2px", width: `${intent.completion_pct}%`, background: statusColor }} />
          </div>
        </div>
      )}
      {frontmatter.project && <Row label="Project" value={frontmatter.project} />}
      {frontmatter.parent && <Row label="Parent" value={frontmatter.parent.replace(/\[\[|\]\]/g, "")} />}
    </div>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="wiki-infobox-row">
      <span className="wiki-infobox-label">{label}</span>
      <span className="wiki-infobox-value">{value}</span>
    </div>
  );
}

function Breadcrumb({ path }: { readonly path: string }) {
  const parts = path.replace(/\.md$/, "").split("/");
  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span style={{ color: isStandalone ? "#a2a9b1" : "var(--pn-text-muted)" }}>/</span>}
          <span style={{
            color: i === parts.length - 1
              ? isStandalone ? "#252525" : "var(--pn-text-primary)"
              : isStandalone ? "#72777d" : "var(--pn-text-tertiary)",
          }}>
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

function TabBtn({ label, active, accent, onClick }: {
  readonly label: string;
  readonly active: boolean;
  readonly accent?: boolean;
  readonly onClick: () => void;
}) {
  const activeColor = isStandalone ? "#3366cc" : accent ? "#a78bfa" : "var(--pn-text-primary)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded text-[0.7rem] font-medium transition-colors"
      style={{
        background: active
          ? isStandalone ? "rgba(51,102,204,0.1)" : accent ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.08)"
          : "transparent",
        color: active ? activeColor : isStandalone ? "#72777d" : "var(--pn-text-tertiary)",
        borderBottom: active ? `2px solid ${activeColor}` : "2px solid transparent",
      }}
    >
      {label}
    </button>
  );
}

function parseTags(tagStr: string): string[] {
  try {
    const parsed = JSON.parse(tagStr);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON */ }
  return tagStr.replace(/[\[\]"]/g, "").split(",").map((t) => t.trim()).filter(Boolean);
}
