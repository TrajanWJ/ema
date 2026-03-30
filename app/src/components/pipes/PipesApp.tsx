import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePipesStore } from "@/stores/pipes-store";
import { APP_CONFIGS } from "@/types/workspace";
import { PipeList } from "./PipeList";
import { SystemPipes } from "./SystemPipes";
import { PipeCatalog } from "./PipeCatalog";

const config = APP_CONFIGS["pipes"];

const TABS = [
  { value: "active" as const, label: "Active Pipes" },
  { value: "system" as const, label: "System Pipes" },
  { value: "catalog" as const, label: "Catalog" },
] as const;

type Tab = typeof TABS[number]["value"];

export function PipesApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const pipes = usePipesStore((s) => s.pipes);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await usePipesStore.getState().loadViaRest();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load pipes");
      }
      if (!cancelled) setReady(true);
      usePipesStore.getState().connect().catch(() => {
        console.warn("Pipes WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const userPipes = pipes.filter((p) => !p.system);

  if (!ready) {
    return (
      <AppWindowChrome appId="pipes" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="pipes" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={tab}>
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "active" && (
        <PipeList pipes={userPipes} emptyMessage="No custom pipes. Create one or check System Pipes." />
      )}
      {tab === "system" && <SystemPipes />}
      {tab === "catalog" && <PipeCatalog />}
    </AppWindowChrome>
  );
}
