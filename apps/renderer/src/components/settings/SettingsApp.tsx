import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SettingsPage } from "./SettingsPage";
import { WorkspaceTab } from "./WorkspaceTab";
import { DeveloperTab } from "./DeveloperTab";
import { useSettingsStore } from "@/stores/settings-store";
import { useActorsStore } from "@/stores/actors-store";
import { APP_CONFIGS } from "@/types/workspace";
import {
  GlassSurface,
  HeroBanner,
  InspectorSection,
  MetricCard,
  TagPill,
  TopNavBar,
  WorkspaceShell,
} from "@ema/glass";

const config = APP_CONFIGS.settings;

type Tab = "system" | "workspace" | "developer";

const TABS: readonly { readonly value: Tab; readonly label: string; readonly hint: string }[] = [
  { value: "system", label: "System", hint: "Runtime preferences" },
  { value: "workspace", label: "Workspace", hint: "Context and windows" },
  { value: "developer", label: "Developer", hint: "Diagnostics and tooling" },
];

export function SettingsApp() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("system");
  const settings = useSettingsStore((s) => s.settings);
  const connected = useSettingsStore((s) => s.connected);
  const actors = useActorsStore((s) => s.actors);

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

  const navItems = TABS.map((tab) => ({
    id: tab.value,
    label: tab.label,
    hint: tab.hint,
  }));

  return (
    <WorkspaceShell
      appId="settings"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      nav={
        <TopNavBar
          items={navItems}
          activeId={activeTab}
          onChange={(value) => setActiveTab(value as Tab)}
          leftSlot={
            <div>
              <div
                style={{
                  fontSize: "0.66rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "var(--pn-text-muted)",
                }}
              >
                EMA Control Surface
              </div>
              <div style={{ fontSize: "1.08rem", fontWeight: 650 }}>
                Settings
              </div>
            </div>
          }
          rightSlot={
            <TagPill
              label={connected ? "live sync" : "rest fallback"}
              tone={connected ? "rgba(34,197,94,0.14)" : "rgba(245,158,11,0.14)"}
              color={connected ? "var(--color-pn-success)" : "var(--color-pn-warning)"}
            />
          }
        />
      }
      hero={
        <HeroBanner
          eyebrow="Workspace Posture"
          title="Tune the operating environment before tuning the apps."
          description="Settings should feel like a control surface, not a dumping ground. Keep runtime posture, workspace behavior, and developer diagnostics readable and distinct."
          tone="var(--color-pn-blue-400)"
          aside={
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--pn-space-3)" }}>
              <MetricCard
                label="Actors"
                value={String(actors.length)}
                detail="Human and agent runtime entries visible now."
                tone="var(--color-pn-indigo-400)"
              />
              <MetricCard
                label="Accent"
                value={settings.accent_color ?? "#2DD4A8"}
                detail={`Mode ${settings.color_mode} · Glass ${settings.glass_intensity}`}
                tone="var(--color-pn-teal-400)"
              />
            </div>
          }
        />
      }
      content={
        <GlassSurface tier="surface" padding="lg">
          {activeTab === "system" && <SettingsPage />}
          {activeTab === "workspace" && <WorkspaceTab />}
          {activeTab === "developer" && <DeveloperTab />}
        </GlassSurface>
      }
      rail={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)" }}>
          <InspectorSection
            title="Runtime Summary"
            description="Current desktop and sync posture from the live settings state."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-2)" }}>
              <TagPill label={`Font ${settings.font_family}`} />
              <TagPill label={`Base size ${settings.font_size}px`} />
              <TagPill label={`Launch on boot ${settings.launch_on_boot}`} />
              <TagPill label={`Start minimized ${settings.start_minimized}`} />
            </div>
          </InspectorSection>

          <InspectorSection
            title="Shortcuts"
            description="Primary capture and control keys exposed so the command posture stays legible."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-2)", color: "var(--pn-text-secondary)", fontSize: "0.8rem" }}>
              <div>{settings.shortcut_capture}</div>
              <div>{settings.shortcut_toggle}</div>
            </div>
          </InspectorSection>
        </div>
      }
    />
  );
}
