import { useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useVoiceStore } from "@/stores/voice-store";
import { useTokenStore } from "@/stores/token-store";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceMicSetup } from "@/components/voice/VoiceMicSetup";

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

      {/* Voice / Jarvis */}
      <VoiceSettingsSection />

      {/* Budget & Cost */}
      <BudgetSettingsSection />

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

function BudgetSettingsSection() {
  const budget = useTokenStore((s) => s.budget);
  const summary = useTokenStore((s) => s.summary);
  const setBudget = useTokenStore((s) => s.setBudget);
  const loadBudget = useTokenStore((s) => s.loadBudget);
  const [editing, setEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  // Load budget on first render
  useState(() => {
    loadBudget();
  });

  function handleSave() {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount > 0) {
      setBudget(amount);
      setEditing(false);
    }
  }

  const percent = summary?.percent_used ?? budget?.percent_used ?? 0;
  const monthCost = summary?.month_cost ?? budget?.current_spend ?? 0;
  const monthlyBudget = budget?.monthly_budget ?? 100;

  return (
    <GlassCard>
      <SectionHeader title="Budget & Cost Alerts" />
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-primary)" }}>
            Monthly budget
          </span>
          {editing ? (
            <div className="flex items-center gap-1">
              <span className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>$</span>
              <input
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="bg-transparent border rounded px-2 py-0.5 text-[0.75rem] w-20 outline-none"
                style={{ borderColor: "var(--pn-border-default)", color: "rgba(255,255,255,0.87)" }}
                autoFocus
              />
              <button
                onClick={handleSave}
                className="text-[0.7rem] px-2 py-0.5 rounded"
                style={{ background: "rgba(45,212,168,0.2)", color: "#2dd4a8" }}
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-[0.7rem] px-2 py-0.5"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setBudgetInput(String(monthlyBudget)); setEditing(true); }}
              className="text-[0.75rem] font-mono hover:underline"
              style={{ color: "var(--pn-text-secondary)" }}
            >
              ${monthlyBudget}/month
            </button>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="w-full rounded-full overflow-hidden mb-1" style={{ height: 4, background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(percent, 100)}%`,
                background: percent >= 100 ? "#EF4444" : percent >= 80 ? "#f59e0b" : "#2dd4a8",
              }}
            />
          </div>
          <div className="flex justify-between text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
            <span>${monthCost.toFixed(2)} spent</span>
            <span>{percent.toFixed(0)}%</span>
          </div>
        </div>

        {/* Alert thresholds info */}
        <div className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Alerts trigger at 80% (warning) and 100% (exceeded). Cost spike alerts fire when daily spend exceeds 2x your daily average.
        </div>
      </div>
    </GlassCard>
  );
}

function VoiceSettingsSection() {
  const voiceSettings = useVoiceStore((s) => s.settings);
  const audioLevel = useVoiceStore((s) => s.audioLevel);
  const updateSettings = useVoiceStore((s) => s.updateSettings);
  const orbVisible = useVoiceStore((s) => s.orbVisible);
  const setOrbVisible = useVoiceStore((s) => s.setOrbVisible);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-[0.7rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Voice / Jarvis
        </h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            Show Orb
          </span>
          <input
            type="checkbox"
            checked={orbVisible}
            onChange={(e) => setOrbVisible(e.target.checked)}
            className="rounded accent-[var(--color-pn-primary-400)]"
          />
        </label>
      </div>
      <VoiceMicSetup
        settings={voiceSettings}
        onSettingsChange={updateSettings}
        audioLevel={audioLevel}
      />
    </GlassCard>
  );
}
