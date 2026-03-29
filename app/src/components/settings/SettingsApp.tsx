import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SettingsPage } from "./SettingsPage";
import { useSettingsStore } from "@/stores/settings-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.settings;

export function SettingsApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useSettingsStore.getState().load();
      if (!cancelled) setReady(true);
      useSettingsStore.getState().connect().catch(() => {
        console.warn("Settings WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="settings" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="settings" title={config.title} icon={config.icon} accent={config.accent}>
      <SettingsPage />
    </AppWindowChrome>
  );
}
