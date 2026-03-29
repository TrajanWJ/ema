import { useEffect, useState } from "react";
import { useHabitsStore } from "@/stores/habits-store";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import type { Habit, HabitLog } from "@/types/habits";

interface HabitStats {
  readonly current: number;
  readonly longest: number;
  readonly total: number;
  readonly rate: number;
}

function computeStats(logs: readonly HabitLog[], currentStreak: number): HabitStats {
  const completedLogs = logs.filter((l) => l.completed);
  const total = completedLogs.length;
  const totalDays = logs.length || 1;
  const rate = Math.round((total / totalDays) * 100);

  // Compute longest streak from sorted dates
  const dates = completedLogs.map((l) => l.date).sort();
  let longest = 0;
  let run = 0;
  let prevDate = "";

  for (const d of dates) {
    if (prevDate) {
      const prev = new Date(`${prevDate}T12:00:00`);
      const curr = new Date(`${d}T12:00:00`);
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        run++;
      } else {
        longest = Math.max(longest, run);
        run = 1;
      }
    } else {
      run = 1;
    }
    prevDate = d;
  }
  longest = Math.max(longest, run);

  return { current: currentStreak, longest, total, rate };
}

function StreakCard({
  habit,
  stats,
}: {
  readonly habit: Habit;
  readonly stats: HabitStats;
}) {
  const barMax = Math.max(stats.longest, stats.current, 1);

  return (
    <GlassCard>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className="rounded-full"
            style={{ width: "10px", height: "10px", background: habit.color }}
          />
          <span className="text-[0.8rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
            {habit.name}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex gap-4">
          <StatLabel label="Current" value={`${stats.current}d`} />
          <StatLabel label="Longest" value={`${stats.longest}d`} />
          <StatLabel label="Rate" value={`${stats.rate}%`} />
          <StatLabel label="Total" value={String(stats.total)} />
        </div>

        {/* Bar visual */}
        <div className="flex flex-col gap-1">
          <div
            className="h-2 rounded-full"
            style={{
              width: `${(stats.current / barMax) * 100}%`,
              minWidth: stats.current > 0 ? "8px" : "0",
              background: habit.color,
            }}
          />
          <div
            className="h-2 rounded-full"
            style={{
              width: `${(stats.longest / barMax) * 100}%`,
              minWidth: stats.longest > 0 ? "8px" : "0",
              background: habit.color,
              opacity: 0.3,
            }}
          />
        </div>
      </div>
    </GlassCard>
  );
}

function StatLabel({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
        {label}
      </span>
      <span className="text-[0.8rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export function StreaksView() {
  const habits = useHabitsStore((s) => s.habits);
  const streaks = useHabitsStore((s) => s.streaks);
  const [statsMap, setStatsMap] = useState<ReadonlyMap<string, HabitStats>>(new Map());

  useEffect(() => {
    Promise.all(
      habits.map((h) =>
        api
          .get<HabitLog[]>(`/habits/${h.id}/logs?start=2020-01-01&end=2099-12-31`)
          .then((logs) => [h.id, computeStats(logs, streaks[h.id] ?? 0)] as const),
      ),
    ).then((results) => {
      setStatsMap(new Map(results));
    }).catch(() => {/* ignore */});
  }, [habits, streaks]);

  const sorted = [...habits].sort((a, b) => {
    const sa = streaks[a.id] ?? 0;
    const sb = streaks[b.id] ?? 0;
    return sb - sa;
  });

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((habit) => {
        const stats = statsMap.get(habit.id);
        if (!stats) return null;
        return <StreakCard key={habit.id} habit={habit} stats={stats} />;
      })}
      {sorted.length === 0 && (
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
          No habits tracked yet
        </span>
      )}
    </div>
  );
}
