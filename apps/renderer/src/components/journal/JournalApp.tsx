import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { JournalPage } from "./JournalPage";
import { useJournalStore } from "@/stores/journal-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.journal;

export function JournalApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useJournalStore.getState().loadEntry();
      if (!cancelled) setReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="journal" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="journal" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}>
      <JournalPage />
    </AppWindowChrome>
  );
}
