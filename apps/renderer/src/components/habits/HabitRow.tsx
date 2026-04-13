import { useState } from "react";
import { useHabitsStore } from "@/stores/habits-store";
import { StreakGrid } from "./StreakGrid";
import type { Habit } from "@/types/habits";

interface HabitRowProps {
  readonly habit: Habit;
  readonly completed: boolean;
  readonly streak: number;
}

export function HabitRow({ habit, completed, streak }: HabitRowProps) {
  const [hovered, setHovered] = useState(false);
  const toggleToday = useHabitsStore((s) => s.toggleToday);
  const archiveHabit = useHabitsStore((s) => s.archiveHabit);

  return (
    <div
      className="flex flex-col gap-2 py-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <button
          onClick={() => toggleToday(habit.id)}
          className="shrink-0 rounded-full transition-colors"
          style={{
            width: "16px",
            height: "16px",
            background: completed ? habit.color : "transparent",
            border: `2px solid ${habit.color}`,
          }}
          aria-label={completed ? `Uncheck ${habit.name}` : `Check ${habit.name}`}
        />

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[0.8rem] truncate"
              style={{ color: "var(--pn-text-primary)" }}
            >
              {habit.name}
            </span>
            {habit.target && (
              <span
                className="text-[0.65rem] shrink-0"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                {habit.target}
              </span>
            )}
            <span
              className="text-[0.6rem] px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--pn-text-tertiary)",
              }}
            >
              {habit.frequency}
            </span>
          </div>
        </div>

        {/* Streak */}
        <span
          className="text-[0.7rem] shrink-0"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          {streak > 0 ? `\u{1F525} ${streak}` : "\u2014"}
        </span>

        {/* Archive button */}
        <button
          onClick={() => archiveHabit(habit.id)}
          className="text-[0.7rem] shrink-0 transition-opacity"
          style={{
            color: "var(--pn-text-tertiary)",
            opacity: hovered ? 0.7 : 0,
          }}
          aria-label={`Archive ${habit.name}`}
        >
          &times;
        </button>
      </div>

      <StreakGrid habitId={habit.id} color={habit.color} />
    </div>
  );
}
