import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useLifeDashboardStore } from "@/stores/life-dashboard-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Execution } from "@/types/executions";

const config = APP_CONFIGS["life-dashboard"];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const GLASS = {
  background: "rgba(14, 16, 23, 0.55)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
};

export function LifeDashboardApp() {
  const store = useLifeDashboardStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await store.loadBriefing();
        await store.loadMoodHistory();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
      if (!cancelled) setReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="life-dashboard" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const journalPreview = store.dashboardJournal?.content
    ? store.dashboardJournal.content.slice(0, 100) + (store.dashboardJournal.content.length > 100 ? "..." : "")
    : null;

  const runningExecs = store.executions.filter((e) => e.status === "running" || e.status === "approved" || e.status === "delegated");
  const needsApproval = store.executions.filter((e) => e.requires_approval && e.status === "created");
  const completedToday = store.executions.filter((e) => e.status === "completed" && e.completed_at?.startsWith(today));

  // One Thing: pick the most important execution
  const oneThingExec = pickOneThing(store.executions);

  return (
    <AppWindowChrome appId="life-dashboard" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ padding: 24, color: "var(--pn-text-primary)", height: "100%", overflow: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Life Dashboard</h2>
          <button
            onClick={() => store.loadViaRest()}
            style={{
              fontSize: 11,
              color: "var(--pn-text-tertiary)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--pn-border-subtle)",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Section 1 — Today */}
        <div style={{ ...GLASS, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>
            {getGreeting()}, Trajan
          </div>
          <div style={{ fontSize: 12, color: "var(--pn-text-tertiary)", marginBottom: 12 }}>
            {formatDate()}
          </div>

          {/* Journal preview */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Journal
            </div>
            <div style={{ fontSize: 12, color: journalPreview ? "var(--pn-text-secondary)" : "var(--pn-text-muted)", fontStyle: journalPreview ? "normal" : "italic" }}>
              {journalPreview ?? "No entry yet"}
            </div>
          </div>

          {/* Habits with toggles */}
          {store.dashboardHabits.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Habits ({store.dashboardHabits.filter((h) => h.completed).length}/{store.dashboardHabits.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {store.dashboardHabits.map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => store.toggleHabit(habit.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: habit.completed ? "rgba(45,212,168,0.06)" : "rgba(255,255,255,0.02)",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: habit.completed ? "none" : "1px solid rgba(255,255,255,0.15)",
                      background: habit.completed ? (habit.color ?? "#2dd4a8") : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: "#fff",
                      flexShrink: 0,
                    }}>
                      {habit.completed ? "\u2713" : ""}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: habit.completed ? "var(--pn-text-secondary)" : "var(--pn-text-primary)",
                      textDecoration: habit.completed ? "line-through" : "none",
                      opacity: habit.completed ? 0.6 : 1,
                    }}>
                      {habit.name}
                    </span>
                    {habit.streak > 0 && (
                      <span style={{ fontSize: 10, color: "var(--pn-text-muted)", fontFamily: "'JetBrains Mono', monospace", marginLeft: "auto" }}>
                        {habit.streak}d
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 2 — Active Work */}
        <div style={{ ...GLASS, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 12, fontWeight: 500, marginBottom: 10, color: "var(--pn-text-secondary)" }}>Active Work</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: needsApproval.length > 0 ? 12 : 0 }}>
            <StatCard label="In Progress" value={runningExecs.length} color="#6b95f0" />
            <StatCard label="Needs Approval" value={needsApproval.length} color="#f59e0b" />
            <StatCard label="Completed Today" value={completedToday.length} color="#2dd4a8" />
          </div>
          {needsApproval.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {needsApproval.map((ex) => (
                <div key={ex.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: "rgba(245,158,11,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#f59e0b", background: "rgba(245,158,11,0.12)", padding: "1px 5px", borderRadius: 3 }}>
                      {ex.mode}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--pn-text-primary)" }}>
                      {ex.title || ex.intent_slug || "Untitled"}
                    </span>
                  </div>
                  <button
                    onClick={() => store.approveExecution(ex.id)}
                    style={{
                      fontSize: 10,
                      color: "#2dd4a8",
                      background: "rgba(45,212,168,0.08)",
                      border: "1px solid rgba(45,212,168,0.2)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3 — One Thing */}
        {oneThingExec && (
          <div style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.15)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              The One Thing
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--pn-text-primary)" }}>
                {oneThingExec.title || oneThingExec.intent_slug || "Untitled execution"}
              </span>
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#6b95f0", background: "rgba(107,149,240,0.12)", padding: "1px 5px", borderRadius: 3 }}>
                {oneThingExec.mode}
              </span>
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)" }}>
                {oneThingExec.status}
              </span>
            </div>
          </div>
        )}

        {/* Section 4 — Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ ...GLASS, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#2dd4a8" }}>
              {store.briefing?.habits_done ?? 0}/{store.briefing?.habits_total ?? 0}
            </div>
            <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>Habits</div>
          </div>
          <div style={{ ...GLASS, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#6b95f0" }}>
              {store.briefing?.tasks_due ?? 0}
            </div>
            <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>Tasks Due</div>
          </div>
          <div style={{ ...GLASS, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>
              {store.briefing?.inbox_count ?? 0}
            </div>
            <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>Inbox</div>
          </div>
          <div style={{ ...GLASS, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#a78bfa" }}>
              {store.executions.length}
            </div>
            <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>Executions</div>
          </div>
        </div>

        {/* Streaks */}
        {store.streaks.length > 0 && (
          <div style={{ ...GLASS, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: "var(--pn-text-secondary)" }}>Streaks</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {store.streaks.map((streak) => (
                <div
                  key={streak.id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--pn-text-secondary)" }}>{streak.name}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: streak.color ?? "#2dd4a8" }}>
                    {streak.current}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood history */}
        {store.moodHistory.length > 0 && (
          <div style={{ ...GLASS, padding: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, color: "var(--pn-text-secondary)" }}>Mood & Energy (7 days)</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48 }}>
              {store.moodHistory.slice(-7).map((point, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 2 }}>
                  <div style={{
                    width: "100%",
                    height: Math.max(2, (point.mood / 10) * 40),
                    borderRadius: "2px 2px 0 0",
                    background: `rgba(107, 149, 240, ${0.3 + (point.mood / 10) * 0.7})`,
                  }} title={`Mood: ${point.mood}`} />
                  <div style={{ fontSize: 8, color: "var(--pn-text-muted)" }}>
                    {point.date.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}

function StatCard({ label, value, color }: { readonly label: string; readonly value: number; readonly color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 4px", borderRadius: 8, background: `${color}08` }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--pn-text-tertiary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function pickOneThing(executions: readonly Execution[]): Execution | null {
  const running = executions.filter((e) => e.status === "running" || e.status === "delegated");
  if (running.length > 0) return running[0];
  const approval = executions.filter((e) => e.requires_approval && e.status === "created");
  if (approval.length > 0) return approval[0];
  const approved = executions.filter((e) => e.status === "approved");
  if (approved.length > 0) return approved[0];
  return null;
}
