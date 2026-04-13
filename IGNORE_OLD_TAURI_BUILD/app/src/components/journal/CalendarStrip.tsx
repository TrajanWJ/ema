import { useJournalStore } from "@/stores/journal-store";
import { todayStr, weekDates, offsetDate, formatDateLabel, dayOfWeek } from "@/lib/date-utils";

export function CalendarStrip() {
  const currentDate = useJournalStore((s) => s.currentDate);
  const setCurrentDate = useJournalStore((s) => s.setCurrentDate);

  const today = todayStr();
  const days = weekDates(currentDate);
  const showJumpToToday = currentDate !== today;

  function prevWeek() {
    setCurrentDate(offsetDate(currentDate, -7));
  }

  function nextWeek() {
    const nextStart = offsetDate(days[6], 1);
    if (nextStart <= today) {
      setCurrentDate(nextStart);
    }
  }

  const canGoNext = offsetDate(days[6], 1) <= today;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {/* Top row: arrows + date label + today button */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevWeek}
          className="text-[0.75rem] px-2 py-1 opacity-50 hover:opacity-80"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          &larr;
        </button>

        <span className="text-[0.8rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
          {formatDateLabel(currentDate)}
        </span>

        <div className="flex items-center gap-2">
          {showJumpToToday && (
            <button
              onClick={() => setCurrentDate(today)}
              className="text-[0.65rem] px-2 py-0.5 rounded-md"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--color-pn-primary-400)",
              }}
            >
              Today
            </button>
          )}
          <button
            onClick={nextWeek}
            disabled={!canGoNext}
            className="text-[0.75rem] px-2 py-1 opacity-50 hover:opacity-80 disabled:opacity-20"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Day buttons */}
      <div className="flex gap-1">
        {days.map((date) => {
          const active = date === currentDate;
          const isFuture = date > today;
          const dayNum = Number.parseInt(date.slice(8), 10);

          return (
            <button
              key={date}
              onClick={() => !isFuture && setCurrentDate(date)}
              disabled={isFuture}
              className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-colors"
              style={{
                background: active ? "rgba(255,255,255,0.06)" : "transparent",
                border: active
                  ? "1px solid var(--color-pn-primary-400)"
                  : "1px solid transparent",
                opacity: isFuture ? 0.3 : 1,
              }}
            >
              <span
                className="text-[0.55rem]"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                {dayOfWeek(date)}
              </span>
              <span
                className="text-[0.75rem] font-medium"
                style={{
                  color: active
                    ? "var(--pn-text-primary)"
                    : "var(--pn-text-secondary)",
                }}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
