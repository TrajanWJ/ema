import { useEffect, useState } from "react";
import { useHabitsStore } from "@/stores/habits-store";
import { api } from "@/lib/api";
import { todayStr, weekDates, offsetDate, dayOfWeek } from "@/lib/date-utils";
import type { Habit, HabitLog } from "@/types/habits";

export function WeekView() {
  const habits = useHabitsStore((s) => s.habits);
  const [weekStart, setWeekStart] = useState(() => weekDates(todayStr())[0]);
  const [logs, setLogs] = useState<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

  const days = weekDates(weekStart);
  const today = todayStr();
  const canGoNext = days[6] < today;

  useEffect(() => {
    const start = days[0];
    const end = days[6];

    Promise.all(
      habits.map((h) =>
        api
          .get<HabitLog[]>(`/habits/${h.id}/logs?start=${start}&end=${end}`)
          .then((res) => [h.id, res] as const),
      ),
    ).then((results) => {
      const map = new Map<string, ReadonlySet<string>>();
      for (const [id, habitLogs] of results) {
        map.set(id, new Set(habitLogs.filter((l) => l.completed).map((l) => l.date)));
      }
      setLogs(map);
    }).catch(() => {/* ignore */});
  }, [weekStart, habits]);

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekStart(offsetDate(weekStart, -7))}
          className="text-[0.75rem] px-2 py-1 opacity-50 hover:opacity-80"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          &larr; Prev
        </button>
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-secondary)" }}>
          {days[0]} &mdash; {days[6]}
        </span>
        <button
          onClick={() => canGoNext && setWeekStart(offsetDate(weekStart, 7))}
          disabled={!canGoNext}
          className="text-[0.75rem] px-2 py-1 opacity-50 hover:opacity-80 disabled:opacity-20"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Next &rarr;
        </button>
      </div>

      {/* Header row */}
      <div className="grid gap-1" style={{ gridTemplateColumns: "120px repeat(7, 1fr)" }}>
        <div />
        {days.map((d) => (
          <div
            key={d}
            className="text-center text-[0.6rem] py-1 rounded"
            style={{
              color: d === today ? "var(--color-pn-primary-400)" : "var(--pn-text-tertiary)",
              background: d === today ? "rgba(255,255,255,0.04)" : "transparent",
            }}
          >
            {dayOfWeek(d)}
          </div>
        ))}

        {/* Habit rows */}
        {habits.map((habit: Habit) => {
          const habitLogs = logs.get(habit.id);
          return (
            <div key={habit.id} className="contents">
              <span
                className="text-[0.75rem] truncate self-center"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {habit.name}
              </span>
              {days.map((d) => {
                const done = habitLogs?.has(d) ?? false;
                return (
                  <div
                    key={d}
                    className="flex items-center justify-center py-1"
                    style={{
                      background: d === today ? "rgba(255,255,255,0.02)" : "transparent",
                    }}
                  >
                    <div
                      className="rounded"
                      style={{
                        width: "14px",
                        height: "14px",
                        background: done ? habit.color : "transparent",
                        border: done ? "none" : "1px solid rgba(255,255,255,0.06)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
