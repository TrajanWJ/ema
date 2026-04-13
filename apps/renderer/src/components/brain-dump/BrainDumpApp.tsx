import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { BrainDumpPage } from "./BrainDumpPage";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["brain-dump"];

export function BrainDumpApp() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await useBrainDumpStore.getState().loadViaRest();
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load queue");
        }
      } finally {
        if (!cancelled) setReady(true);
      }

      useBrainDumpStore.getState().connect().catch(() => {
        console.warn("Brain Dump WebSocket failed, using REST");
      });
    }

    void init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="brain-dump" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="brain-dump" title={config.title} icon={config.icon} accent={config.accent} breadcrumb="Queue">
      {loadError ? (
        <div className="flex h-full flex-col gap-3 p-4">
          <div className="text-[0.78rem] font-medium" style={{ color: "var(--color-pn-warning, #EAB308)" }}>
            Queue failed to load
          </div>
          <div className="text-[0.72rem]" style={{ color: "var(--pn-text-secondary)" }}>
            {loadError}
          </div>
          <div className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
            Capture is still available. Existing queue items may be incomplete until the backend route is healthy.
          </div>
          <BrainDumpPage />
        </div>
      ) : (
        <BrainDumpPage />
      )}
    </AppWindowChrome>
  );
}
