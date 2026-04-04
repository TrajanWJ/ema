import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

interface Today { one_thing: string | null; date: string; }
interface TemporalCtx { time_of_day: string; estimated_energy: number; recommended_task_type: string; }
interface Execution { id: string; mode: string; status: string; intent_title?: string; }
interface Gap { id: string; title: string; severity: string; }
interface Habit { id: string; name: string; }
interface HabitLog { habit_id: string; completed: boolean; }

export function BriefingApp() {
  const [today, setToday] = useState<Today | null>(null);
  const [temporal, setTemporal] = useState<TemporalCtx | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Today>("/dashboard/today").catch((): Today => ({ one_thing: null, date: new Date().toLocaleDateString() })),
      api.get<TemporalCtx>("/temporal/now").catch((): TemporalCtx => ({ time_of_day: "unknown", estimated_energy: 3, recommended_task_type: "any" })),
      api.get<Execution[]>("/executions?status=running&limit=5").catch((): Execution[] => []),
      api.get<Gap[]>("/gaps?limit=5").catch((): Gap[] => []),
      api.get<Habit[]>("/habits").catch((): Habit[] => []),
      api.get<HabitLog[]>("/habits/today").catch((): HabitLog[] => []),
    ]).then(([t, tc, ex, g, h, hl]) => {
      setToday(t); setTemporal(tc); setExecutions(ex); setGaps(g); setHabits(h); setHabitLogs(hl);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const completedHabits = habitLogs.filter((l) => l.completed).length;
  const habitPct = habits.length > 0 ? Math.round((completedHabits / habits.length) * 100) : 0;
  const runningExec = executions.filter((e) => e.status === "running");

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.5, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>{title}</div>
      {children}
    </div>
  );

  return (
    <AppWindowChrome appId="briefing" title="Daily Brief">
      <div style={{ padding: "16px 20px", overflowY: "auto", height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <button onClick={load} disabled={loading}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        <Section title="Status">
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
            ⚡ {temporal?.time_of_day} · Energy {temporal?.estimated_energy}/5 · Best for: {temporal?.recommended_task_type}
          </div>
          {today?.one_thing && <div style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa" }}>🎯 {today.one_thing}</div>}
        </Section>

        <Section title="Active Work">
          {runningExec.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.5 }}>No active executions.</div>
          ) : runningExec.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", marginTop: 4, flexShrink: 0 }} />
              <span>{e.intent_title ?? e.id} <span style={{ opacity: 0.5 }}>({e.mode})</span></span>
            </div>
          ))}
        </Section>

        <Section title={`Gaps (${gaps.length} open)`}>
          {gaps.slice(0, 3).map((g) => (
            <div key={g.id} style={{ fontSize: 13, marginBottom: 5, display: "flex", gap: 8 }}>
              <span style={{ color: g.severity === "critical" ? "#ef4444" : "#f59e0b", flexShrink: 0 }}>⚠</span>
              <span style={{ opacity: 0.8 }}>{g.title}</span>
            </div>
          ))}
          {gaps.length === 0 && <div style={{ fontSize: 13, opacity: 0.5 }}>No open gaps. 🎉</div>}
        </Section>

        <Section title={`Habits — ${habitPct}%`}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", border: `3px solid ${habitPct > 70 ? "#22c55e" : habitPct > 40 ? "#f59e0b" : "#ef4444"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
              {habitPct}%
            </div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>{completedHabits} of {habits.length} completed today</div>
          </div>
        </Section>
      </div>
    </AppWindowChrome>
  );
}
