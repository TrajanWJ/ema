import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useIntentSchematicStore } from "@/stores/intent-schematic-store";
import { APP_CONFIGS } from "@/types/workspace";
import { IntentNav, IntentMetadata } from "./IntentNav";
import { WikiPageRenderer } from "./WikiPageRenderer";
import { IntentChat } from "./IntentChat";

const config = APP_CONFIGS["intent-schematic"] ?? {
  title: "Intent Schematic",
  accent: "#a78bfa",
  icon: "🗺️",
};

const TABS = [
  { value: "schematic" as const, label: "Schematic" },
  { value: "edit" as const, label: "Edit" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function IntentSchematicApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("schematic");
  const [chatOpen, setChatOpen] = useState(false);

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
    // Find the wiki page path for this slug
    const notes = useIntentSchematicStore.getState().wikiNotes;
    const match = notes.find((n) => {
      const basename = n.file_path.split("/").pop()?.replace(".md", "") ?? "";
      const noteSlug = basename.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return noteSlug === slug;
    });
    if (match) {
      useIntentSchematicStore.getState().selectPage(match.file_path);
    }
    setTab("schematic");
  }

  function handleWikilinkNavigate(slug: string) {
    handleSelectIntent(slug);
  }

  function handleToggleEdit() {
    if (editMode) {
      useIntentSchematicStore.getState().savePage();
      setTab("schematic");
    } else {
      useIntentSchematicStore.getState().setEditMode(true);
      setTab("edit");
    }
  }

  // Breadcrumb from selected path
  const breadcrumb = selectedPath
    ? selectedPath.replace("wiki/Intents/", "").replace(".md", "").replace(/\//g, " / ")
    : "Select an intent";

  if (!ready) {
    return (
      <AppWindowChrome
        appId="intent-schematic"
        title={config.title}
        icon={config.icon}
        accent={config.accent}
      >
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading intent schematic...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome
      appId="intent-schematic"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={breadcrumb}
    >
      {error && (
        <div
          className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={(v) => {
            setTab(v);
            if (v === "edit") useIntentSchematicStore.getState().setEditMode(true);
            if (v === "schematic") useIntentSchematicStore.getState().setEditMode(false);
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            className="px-2 py-1 rounded text-[0.65rem] transition-colors"
            style={{
              background: chatOpen ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
              color: chatOpen ? "#a78bfa" : "var(--pn-text-tertiary)",
              border: "1px solid var(--pn-border-subtle)",
            }}
          >
            Chat
          </button>
          {selectedPath && (
            <button
              type="button"
              onClick={handleToggleEdit}
              className="px-2 py-1 rounded text-[0.65rem] font-medium transition-colors"
              style={{
                background: editMode ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                color: editMode ? "#22c55e" : "var(--pn-text-tertiary)",
                border: "1px solid var(--pn-border-subtle)",
              }}
            >
              {editMode ? "Save" : "Edit"}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 h-[calc(100%-3rem)]">
        {/* Left: Nav tree + metadata */}
        <div
          className="shrink-0 flex flex-col rounded-lg overflow-hidden"
          style={{
            width: "220px",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--pn-border-subtle)",
          }}
        >
          <IntentNav
            tree={intentTree}
            selectedSlug={selectedIntent?.slug ?? null}
            onSelect={handleSelectIntent}
          />
          <IntentMetadata intent={selectedIntent} />
        </div>

        {/* Right: content + chat */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Page content */}
          <div
            className="flex-1 min-h-0 rounded-lg overflow-hidden"
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--pn-border-subtle)",
            }}
          >
            <div className="h-full p-4 overflow-auto">
              {!selectedPath ? (
                <EmptyState />
              ) : tab === "edit" || editMode ? (
                <textarea
                  value={editContent}
                  onChange={(e) =>
                    useIntentSchematicStore.getState().setEditContent(e.target.value)
                  }
                  className="w-full h-full resize-none outline-none text-[0.8rem] font-mono"
                  style={{
                    background: "transparent",
                    color: "var(--pn-text-secondary)",
                  }}
                />
              ) : selectedContent ? (
                <WikiPageRenderer
                  content={selectedContent}
                  onNavigate={handleWikilinkNavigate}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                    Loading...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Chat panel */}
          {chatOpen && <IntentChat />}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <span className="text-[2rem]">🗺️</span>
      <span className="text-[0.85rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
        Intent Schematic
      </span>
      <span className="text-[0.7rem] text-center max-w-xs" style={{ color: "var(--pn-text-tertiary)" }}>
        Select an intent from the tree to view its wiki page.
        Every intent is a markdown document with wikilinks, status tracking, and agent collaboration.
      </span>
    </div>
  );
}
