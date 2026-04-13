import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useVaultStore } from "@/stores/vault-store";
import { APP_CONFIGS } from "@/types/workspace";
import { FileTree } from "@/components/vault/FileTree";
import { WikiPage } from "./WikiPage";
import { WikiGraph } from "./WikiGraph";
import { WikiSearch } from "./WikiSearch";
import { WikiIndex } from "./WikiIndex";
import { WikiStats } from "./WikiStats";

const config = APP_CONFIGS["wiki"];

const TABS = [
  { value: "wiki" as const, label: "Wiki" },
  { value: "graph" as const, label: "Graph" },
  { value: "search" as const, label: "Search" },
  { value: "index" as const, label: "Index" },
  { value: "stats" as const, label: "Stats" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function WikiApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("wiki");
  const notes = useVaultStore((s) => s.notes);
  const selectedNote = useVaultStore((s) => s.selectedNote);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await useVaultStore.getState().loadViaRest();
        await useVaultStore.getState().loadGraph();
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load vault");
      }
      if (!cancelled) setReady(true);
      useVaultStore
        .getState()
        .connect()
        .catch(() => {
          console.warn("Vault WebSocket failed, using REST");
        });
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelectNote(path: string) {
    useVaultStore.getState().loadNoteWithContent(path);
    setTab("wiki");
  }

  // Build breadcrumb from selected note path
  const breadcrumbParts: string[] = [];
  if (tab !== "wiki") {
    breadcrumbParts.push(tab);
  } else if (selectedNote) {
    const parts = selectedNote.file_path.split("/");
    breadcrumbParts.push(...parts);
  }

  if (!ready) {
    return (
      <AppWindowChrome
        appId="wiki"
        title={config.title}
        icon={config.icon}
        accent={config.accent}
      >
        <div className="flex items-center justify-center h-full">
          <span
            className="text-[0.8rem]"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome
      appId="wiki"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={breadcrumbParts.join(" / ")}
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
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "wiki" && (
        <div className="flex gap-3 h-[calc(100%-3rem)]">
          {/* Sidebar — file tree + spaces */}
          <div
            className="shrink-0 overflow-auto rounded-lg flex flex-col"
            style={{
              width: "220px",
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
              Files
            </div>
            <div className="flex-1 overflow-auto">
              <FileTree notes={notes} onSelect={handleSelectNote} />
            </div>
            <SpaceList notes={notes} onFilter={handleSelectNote} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <WikiPage onNavigate={handleSelectNote} />
          </div>
        </div>
      )}

      {tab === "graph" && <WikiGraph onSelectNote={handleSelectNote} />}
      {tab === "search" && <WikiSearch onSelectNote={handleSelectNote} />}
      {tab === "index" && <WikiIndex onSelectNote={handleSelectNote} />}
      {tab === "stats" && <WikiStats />}
    </AppWindowChrome>
  );
}

function SpaceList({
  notes,
  onFilter: _onFilter,
}: {
  readonly notes: readonly import("@/types/vault").VaultNote[];
  readonly onFilter: (path: string) => void;
}) {
  const spaces = new Map<string, number>();
  for (const note of notes) {
    if (note.space) {
      spaces.set(note.space, (spaces.get(note.space) ?? 0) + 1);
    }
  }

  const spaceColors: Record<string, string> = {
    agents: "#5B8AF0",
    projects: "#4CAF50",
    architecture: "#9B59B6",
    config: "#f59e0b",
    ops: "#ef4444",
    research: "#2dd4a8",
    security: "#e879f9",
    system: "#6b95f0",
  };

  if (spaces.size === 0) return null;

  return (
    <div
      style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
      className="px-2 py-2"
    >
      <div
        className="text-[0.6rem] uppercase tracking-wider font-semibold px-1 mb-1"
        style={{ color: "var(--pn-text-muted)" }}
      >
        Spaces
      </div>
      {[...spaces.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([space, count]) => (
          <div
            key={space}
            className="flex items-center justify-between px-1 py-0.5 rounded text-[0.65rem]"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: spaceColors[space] ?? "var(--pn-text-tertiary)",
                }}
              />
              <span className="truncate">{space}</span>
            </div>
            <span
              className="text-[0.55rem] tabular-nums"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {count}
            </span>
          </div>
        ))}
    </div>
  );
}
