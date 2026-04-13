import { StandardAppWindow } from "../templates/StandardAppWindow.tsx";
import { GlassCard } from "../components/GlassCard/index.ts";
import { GlassSelect } from "../components/GlassSelect/index.ts";
import { GlassButton } from "../components/GlassButton/index.ts";
import { useState } from "react";

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "mid", label: "Mid" },
  { value: "high", label: "High contrast" },
] as const;

/**
 * system-app boilerplate — settings/voice/tokens inspector. Neutral accent.
 * A plain StandardAppWindow wrapping a settings-ish form.
 */
export function SystemAppBoilerplate() {
  const [theme, setTheme] = useState<string>("dark");

  return (
    <StandardAppWindow
      appId="settings"
      title="SETTINGS"
      icon="&#9881;"
      accent="var(--pn-text-secondary)"
    >
      <GlassCard title="Appearance">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-3)" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--pn-text-secondary)" }}>
            Theme
            <GlassSelect
              uiSize="md"
              value={theme}
              onChange={setTheme}
              options={THEMES}
            />
          </label>
          <GlassButton variant="primary" uiSize="md">
            Apply
          </GlassButton>
        </div>
      </GlassCard>
    </StandardAppWindow>
  );
}
