import { useJournalStore } from "@/stores/journal-store";
import { MOOD_LABELS, MOOD_COLORS } from "@/types/journal";

const MOOD_VALUES = [1, 2, 3, 4, 5] as const;

export function MoodPicker() {
  const currentEntry = useJournalStore((s) => s.currentEntry);
  const updateField = useJournalStore((s) => s.updateField);

  const selected = currentEntry?.mood ?? null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
        Mood
      </span>
      <div className="flex items-center gap-2">
        {MOOD_VALUES.map((val) => {
          const active = selected === val;
          const color = MOOD_COLORS[val];
          return (
            <button
              key={val}
              onClick={() => updateField("mood", val)}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="rounded-full transition-all"
                style={{
                  width: "24px",
                  height: "24px",
                  background: active ? color : "transparent",
                  border: `2px solid ${color}`,
                  opacity: active ? 1 : 0.4,
                }}
              />
              <span
                className="text-[0.55rem]"
                style={{
                  color: active ? color : "var(--pn-text-tertiary)",
                  opacity: active ? 1 : 0.5,
                }}
              >
                {MOOD_LABELS[val]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
