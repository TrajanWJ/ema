import { useJournalStore } from "@/stores/journal-store";

const ENERGY_FIELDS = [
  { key: "energy_p", label: "Physical", color: "var(--color-pn-success)" },
  { key: "energy_m", label: "Mental", color: "var(--color-pn-secondary-400)" },
  { key: "energy_e", label: "Emotional", color: "var(--color-pn-tertiary-400)" },
] as const;

export function EnergyTracker() {
  const currentEntry = useJournalStore((s) => s.currentEntry);
  const updateField = useJournalStore((s) => s.updateField);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
        Energy
      </span>
      {ENERGY_FIELDS.map(({ key, label, color }) => {
        const value = (currentEntry?.[key as keyof typeof currentEntry] as number | null) ?? 5;

        return (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[0.65rem]" style={{ color }}>
                {label}
              </span>
              <span className="text-[0.7rem] font-medium" style={{ color }}>
                {value}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={value}
              onChange={(e) => updateField(key, Number.parseInt(e.target.value, 10))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: color,
                background: `linear-gradient(to right, ${color} ${((value - 1) / 9) * 100}%, rgba(255,255,255,0.06) ${((value - 1) / 9) * 100}%)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
