import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useLifeDashboardStore } from "@/stores/life-dashboard-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["life-dashboard"];

export function LifeDashboardApp() {
  const store = useLifeDashboardStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await Promise.all([
          store.loadBriefing(),
          store.loadStreaks(),
          store.loadMoodHistory(),
        ]);
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

  const b = store.briefing;

  return (
    <AppWindowChrome appId="life-dashboard" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ padding: 24, color: "var(--pn-text-primary)", height: "100%", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Life Dashboard</h2>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>
            {error}
          </div>
        )}

        {!b && !store.loading && (
          <div style={{
            background: "rgba(14, 16, 23, 0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}>
            <span style={{ fontSize: 13, color: "var(--pn-text-muted)" }}>No briefing data available.</span>
          </div>
        )}

        {b && (
          <>
            {/* Greeting */}
            <div style={{
              background: "rgba(14, 16, 23, 0.55)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                Hello, {b.greeting_name}
              </div>
              {b.quote && (
                <div style={{ fontSize: 12, color: "var(--pn-text-tertiary)", fontStyle: "italic" }}>
                  "{b.quote}"
                </div>
              )}
            </div>

            {/* One thing */}
            {b.one_thing && (
              <div style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.15)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 10, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  The One Thing
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{b.one_thing}</div>
              </div>
            )}

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{
                background: "rgba(14, 16, 23, 0.55)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#2dd4a8" }}>{b.habits_done}/{b.habits_total}</div>
                <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>Habits Done</div>
              </div>
              <div style={{
                background: "rgba(14, 16, 23, 0.55)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#6b95f0" }}>{b.tasks_due}</div>
                <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>Tasks Due</div>
              </div>
              <div style={{
                background: "rgba(14, 16, 23, 0.55)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{b.inbox_count}</div>
                <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>Inbox Items</div>
              </div>
              <div style={{
                background: "rgba(14, 16, 23, 0.55)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#a78bfa" }}>{b.upcoming.length}</div>
                <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginTop: 4 }}>Upcoming</div>
              </div>
            </div>

            {/* Habits progress bar */}
            {b.habits_total > 0 && (
              <div style={{
                background: "rgba(14, 16, 23, 0.55)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--pn-text-secondary)" }}>Today's Habits</span>
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)" }}>
                    {((b.habits_done / b.habits_total) * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{
                    height: "100%",
                    borderRadius: 999,
                    width: `${(b.habits_done / b.habits_total) * 100}%`,
                    background: "#2dd4a8",
                    transition: "width 0.5s",
                  }} />
                </div>
              </div>
            )}

            {/* Upcoming */}
            {b.upcoming.length > 0 && (
              <div style={{
                background: "rgba(14, 16, 23, 0.55)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}>
                <h3 style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: "var(--pn-text-secondary)" }}>Upcoming</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {b.upcoming.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--pn-text-primary)" }}>{item.title}</span>
                      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-muted)" }}>{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Streaks */}
        {store.streaks.length > 0 && (
          <div style={{
            background: "rgba(14, 16, 23, 0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: streak.color || "#2dd4a8" }}>
                      {streak.current}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--pn-text-muted)" }}>best: {streak.best}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood history mini chart */}
        {store.moodHistory.length > 0 && (
          <div style={{
            background: "rgba(14, 16, 23, 0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
          }}>
            <h3 style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, color: "var(--pn-text-secondary)" }}>Mood & Energy (7 days)</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48 }}>
              {store.moodHistory.slice(-7).map((point, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 2 }}>
                  {/* Mood bar */}
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
