import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePipesStore } from "@/stores/pipes-store";
import { APP_CONFIGS } from "@/types/workspace";
import { PipeList } from "./PipeList";
import { SystemPipes } from "./SystemPipes";
import { PipeCatalog } from "./PipeCatalog";
import { EvolutionTab } from "./EvolutionTab";
import { HistoryTab } from "./HistoryTab";

const config = APP_CONFIGS["pipes"];

type TopTab = "pipes" | "evolution" | "history";

const TOP_TABS: readonly { value: TopTab; label: string }[] = [
  { value: "pipes", label: "Pipes" },
  { value: "evolution", label: "Evolution" },
  { value: "history", label: "History" },
];

const PIPE_SUB_TABS = [
  { value: "active" as const, label: "Active Pipes" },
  { value: "system" as const, label: "System Pipes" },
  { value: "catalog" as const, label: "Catalog" },
] as const;

type PipeSubTab = (typeof PIPE_SUB_TABS)[number]["value"];

export function PipesApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<TopTab>("pipes");
  const [pipeSubTab, setPipeSubTab] = useState<PipeSubTab>("active");
  const pipes = usePipesStore((s) => s.pipes);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await usePipesStore.getState().loadViaRest();
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load pipes",
          );
      }
      if (!cancelled) setReady(true);
      usePipesStore
        .getState()
        .connect()
        .catch(() => {
          console.warn("Pipes WebSocket failed, using REST");
        });
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const userPipes = pipes.filter((p) => !p.system);

  const breadcrumb =
    topTab === "pipes" ? pipeSubTab : topTab;

  if (!ready) {
    return (
      <AppWindowChrome
        appId="pipes"
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
      appId="pipes"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={breadcrumb}
    >
      {error && (
        <div
          className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]"
          style={{
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
          }}
        >
          {error}
        </div>
      )}

      {/* Top-level tab bar */}
      <div
        className="flex gap-0 mb-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {TOP_TABS.map((t) => {
          const active = topTab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTopTab(t.value)}
              className="px-4 py-2 transition-colors"
              style={{
                fontSize: "12px",
                background: active
                  ? "rgba(99,102,241,0.2)"
                  : "transparent",
                borderBottom: active
                  ? "2px solid #818cf8"
                  : "2px solid transparent",
                color: active
                  ? "var(--pn-text-primary)"
                  : "var(--pn-text-tertiary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Pipes tab content */}
      {topTab === "pipes" && (
        <>
          <div className="flex items-center justify-between mb-3">
            <SegmentedControl
              options={PIPE_SUB_TABS}
              value={pipeSubTab}
              onChange={setPipeSubTab}
            />
          </div>

          {pipeSubTab === "active" && (
            <PipeList
              pipes={userPipes}
              emptyMessage="No custom pipes. Create one or check System Pipes."
            />
          )}
          {pipeSubTab === "system" && <SystemPipes />}
          {pipeSubTab === "catalog" && <PipeCatalog />}
        </>
      )}

      {/* Evolution tab content (lazy init via its own useEffect) */}
      {topTab === "evolution" && <EvolutionTab />}

      {/* History tab content */}
      {topTab === "history" && <HistoryTab />}
    </AppWindowChrome>
  );
}
