import { GlassCard } from "@/components/ui/GlassCard";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useJournalStore } from "@/stores/journal-store";
import { MOOD_LABELS, MOOD_COLORS } from "@/types/journal";

const MOOD_VALUES = [1, 2, 3, 4, 5] as const;

const ENERGY_BARS = [
  { key: "energy_p", label: "Physical", color: "var(--color-pn-success)" },
  { key: "energy_m", label: "Mental", color: "#5b9cf5" },
  { key: "energy_e", label: "Emotional", color: "var(--color-pn-tertiary-400)" },
] as const;

export function MoodEnergyCard() {
  const journal = useDashboardStore((s) => s.snapshot?.journal ?? null);
  const updateField = useJournalStore((s) => s.updateField);

  const currentMood = journal?.mood ?? null;

  return (
    <GlassCard title="Mood & Energy">
      {/* Mood selector */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          {MOOD_VALUES.map((val) => {
            const active = currentMood === val;
            const color = MOOD_COLORS[val];
            return (
              <button
                key={val}
                onClick={() => updateField("mood", val)}
                className="rounded-full transition-all"
                style={{
                  width: "22px",
                  height: "22px",
                  background: active ? color : "transparent",
                  border: `2px solid ${color}`,
                  opacity: active ? 1 : 0.4,
                }}
                title={MOOD_LABELS[val]}
              />
            );
          })}
          {currentMood && (
            <span
              className="text-[0.7rem] ml-1"
              style={{ color: MOOD_COLORS[currentMood] }}
            >
              {MOOD_LABELS[currentMood]}
            </span>
          )}
        </div>
      </div>

      {/* Energy bars */}
      <div className="flex flex-col gap-2">
        {ENERGY_BARS.map(({ key, label, color }) => {
          const value = (journal?.[key as keyof typeof journal] as number | null) ?? 0;
          const pct = Math.min(Math.max(value, 0), 10) * 10;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className="text-[0.6rem]"
                  style={{ color: "var(--pn-text-tertiary)" }}
                >
                  {label}
                </span>
                <span className="text-[0.6rem]" style={{ color }}>
                  {value || "\u2014"}
                </span>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
