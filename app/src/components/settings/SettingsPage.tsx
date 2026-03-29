import { useSettingsStore } from "@/stores/settings-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GlassCard } from "@/components/ui/GlassCard";

const COLOR_MODE_OPTIONS = [
  { value: "dark" as const, label: "Dark" },
  { value: "light" as const, label: "Light" },
  { value: "auto" as const, label: "Auto" },
];

function SectionHeader({ title }: { readonly title: string }) {
  return (
    <h3
      className="text-[0.7rem] font-medium uppercase tracking-wider mb-2"
      style={{ color: "var(--pn-text-secondary)" }}
    >
      {title}
    </h3>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded accent-[var(--color-pn-primary-400)]"
      />
    </label>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (val: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
          {label}
        </span>
        <span className="text-[0.7rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: "var(--color-pn-primary-400)",
          background: `linear-gradient(to right, var(--color-pn-primary-400) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.06) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  );
}

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.set);
  const daemonConnected = useDashboardStore((s) => s.connected);

  const glassIntensity = Number.parseInt(settings.glass_intensity, 10) || 50;
  const fontSize = Number.parseInt(settings.font_size, 10) || 14;

  function showToast(msg: string) {
    // Simple toast via temporary alert — placeholder until real toast system
    window.alert(msg);
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h2
        className="text-[0.9rem] font-semibold"
        style={{ color: "var(--pn-text-primary)" }}
      >
        Settings
      </h2>

      {/* Appearance */}
      <GlassCard>
        <SectionHeader title="Appearance" />
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
              Color mode
            </span>
            <SegmentedControl
              options={COLOR_MODE_OPTIONS}
              value={settings.color_mode}
              onChange={(val) => setSetting("color_mode", val)}
            />
          </div>
          <SliderRow
            label="Glass intensity"
            value={glassIntensity}
            min={0}
            max={100}
            onChange={(val) => setSetting("glass_intensity", String(val))}
          />
          <SliderRow
            label="Font size"
            value={fontSize}
            min={12}
            max={20}
            onChange={(val) => setSetting("font_size", String(val))}
          />
        </div>
      </GlassCard>

      {/* Startup */}
      <GlassCard>
        <SectionHeader title="Startup" />
        <div className="flex flex-col gap-3">
          <ToggleRow
            label="Launch on boot"
            checked={settings.launch_on_boot === "true"}
            onChange={(val) => setSetting("launch_on_boot", String(val))}
          />
          <ToggleRow
            label="Start minimized"
            checked={settings.start_minimized === "true"}
            onChange={(val) => setSetting("start_minimized", String(val))}
          />
        </div>
      </GlassCard>

      {/* Shortcuts */}
      <GlassCard>
        <SectionHeader title="Shortcuts" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
              Capture
            </span>
            <span
              className="text-[0.7rem] px-2 py-0.5 rounded"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--pn-text-secondary)",
              }}
            >
              {settings.shortcut_capture}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
              Toggle window
            </span>
            <span
              className="text-[0.7rem] px-2 py-0.5 rounded"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--pn-text-secondary)",
              }}
            >
              {settings.shortcut_toggle}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Data */}
      <GlassCard>
        <SectionHeader title="Data" />
        <div className="flex gap-2">
          <button
            onClick={() => showToast("Coming soon")}
            className="px-3 py-1.5 rounded-lg text-[0.75rem] transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--pn-text-primary)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Export data
          </button>
          <button
            onClick={() => showToast("Coming soon")}
            className="px-3 py-1.5 rounded-lg text-[0.75rem] transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-pn-error)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Clear data
          </button>
        </div>
      </GlassCard>

      {/* About */}
      <GlassCard>
        <SectionHeader title="About" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
              Version
            </span>
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
              0.1.0
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
              Daemon
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className="rounded-full"
                style={{
                  width: "6px",
                  height: "6px",
                  background: daemonConnected
                    ? "var(--color-pn-success)"
                    : "var(--color-pn-error)",
                }}
              />
              <span className="text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
                {daemonConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
              Stack
            </span>
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
              Elixir Phoenix + Tauri + React
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
