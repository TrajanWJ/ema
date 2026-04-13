import { useJournalStore } from "@/stores/journal-store";
import { todayStr } from "@/lib/date-utils";

export function OneThingInput() {
  const currentDate = useJournalStore((s) => s.currentDate);
  const currentEntry = useJournalStore((s) => s.currentEntry);
  const updateField = useJournalStore((s) => s.updateField);
  const loading = useJournalStore((s) => s.loading);

  const isPast = currentDate < todayStr();
  const label = isPast
    ? "What was the #1 priority?"
    : "What's the #1 priority today?";

  return (
    <div className="mb-4">
      <label
        className="block text-[0.65rem] mb-1"
        style={{ color: "var(--pn-text-tertiary)" }}
      >
        {label}
      </label>
      <input
        type="text"
        value={currentEntry?.one_thing ?? ""}
        onChange={(e) => updateField("one_thing", e.target.value)}
        disabled={loading}
        placeholder="One thing..."
        className="w-full glass-ambient rounded-lg px-3 py-2 text-[0.8rem] outline-none disabled:opacity-40"
        style={{
          color: "var(--pn-text-primary)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />
    </div>
  );
}
