import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { FocusPage } from "./FocusPage";
import { useFocusStore } from "@/stores/focus-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.focus;

export function FocusApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useFocusStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useFocusStore.getState().connect().catch(() => {
        console.warn("Focus WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="focus" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="focus" title={config.title} icon={config.icon} accent={config.accent}>
      <FocusPage />
    </AppWindowChrome>
  );
}
