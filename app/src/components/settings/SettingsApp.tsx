import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SettingsPage } from "./SettingsPage";
import { WorkspaceTab } from "./WorkspaceTab";
import { DeveloperTab } from "./DeveloperTab";
import { useSettingsStore } from "@/stores/settings-store";
import { useActorsStore } from "@/stores/actors-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.settings;

type Tab = "system" | "workspace" | "developer";

const TABS: readonly { readonly value: Tab; readonly label: string }[] = [
  { value: "system", label: "System" },
  { value: "workspace", label: "Workspace" },
  { value: "developer", label: "Developer" },
];

function TabBar({
  active,
  onChange,
}: {
  readonly active: Tab;
  readonly onChange: (tab: Tab) => void;
}) {
  return (
    <div
      className="flex gap-0 shrink-0"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className="px-4 py-2 text-[0.75rem] font-medium transition-all relative"
          style={{
            color:
              active === tab.value
                ? "var(--pn-text-primary)"
                : "var(--pn-text-tertiary)",
            background: "transparent",
            border: "none",
            borderBottom:
              active === tab.value
                ? "2px solid var(--color-pn-primary-400)"
                : "2px solid transparent",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsApp() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("system");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useSettingsStore.getState().load();
      if (!cancelled) setReady(true);
      useSettingsStore.getState().connect().catch(() => {
        console.warn("Settings WebSocket failed, using REST");
      });
      useActorsStore.getState().loadViaRest().catch(() => {
        console.warn("Actors REST load failed");
      });
      useActorsStore.getState().connect().catch(() => {
        console.warn("Actors WebSocket failed");
      });
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome
        appId="settings"
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
      appId="settings"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
    >
      <div className="flex flex-col h-full">
        <TabBar active={activeTab} onChange={setActiveTab} />
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "system" && <SettingsPage />}
          {activeTab === "workspace" && <WorkspaceTab />}
          {activeTab === "developer" && <DeveloperTab />}
        </div>
      </div>
    </AppWindowChrome>
  );
}
