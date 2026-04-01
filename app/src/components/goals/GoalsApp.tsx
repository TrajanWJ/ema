import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { GoalsPage } from "./GoalsPage";
import { useGoalsStore } from "@/stores/goals-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.goals;

export function GoalsApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useGoalsStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useGoalsStore.getState().connect().catch(() => {
        console.warn("Goals WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="goals" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="goals" title={config.title} icon={config.icon} accent={config.accent}>
      <GoalsPage />
    </AppWindowChrome>
  );
}
