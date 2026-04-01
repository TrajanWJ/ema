import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PipelineView } from "./PipelineView";
import { PromptLibrary } from "./PromptLibrary";
import { ReviewerPanel } from "./ReviewerPanel";
import { PromptEditor } from "./PromptEditor";
import { useMetaMindStore } from "@/stores/metamind-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { SavedPrompt } from "@/types/metamind";

const config = APP_CONFIGS["metamind"];

const TABS = [
  { value: "pipeline" as const, label: "Pipeline" },
  { value: "library" as const, label: "Library" },
  { value: "reviewers" as const, label: "Reviewers" },
] as const;

type Tab = typeof TABS[number]["value"];

export function MetaMindApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pipeline");
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await Promise.all([
          useMetaMindStore.getState().loadPrompts(),
          useMetaMindStore.getState().loadStats(),
        ]);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load MetaMind");
      }
      if (!cancelled) setReady(true);
      useMetaMindStore
        .getState()
        .connect()
        .catch(() => {
          console.warn("MetaMind WebSocket failed, using REST");
        });
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelectPrompt(prompt: SavedPrompt) {
    setEditingPrompt(prompt);
    setShowEditor(true);
  }

  function handleNewPrompt() {
    setEditingPrompt(null);
    setShowEditor(true);
  }

  function handleCloseEditor() {
    setShowEditor(false);
    setEditingPrompt(null);
    useMetaMindStore.getState().loadPrompts();
  }

  if (!ready) {
    return (
      <AppWindowChrome
        appId="metamind"
        title={config.title}
        icon={config.icon}
        accent={config.accent}
      >
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  if (showEditor) {
    return (
      <AppWindowChrome
        appId="metamind"
        title={config.title}
        icon={config.icon}
        accent={config.accent}
        breadcrumb="editor"
      >
        <PromptEditor prompt={editingPrompt} onClose={handleCloseEditor} />
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome
      appId="metamind"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={tab}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-[0.9rem] font-semibold"
            style={{ color: "var(--pn-text-primary)" }}
          >
            MetaMind
          </h2>
          <div className="flex items-center gap-2">
            {tab === "library" && (
              <button
                type="button"
                className="text-[0.65rem] px-2 py-1 rounded transition-colors"
                style={{
                  background: "rgba(45,212,168,0.10)",
                  color: "#2dd4a8",
                  border: "1px solid rgba(45,212,168,0.20)",
                }}
                onClick={handleNewPrompt}
              >
                + New Prompt
              </button>
            )}
            <SegmentedControl options={TABS} value={tab} onChange={setTab} />
          </div>
        </div>

        {error && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
          >
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "pipeline" && <PipelineView />}
          {tab === "library" && <PromptLibrary onSelectPrompt={handleSelectPrompt} />}
          {tab === "reviewers" && <ReviewerPanel />}
        </div>
      </div>
    </AppWindowChrome>
  );
}
