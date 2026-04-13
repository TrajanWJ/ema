import { useState, useEffect } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useGitSyncStore } from "@/stores/git-sync-store";
import { APP_CONFIGS } from "@/types/workspace";
import { GitSyncPage } from "./GitSyncPage";

const config = APP_CONFIGS["git-sync"];

export function GitSyncApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useGitSyncStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="git-sync" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-sm" style={{ color: "var(--pn-text-tertiary)" }}>
            Loading git activity...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="git-sync" title={config.title} icon={config.icon} accent={config.accent}>
      <GitSyncPage />
    </AppWindowChrome>
  );
}
