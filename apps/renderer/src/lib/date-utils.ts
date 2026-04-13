export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return "Today";
  if (dateStr === offsetDate(today, -1)) return "Yesterday";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dayOfWeek(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

export function weekDates(dateStr: string): string[] {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date.toISOString().slice(0, 10);
  });
}

export function getMonthDays(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7;
  const days: string[] = [];
  const cursor = new Date(first);
  cursor.setDate(1 - startDay);
  for (let i = 0; i < 42; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
