import { useEffect, useState } from "react";
import { useHabitsStore } from "@/stores/habits-store";
import { api } from "@/lib/api";
import { todayStr, getMonthDays } from "@/lib/date-utils";
import type { HabitLog } from "@/types/habits";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView() {
  const habits = useHabitsStore((s) => s.habits);
  const today = todayStr();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [logs, setLogs] = useState<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

  const days = getMonthDays(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();
  const canGoNext = year < nowYear || (year === nowYear && month < nowMonth);

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (!canGoNext) return;
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  useEffect(() => {
    const start = days[0];
    const end = days[days.length - 1];

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
  }, [year, month, habits]);

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="text-[0.75rem] px-2 py-1 opacity-50 hover:opacity-80"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          &larr;
        </button>
        <span className="text-[0.8rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className="text-[0.75rem] px-2 py-1 opacity-50 hover:opacity-80 disabled:opacity-20"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          &rarr;
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-[0.6rem] py-1"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            {d}
          </div>
        ))}

        {/* Date cells */}
        {days.map((date) => {
          const dayNum = Number.parseInt(date.slice(8), 10);
          const isCurrentMonth = Number.parseInt(date.slice(5, 7), 10) === month + 1;
          const isToday = date === today;

          const completedHabits = habits.filter((h) => logs.get(h.id)?.has(date));

          return (
            <div
              key={date}
              className="flex flex-col items-center gap-0.5 py-1 rounded"
              style={{
                opacity: isCurrentMonth ? 1 : 0.3,
                border: isToday ? "1px solid var(--color-pn-primary-400)" : "1px solid transparent",
              }}
            >
              <span
                className="text-[0.6rem]"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {dayNum}
              </span>
              <div className="flex gap-[2px] flex-wrap justify-center">
                {completedHabits.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-full"
                    style={{
                      width: "4px",
                      height: "4px",
                      background: h.color,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
