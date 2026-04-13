import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { BrainDumpPage } from "./BrainDumpPage";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["brain-dump"];

export function BrainDumpApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useBrainDumpStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useBrainDumpStore.getState().connect().catch(() => {
        console.warn("Brain Dump WebSocket failed, using REST");
      });
    }
    init();
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
      <BrainDumpPage />
    </AppWindowChrome>
  );
}
