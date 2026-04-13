import { GlassCard } from "@/components/ui/GlassCard";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useHabitsStore } from "@/stores/habits-store";

interface HabitsSummaryCardProps {
  readonly onNavigate?: () => void;
}

export function HabitsSummaryCard({ onNavigate }: HabitsSummaryCardProps) {
  const habits = useDashboardStore((s) => s.snapshot?.habits ?? []);
  const toggleToday = useHabitsStore((s) => s.toggleToday);

  const completed = habits.filter((h) => h.completed).length;
  const total = habits.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <GlassCard title="Habits" onNavigate={onNavigate}>
      <div className="flex flex-col gap-1.5">
        {habits.map((habit) => (
          <button
            key={habit.id}
            onClick={() => toggleToday(habit.id)}
            className="flex items-center gap-2 text-left group"
          >
            <span
              className="shrink-0 rounded-full transition-colors"
              style={{
                width: "12px",
                height: "12px",
                background: habit.completed ? habit.color : "transparent",
                border: `2px solid ${habit.color}`,
              }}
            />
            <span
              className="flex-1 text-[0.8rem] truncate"
              style={{ color: "var(--pn-text-primary)" }}
            >
              {habit.name}
            </span>
            <span
              className="text-[0.7rem]"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              {habit.streak > 0 ? `\u{1F525} ${habit.streak}` : "\u2014"}
            </span>
          </button>
        ))}

        {total === 0 && (
          <span
            className="text-[0.75rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            No habits tracked yet
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="mt-3">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: "var(--color-pn-primary-400)",
              }}
            />
          </div>
          <span
            className="text-[0.6rem] mt-1 block"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            {completed}/{total} completed
          </span>
        </div>
      )}
    </GlassCard>
  );
}
