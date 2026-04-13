import { useState } from "react";
import { useHabitsStore } from "@/stores/habits-store";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AddHabitForm } from "./AddHabitForm";
import { HabitRow } from "./HabitRow";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { StreaksView } from "./StreaksView";

type Tab = "today" | "week" | "month" | "streaks";

const TAB_OPTIONS = [
  { value: "today" as const, label: "Today" },
  { value: "week" as const, label: "Week" },
  { value: "month" as const, label: "Month" },
  { value: "streaks" as const, label: "Streaks" },
];

function TodayView() {
  const habits = useHabitsStore((s) => s.habits);
  const todayLogs = useHabitsStore((s) => s.todayLogs);
  const streaks = useHabitsStore((s) => s.streaks);

  return (
    <div className="flex flex-col">
      <AddHabitForm />
      {habits.length === 0 && (
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
          No habits yet. Add one above.
        </span>
      )}
      {habits.map((habit) => {
        const log = todayLogs.find((l) => l.habit_id === habit.id);
        return (
          <HabitRow
            key={habit.id}
            habit={habit}
            completed={log?.completed ?? false}
            streak={streaks[habit.id] ?? 0}
          />
        );
      })}
    </div>
  );
}

export function HabitsPage() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-[0.9rem] font-semibold"
          style={{ color: "var(--pn-text-primary)" }}
        >
          Habits
        </h2>
        <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "today" && <TodayView />}
        {tab === "week" && <WeekView />}
        {tab === "month" && <MonthView />}
        {tab === "streaks" && <StreaksView />}
      </div>
    </div>
  );
}
