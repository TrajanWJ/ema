import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { todayStr, offsetDate } from "@/lib/date-utils";
import type { HabitLog } from "@/types/habits";

interface StreakGridProps {
  readonly habitId: string;
  readonly color: string;
}

export function StreakGrid({ habitId, color }: StreakGridProps) {
  const [completedDates, setCompletedDates] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const today = todayStr();
    const start = offsetDate(today, -29);

    api
      .get<HabitLog[]>(`/habits/${habitId}/logs?start=${start}&end=${today}`)
      .then((logs) => {
        const dates = new Set(
          logs.filter((l) => l.completed).map((l) => l.date),
        );
        setCompletedDates(dates);
      })
      .catch(() => {
        // silently fail — grid stays empty
      });
  }, [habitId]);

  const today = todayStr();
  const days = Array.from({ length: 30 }, (_, i) => offsetDate(today, -(29 - i)));

  return (
    <div className="flex flex-wrap gap-[2px]" style={{ maxWidth: "calc(10 * (8px + 2px))" }}>
      {days.map((date) => (
        <div
          key={date}
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "2px",
            background: completedDates.has(date) ? color : "transparent",
            border: completedDates.has(date) ? "none" : "1px solid rgba(255,255,255,0.08)",
          }}
          title={date}
        />
      ))}
    </div>
  );
}
