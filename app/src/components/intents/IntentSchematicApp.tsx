import { useEffect, useState, useMemo } from "react";
import { useIntentSchematicStore } from "@/stores/intent-schematic-store";
import { IntentNav, IntentMetadata } from "./IntentNav";
import { WikiEditor } from "./tiptap/WikiEditor";
import { IntentChat } from "./IntentChat";
import { WikiPageRenderer } from "./WikiPageRenderer";
import type { IntentNode } from "@/types/intents";
import { LEVEL_LABELS, STATUS_COLORS } from "@/types/intents";
import "./wiki-engine.css";

// Detect standalone mode from query param: ?mode=standalone
const isStandalone =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("mode") === "standalone";

export function IntentSchematicApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [tocOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState(false);

  const intentTree = useIntentSchematicStore((s) => s.intentTree);
  const selectedPath = useIntentSchematicStore((s) => s.selectedPath);
  const selectedContent = useIntentSchematicStore((s) => s.selectedContent);
  const selectedIntent = useIntentSchematicStore((s) => s.selectedIntent);
  const editContent = useIntentSchematicStore((s) => s.editContent);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await useIntentSchematicStore.getState().loadTree();
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      }
      if (!cancelled) setReady(true);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Extract TOC from content
  const toc = useMemo(() => {
    if (!selectedContent) return [];
    const headings: { level: number; text: string; id: string }[] = [];
    const lines = selectedContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^(#{1,4})\s+(.+)$/);
      if (match) {
        const text = match[2].replace(/\*\*/g, "").replace(/`/g, "");
        headings.push({
          level: match[1].length,
          text,
          id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        });
      }
    }
    return headings;
  }, [selectedContent]);

  // Parse frontmatter for infobox
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

  function handleSelectIntent(slug: string) {
    const notes = useIntentSchematicStore.getState().wikiNotes;
    const match = notes.find((n) => {
      const basename =
        n.file_path.split("/").pop()?.replace(".md", "") ?? "";
      const noteSlug = basename
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return noteSlug === slug;
    });
    if (match) {
      useIntentSchematicStore.getState().selectPage(match.file_path);
      setEditMode(false);
    }
  }

  function handleSave() {
    useIntentSchematicStore.getState().savePage();
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

  const wrapperClass = isStandalone ? "wiki-standalone" : "";

  return (
    <div
      className={`h-screen flex flex-col ${wrapperClass}`}
      style={{ background: isStandalone ? "#fff" : "var(--color-pn-base)" }}
    >
      {/* ── Header (Wikipedia-style) ────────────────────── */}
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
            style={{
              color: sidebarOpen
                ? isStandalone ? "#3366cc" : "#a78bfa"
                : isStandalone ? "#72777d" : "var(--pn-text-tertiary)",
            }}
          >
            ☰
          </button>
          <span
            className="text-[1rem] font-bold"
            style={{
              color: isStandalone ? "#000" : "#a78bfa",
              fontFamily: isStandalone ? "'Linux Libertine', Georgia, serif" : "inherit",
            }}
          >
            {isStandalone ? "EMA Wiki" : "EMA"}
          </span>
          {!isStandalone && (
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
              Intent Schematic
            </span>
          )}
        </div>

        <div className="flex-1 max-w-md mx-5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
              <TabBtn
                label="Read"
                active={!editMode}
                standalone={isStandalone}
                onClick={() => setEditMode(false)}
              />
              <TabBtn
                label="Edit"
                active={editMode}
                standalone={isStandalone}
                onClick={() => {
                  useIntentSchematicStore.getState().setEditMode(true);
                  setEditMode(true);
                }}
              />
              <TabBtn
                label="Talk"
                active={chatOpen}
                standalone={isStandalone}
                accent
                onClick={() => setChatOpen((o) => !o)}
              />
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="px-5 py-2 text-[0.7rem]" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* ── Main Content ────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside
            className="shrink-0 overflow-auto flex flex-col"
            style={{
              width: "250px",
              background: isStandalone ? "#f8f9fa" : "var(--color-pn-surface-1)",
              borderRight: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}`,
            }}
          >
            <IntentNav
              tree={filterTree(intentTree, searchQuery)}
              selectedSlug={selectedIntent?.slug ?? null}
              onSelect={handleSelectIntent}
            />
            <IntentMetadata intent={selectedIntent} />
          </aside>
        )}

        {/* Article */}
        <main className="flex-1 min-w-0 flex flex-col">
          {selectedPath && (
            <div
              className="shrink-0 px-6 py-1.5 flex items-center gap-2 text-[0.7rem]"
              style={{
                borderBottom: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}`,
              }}
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
            {/* Article body */}
            <div className="flex-1 overflow-auto">
              <div style={{ maxWidth: "860px", margin: "0 auto", padding: "1.5rem 2rem" }}>
                {!selectedPath ? (
                  <MainPage intentTree={intentTree} onSelect={handleSelectIntent} standalone={isStandalone} />
                ) : editMode ? (
                  <div className="wiki-article">
                    <WikiEditor
                      content={editContent || selectedContent || ""}
                      editable={true}
                      onUpdate={(html) => useIntentSchematicStore.getState().setEditContent(html)}
                      onNavigate={handleSelectIntent}
                    />
                    <div className="flex justify-end mt-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMode(false)}
                        className="px-4 py-1.5 rounded text-[0.75rem]"
                        style={{ color: isStandalone ? "#72777d" : "var(--pn-text-tertiary)" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="px-4 py-1.5 rounded text-[0.75rem] font-medium"
                        style={{
                          background: isStandalone ? "#3366cc" : "rgba(34,197,94,0.15)",
                          color: isStandalone ? "#fff" : "#22c55e",
                        }}
                      >
                        Save changes
                      </button>
                    </div>
                  </div>
                ) : selectedContent ? (
                  <div className="wiki-article">
                    {/* Wikipedia-style infobox */}
                    {frontmatter.intent_level && (
                      <Infobox frontmatter={frontmatter} intent={selectedIntent} standalone={isStandalone} />
                    )}
                    <WikiPageRenderer content={selectedContent} onNavigate={handleSelectIntent} />
                    {/* Categories footer */}
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
                    <span style={{ color: isStandalone ? "#72777d" : "var(--pn-text-tertiary)", fontSize: "0.8rem" }}>
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
                    <div
                      className="text-[0.6rem] uppercase tracking-wider font-semibold mb-2"
                      style={{ color: isStandalone ? "#72777d" : "var(--pn-text-muted)" }}
                    >
                      Contents
                    </div>
                    <nav className="wiki-toc">
                      {toc.map((h, i) => (
                        <button
                          key={i}
                          type="button"
                          className="wiki-toc-item"
                          style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                        >
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

      {/* ── Footer ──────────────────────────────────────── */}
      {selectedPath && (
        <footer
          className="shrink-0 px-6 py-1.5 flex items-center justify-between text-[0.55rem]"
          style={{
            borderTop: `1px solid ${isStandalone ? "#eaecf0" : "var(--pn-border-subtle)"}`,
            color: isStandalone ? "#a2a9b1" : "var(--pn-text-muted)",
          }}
        >
          <span>
            {selectedPath.replace("wiki/Intents/", "").replace(".md", "")}
          </span>
          <span>EMA Wiki Engine · Powered by Tiptap + Codex</span>
        </footer>
      )}
    </div>
  );
}

/* ── Subcomponents ──────────────────────────────────────── */

function Infobox({
  frontmatter,
  intent,
  standalone,
}: {
  readonly frontmatter: Record<string, string>;
  readonly intent: IntentNode | null;
  readonly standalone: boolean;
}) {
  const level = parseInt(frontmatter.intent_level ?? "4");
  const status = frontmatter.intent_status ?? "planned";
  const kind = frontmatter.intent_kind ?? "task";
  const priority = frontmatter.intent_priority ?? "3";
  const statusColor = STATUS_COLORS[status] ?? "#64748b";

  return (
    <div className="wiki-infobox">
      <div className="wiki-infobox-title">
        {frontmatter.title ?? "Intent"}
      </div>
      <Row label="Type" value={LEVEL_LABELS[level] ?? `L${level}`} />
      <Row label="Kind" value={kind} />
      <div className="wiki-infobox-row">
        <span className="wiki-infobox-label">Status</span>
        <span
          style={{
            fontSize: "0.65rem",
            padding: "0.1rem 0.4rem",
            borderRadius: "3px",
            background: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {status}
        </span>
      </div>
      <Row label="Priority" value={`P${priority}`} />
      {intent && intent.completion_pct > 0 && (
        <div style={{ padding: "0.3rem 0" }}>
          <div className="wiki-infobox-row">
            <span className="wiki-infobox-label">Progress</span>
            <span className="wiki-infobox-value">{intent.completion_pct}%</span>
          </div>
          <div
            style={{
              height: "3px",
              borderRadius: "2px",
              background: standalone ? "#eaecf0" : "rgba(255,255,255,0.06)",
              marginTop: "0.2rem",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: "2px",
                width: `${intent.completion_pct}%`,
                background: statusColor,
              }}
            />
          </div>
        </div>
      )}
      {frontmatter.project && <Row label="Project" value={frontmatter.project} />}
      {frontmatter.parent && (
        <Row label="Parent" value={frontmatter.parent.replace(/\[\[|\]\]/g, "")} />
      )}
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
  const parts = path.replace("wiki/Intents/", "").replace(".md", "").split("/");
  return (
    <div className="flex items-center gap-1">
      <span style={{ color: isStandalone ? "#3366cc" : "#a78bfa" }}>Intents</span>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          <span style={{ color: isStandalone ? "#a2a9b1" : "var(--pn-text-muted)" }}>/</span>
          <span
            style={{
              color: i === parts.length - 1
                ? isStandalone ? "#252525" : "var(--pn-text-primary)"
                : isStandalone ? "#72777d" : "var(--pn-text-tertiary)",
            }}
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

function TabBtn({
  label,
  active,
  accent,
  standalone,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly accent?: boolean;
  readonly standalone: boolean;
  readonly onClick: () => void;
}) {
  const activeColor = standalone ? "#3366cc" : accent ? "#a78bfa" : "var(--pn-text-primary)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded text-[0.7rem] font-medium transition-colors"
      style={{
        background: active
          ? standalone ? "rgba(51,102,204,0.1)" : accent ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.08)"
          : "transparent",
        color: active ? activeColor : standalone ? "#72777d" : "var(--pn-text-tertiary)",
        borderBottom: active ? `2px solid ${activeColor}` : "2px solid transparent",
      }}
    >
      {label}
    </button>
  );
}

function MainPage({
  intentTree,
  onSelect,
  standalone,
}: {
  readonly intentTree: IntentNode[];
  readonly onSelect: (slug: string) => void;
  readonly standalone: boolean;
}) {
  const flat = flattenAll(intentTree);
  const byLevel = new Map<number, IntentNode[]>();
  flat.forEach((n) => {
    const list = byLevel.get(n.level) ?? [];
    list.push(n);
    byLevel.set(n.level, list);
  });

  return (
    <div className="wiki-article">
      <h1>Intent Schematic</h1>
      <p>
        Navigable map of everything EMA is trying to do. Each intent is a wiki page.
        The hierarchy flows from vision down to executable tasks.
      </p>

      {[0, 1, 2, 3, 4].map((level) => {
        const items = byLevel.get(level);
        if (!items?.length) return null;
        return (
          <section key={level}>
            <h2>{LEVEL_LABELS[level]}s</h2>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.slug)}
                    className="wiki-link"
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                  >
                    {item.title}
                  </button>
                  <span style={{ fontSize: "0.7rem", marginLeft: "0.5rem", color: standalone ? "#72777d" : "var(--pn-text-muted)" }}>
                    — {item.kind}, {item.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function parseTags(tagStr: string): string[] {
  try {
    const parsed = JSON.parse(tagStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* not JSON */
  }
  return tagStr.replace(/[\[\]"]/g, "").split(",").map((t) => t.trim()).filter(Boolean);
}

function flattenAll(nodes: IntentNode[]): IntentNode[] {
  const result: IntentNode[] = [];
  for (const n of nodes) {
    result.push(n);
    if (n.children?.length) result.push(...flattenAll(n.children));
  }
  return result;
}

function filterTree(tree: IntentNode[], query: string): IntentNode[] {
  if (!query.trim()) return tree;
  const q = query.toLowerCase();
  return tree.map((n) => filterNode(n, q)).filter((n): n is IntentNode => n !== null);
}

function filterNode(node: IntentNode, q: string): IntentNode | null {
  const matches = node.title.toLowerCase().includes(q) || node.slug.includes(q);
  const kids = (node.children ?? []).map((c) => filterNode(c, q)).filter((c): c is IntentNode => c !== null);
  if (matches || kids.length) return { ...node, children: kids };
  return null;
}
