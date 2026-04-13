import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { HabitsPage } from "./HabitsPage";
import { useHabitsStore } from "@/stores/habits-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.habits;

export function HabitsApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useHabitsStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useHabitsStore.getState().connect().catch(() => {
        console.warn("Habits WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="habits" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="habits" title={config.title} icon={config.icon} accent={config.accent} breadcrumb="Today">
      <HabitsPage />
    </AppWindowChrome>
  );
}
