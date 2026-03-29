import { useState } from "react";
import { useHabitsStore } from "@/stores/habits-store";
import type { Habit } from "@/types/habits";

const FREQUENCY_OPTIONS: readonly Habit["frequency"][] = ["daily", "weekly"];
const MAX_HABITS = 7;

export function AddHabitForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Habit["frequency"]>("daily");
  const [target, setTarget] = useState("");
  const addHabit = useHabitsStore((s) => s.addHabit);
  const habitCount = useHabitsStore((s) => s.habits.length);

  function reset() {
    setName("");
    setFrequency("daily");
    setTarget("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await addHabit(trimmed, frequency, target.trim() || null);
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[0.75rem] mb-3 opacity-50 hover:opacity-80 transition-opacity"
        style={{ color: "var(--color-pn-primary-400)" }}
      >
        + Add habit
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-surface rounded-lg p-3 mb-3 flex flex-col gap-2">
      {habitCount >= MAX_HABITS && (
        <span
          className="text-[0.65rem]"
          style={{ color: "var(--color-pn-error)" }}
        >
          Maximum {MAX_HABITS} habits reached
        </span>
      )}

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Habit name"
        autoFocus
        required
        className="glass-ambient rounded-lg px-3 py-1.5 text-[0.8rem] outline-none"
        style={{
          color: "var(--pn-text-primary)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      <div className="flex items-center gap-2">
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Habit["frequency"])}
          className="glass-ambient rounded-lg px-2 py-1 text-[0.75rem] outline-none"
          style={{
            color: "var(--pn-text-primary)",
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          {FREQUENCY_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target (optional)"
          className="glass-ambient rounded-lg px-3 py-1 text-[0.75rem] outline-none flex-1"
          style={{
            color: "var(--pn-text-primary)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!name.trim() || habitCount >= MAX_HABITS}
          className="px-3 py-1 rounded-lg text-[0.75rem] transition-opacity disabled:opacity-30"
          style={{
            background: "var(--color-pn-primary-400)",
            color: "var(--color-pn-base)",
          }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => { reset(); setOpen(false); }}
          className="px-3 py-1 rounded-lg text-[0.75rem] opacity-50 hover:opacity-80"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
