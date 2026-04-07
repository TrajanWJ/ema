import { useEffect, useState } from "react";
import { useIntentSchematicStore } from "@/stores/intent-schematic-store";
import { IntentNav, IntentMetadata } from "./IntentNav";
import { WikiPageRenderer } from "./WikiPageRenderer";
import { IntentChat } from "./IntentChat";
import type { IntentNode } from "@/types/intents";
import { LEVEL_LABELS, STATUS_COLORS } from "@/types/intents";

export function IntentSchematicApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const intentTree = useIntentSchematicStore((s) => s.intentTree);
  const selectedPath = useIntentSchematicStore((s) => s.selectedPath);
  const selectedContent = useIntentSchematicStore((s) => s.selectedContent);
  const selectedIntent = useIntentSchematicStore((s) => s.selectedIntent);
  const editMode = useIntentSchematicStore((s) => s.editMode);
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
    return () => { cancelled = true; };
  }, []);

  function handleSelectIntent(slug: string) {
    const notes = useIntentSchematicStore.getState().wikiNotes;
    const match = notes.find((n) => {
      const basename = n.file_path.split("/").pop()?.replace(".md", "") ?? "";
      const noteSlug = basename.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return noteSlug === slug;
    });
    if (match) {
      useIntentSchematicStore.getState().selectPage(match.file_path);
    }
  }

  function handleToggleEdit() {
    if (editMode) {
      useIntentSchematicStore.getState().savePage();
    } else {
      useIntentSchematicStore.getState().setEditMode(true);
    }
  }

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--color-pn-base)" }}>
        <span className="text-[0.85rem]" style={{ color: "var(--pn-text-secondary)" }}>
          Loading intent schematic...
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-pn-base)" }}>
      {/* Wikipedia-style top bar */}
      <header
        className="shrink-0 flex items-center justify-between px-5"
        style={{
          height: "48px",
          background: "var(--color-pn-surface-1)",
          borderBottom: "1px solid var(--pn-border-default)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="text-[1rem] w-8 h-8 flex items-center justify-center rounded transition-colors"
            style={{
              color: sidebarOpen ? "#a78bfa" : "var(--pn-text-tertiary)",
              background: sidebarOpen ? "rgba(167,139,250,0.1)" : "transparent",
            }}
          >
            ☰
          </button>
          <span className="text-[1.1rem] font-bold tracking-wide" style={{ color: "#a78bfa" }}>
            EMA
          </span>
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
            Intent Schematic
          </span>
        </div>

        {/* Search bar — Wikipedia style */}
        <div className="flex-1 max-w-md mx-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search intents..."
            className="w-full text-[0.8rem] px-3 py-1.5 rounded-lg outline-none"
            style={{
              background: "var(--pn-field-bg)",
              color: "var(--pn-text-primary)",
              border: "1px solid var(--pn-border-default)",
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {selectedPath && (
            <>
              <TabButton
                label="Read"
                active={!editMode}
                onClick={() => useIntentSchematicStore.getState().setEditMode(false)}
              />
              <TabButton
                label="Edit"
                active={editMode}
                onClick={() => useIntentSchematicStore.getState().setEditMode(true)}
              />
              <span className="mx-1" style={{ color: "var(--pn-border-default)" }}>|</span>
            </>
          )}
          <TabButton
            label="Chat"
            active={chatOpen}
            accent
            onClick={() => setChatOpen((o) => !o)}
          />
        </div>
      </header>

      {error && (
        <div
          className="px-5 py-2 text-[0.7rem]"
          style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}
        >
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Wikipedia-style sidebar */}
        {sidebarOpen && (
          <aside
            className="shrink-0 overflow-auto flex flex-col"
            style={{
              width: "260px",
              background: "var(--color-pn-surface-1)",
              borderRight: "1px solid var(--pn-border-subtle)",
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

        {/* Wikipedia-style article area */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Breadcrumb bar */}
          {selectedPath && (
            <div
              className="shrink-0 px-6 py-2 flex items-center gap-2"
              style={{
                borderBottom: "1px solid var(--pn-border-subtle)",
                background: "rgba(255,255,255,0.01)",
              }}
            >
              <Breadcrumb path={selectedPath} onNavigate={handleSelectIntent} />
              {selectedIntent && (
                <span
                  className="ml-auto text-[0.6rem] px-2 py-0.5 rounded-full"
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

          {/* Article content */}
          <div className="flex-1 overflow-auto">
            <div
              className="mx-auto py-6"
              style={{ maxWidth: chatOpen ? "100%" : "800px", padding: "1.5rem 2.5rem" }}
            >
              {!selectedPath ? (
                <MainPage intentTree={intentTree} onSelect={handleSelectIntent} />
              ) : editMode ? (
                <div className="flex flex-col h-full">
                  <textarea
                    value={editContent}
                    onChange={(e) =>
                      useIntentSchematicStore.getState().setEditContent(e.target.value)
                    }
                    className="flex-1 min-h-[400px] resize-none outline-none text-[0.8rem] font-mono p-4 rounded-lg"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      color: "var(--pn-text-secondary)",
                      border: "1px solid var(--pn-border-subtle)",
                    }}
                  />
                  <div className="flex justify-end mt-3 gap-2">
                    <button
                      type="button"
                      onClick={() => useIntentSchematicStore.getState().setEditMode(false)}
                      className="px-4 py-1.5 rounded text-[0.75rem]"
                      style={{ color: "var(--pn-text-tertiary)" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleEdit}
                      className="px-4 py-1.5 rounded text-[0.75rem] font-medium"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              ) : selectedContent ? (
                <WikiPageRenderer
                  content={selectedContent}
                  onNavigate={handleSelectIntent}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <span className="text-[0.8rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                    Loading...
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Chat sidebar — Wikipedia talk page style */}
        {chatOpen && (
          <aside
            className="shrink-0 flex flex-col"
            style={{
              width: "340px",
              background: "var(--color-pn-surface-1)",
              borderLeft: "1px solid var(--pn-border-subtle)",
            }}
          >
            <IntentChat />
          </aside>
        )}
      </div>
    </div>
  );
}

/* Wikipedia-style main page when no intent is selected */
function MainPage({
  intentTree,
  onSelect,
}: {
  readonly intentTree: IntentNode[];
  readonly onSelect: (slug: string) => void;
}) {
  const byLevel = new Map<number, IntentNode[]>();
  flattenAll(intentTree).forEach((n) => {
    const list = byLevel.get(n.level) ?? [];
    list.push(n);
    byLevel.set(n.level, list);
  });

  return (
    <div>
      <h1
        className="text-[1.8rem] font-bold mb-1"
        style={{
          color: "var(--pn-text-primary)",
          borderBottom: "1px solid var(--pn-border-default)",
          paddingBottom: "0.3rem",
        }}
      >
        Intent Schematic
      </h1>
      <p className="text-[0.8rem] mb-6" style={{ color: "var(--pn-text-tertiary)" }}>
        Navigable map of everything EMA is trying to do. Select an intent to view its wiki page.
      </p>

      {[0, 1, 2, 3, 4].map((level) => {
        const items = byLevel.get(level);
        if (!items?.length) return null;
        return (
          <section key={level} className="mb-5">
            <h2
              className="text-[1rem] font-semibold mb-2"
              style={{
                color: "var(--pn-text-primary)",
                borderBottom: "1px solid var(--pn-border-subtle)",
                paddingBottom: "0.2rem",
              }}
            >
              {LEVEL_LABELS[level]}s
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.slug)}
                  className="text-left p-3 rounded-lg transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--pn-border-subtle)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: STATUS_COLORS[item.status] ?? "#64748b" }}
                    />
                    <span className="text-[0.8rem] font-medium" style={{ color: "#a78bfa" }}>
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
                    {item.kind} · {item.status}
                    {item.completion_pct > 0 && ` · ${item.completion_pct}%`}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Breadcrumb({
  path,
  onNavigate: _onNavigate,
}: {
  readonly path: string;
  readonly onNavigate: (slug: string) => void;
}) {
  const parts = path.replace("wiki/Intents/", "").replace(".md", "").split("/");
  return (
    <div className="flex items-center gap-1 text-[0.7rem]">
      <span style={{ color: "#a78bfa" }}>Intents</span>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          <span style={{ color: "var(--pn-text-muted)" }}>/</span>
          <span
            style={{
              color: i === parts.length - 1 ? "var(--pn-text-primary)" : "var(--pn-text-tertiary)",
            }}
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

function TabButton({
  label,
  active,
  accent,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly accent?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded text-[0.7rem] font-medium transition-colors"
      style={{
        background: active
          ? accent
            ? "rgba(167,139,250,0.15)"
            : "rgba(255,255,255,0.08)"
          : "transparent",
        color: active
          ? accent
            ? "#a78bfa"
            : "var(--pn-text-primary)"
          : "var(--pn-text-tertiary)",
      }}
    >
      {label}
    </button>
  );
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
  return tree
    .map((node) => filterNode(node, q))
    .filter((n): n is IntentNode => n !== null);
}

function filterNode(node: IntentNode, query: string): IntentNode | null {
  const matches = node.title.toLowerCase().includes(query) || node.slug.includes(query);
  const filteredChildren = (node.children ?? [])
    .map((c) => filterNode(c, query))
    .filter((c): c is IntentNode => c !== null);

  if (matches || filteredChildren.length > 0) {
    return { ...node, children: filteredChildren };
  }
  return null;
}
