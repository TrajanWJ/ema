import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useVaultStore } from "@/stores/vault-store";
import { APP_CONFIGS } from "@/types/workspace";
import { FileTree } from "./FileTree";
import { NoteEditor } from "./NoteEditor";
import { VaultSearch } from "./VaultSearch";
import { VaultGraph } from "./VaultGraph";

const config = APP_CONFIGS["vault"];

const TABS = [
  { value: "files" as const, label: "Files" },
  { value: "graph" as const, label: "Graph" },
  { value: "search" as const, label: "Search" },
] as const;

type Tab = typeof TABS[number]["value"];

export function VaultApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("files");
  const notes = useVaultStore((s) => s.notes);
  const loadNote = useVaultStore((s) => s.loadNote);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useVaultStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useVaultStore.getState().connect().catch(() => {
        console.warn("Vault WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  function handleSelectNote(path: string) {
    loadNote(path);
    setTab("files");
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="vault" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="vault" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={tab}>
      <div className="flex items-center justify-between mb-3">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "files" && (
        <div className="flex gap-3 h-[calc(100%-3rem)]">
          <div
            className="shrink-0 overflow-auto rounded-lg"
            style={{
              width: "220px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--pn-border-subtle)",
            }}
          >
            <FileTree notes={notes} onSelect={handleSelectNote} />
          </div>
          <div className="flex-1 min-w-0">
            <NoteEditor />
          </div>
        </div>
      )}

      {tab === "graph" && <VaultGraph />}

      {tab === "search" && <VaultSearch onSelectNote={handleSelectNote} />}
    </AppWindowChrome>
  );
}
