import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useTokenStore } from "@/stores/token-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["token-monitor"];

function DeltaArrow({ value }: { value: number }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        marginLeft: 4,
        color: up ? "#EF4444" : "#22C55E",
      }}
    >
      {up ? "\u25B2" : "\u25BC"} ${Math.abs(value).toFixed(2)}
    </span>
  );
}

function BarChart({ data }: { data: readonly { date: string; total_cost: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.total_cost), 0.01);
  const barWidth = Math.max(4, Math.floor(280 / data.length) - 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 60 }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.total_cost / max) * 56);
        return (
          <div
            key={i}
            title={`${d.date}: $${d.total_cost.toFixed(2)}`}
            style={{
              width: barWidth,
              height: h,
              borderRadius: "2px 2px 0 0",
              background: `rgba(45, 212, 168, ${0.3 + (d.total_cost / max) * 0.7})`,
            }}
          />
        );
      })}
    </div>
  );
}

function BreakdownTable({
  data,
  label,
}: {
  data: readonly { key: string; total_cost: number; total_input: number; total_output: number; event_count: number }[];
  label: string;
}) {
  if (data.length === 0) return null;
  return (
    <div>
      <h3 style={{ fontSize: 11, fontWeight: 500, marginBottom: 8, color: "var(--pn-text-secondary)" }}>
        By {label}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map((row) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11,
              padding: "6px 8px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.key || "unknown"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ color: "var(--pn-text-tertiary)" }}>
                {(row.total_input + row.total_output).toLocaleString()} tok
              </span>
              <span style={{ color: "var(--pn-text-secondary)" }}>
                {row.event_count} calls
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-primary)" }}>
                ${row.total_cost.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TokenMonitorApp() {
  const store = useTokenStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await store.loadViaRest();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load token data");
      }
      if (!cancelled) setReady(true);
      store.connect().catch(() => {
        console.warn("Token WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="token-monitor" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const s = store.summary;
  const budgetOverThreshold = (s?.percent_used ?? 0) >= 80;
  const budgetExceeded = (s?.percent_used ?? 0) >= 100;

  function handleSaveBudget() {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount > 0) {
      store.setBudget(amount);
      setEditingBudget(false);
    }
  }

  return (
    <AppWindowChrome appId="token-monitor" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ padding: 24, color: "var(--pn-text-primary)", height: "100%", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Token Monitor</h2>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-muted)" }}>
            {s?.as_of ? new Date(s.as_of).toLocaleTimeString() : ""}
          </span>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>
            {error}
          </div>
        )}

        {budgetExceeded && (
          <div style={{ marginBottom: 12, padding: "8px 16px", borderRadius: 8, background: "rgba(239,68,68,0.15)", color: "#EF4444", borderLeft: "3px solid #EF4444", fontSize: 13 }}>
            Budget exceeded: ${s?.month_cost.toFixed(2)} of ${s?.monthly_budget} ({s?.percent_used.toFixed(0)}%)
          </div>
        )}
        {budgetOverThreshold && !budgetExceeded && (
          <div style={{ marginBottom: 12, padding: "8px 16px", borderRadius: 8, background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderLeft: "3px solid #f59e0b", fontSize: 13 }}>
            Budget warning: {s?.percent_used.toFixed(0)}% used ({s?.days_remaining} days remaining)
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "rgba(14, 16, 23, 0.55)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginBottom: 4 }}>Today</div>
            <div style={{ fontSize: 22, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
              ${s?.today_cost.toFixed(2) ?? "0.00"}
            </div>
            <DeltaArrow value={s?.today_delta ?? 0} />
          </div>
          <div style={{ background: "rgba(14, 16, 23, 0.55)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginBottom: 4 }}>This Week</div>
            <div style={{ fontSize: 22, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
              ${s?.week_cost.toFixed(2) ?? "0.00"}
            </div>
          </div>
          <div style={{ background: "rgba(14, 16, 23, 0.55)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--pn-text-tertiary)", marginBottom: 4 }}>This Month</div>
            <div style={{ fontSize: 22, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
              ${s?.month_cost.toFixed(2) ?? "0.00"}
            </div>
          </div>
        </div>

        {/* Budget progress */}
        <div style={{ background: "rgba(14, 16, 23, 0.55)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--pn-text-secondary)" }}>Monthly Budget</span>
            {editingBudget ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--pn-text-tertiary)" }}>$</span>
                <input
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveBudget()}
                  autoFocus
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "2px 8px", fontSize: 11, width: 80, color: "var(--pn-text-primary)", outline: "none" }}
                />
                <button onClick={handleSaveBudget} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(45,212,168,0.2)", color: "#2dd4a8", border: "none", cursor: "pointer" }}>Save</button>
                <button onClick={() => setEditingBudget(false)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "none", color: "var(--pn-text-tertiary)", border: "none", cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => { setBudgetInput(String(s?.monthly_budget ?? 100)); setEditingBudget(true); }}
                style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                ${s?.monthly_budget ?? 100} / month
              </button>
            )}
          </div>
          <div style={{ width: "100%", borderRadius: 999, overflow: "hidden", height: 6, background: "rgba(255,255,255,0.06)" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                transition: "width 0.5s",
                width: `${Math.min(s?.percent_used ?? 0, 100)}%`,
                background: budgetExceeded ? "#EF4444" : budgetOverThreshold ? "#f59e0b" : "#2dd4a8",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-muted)" }}>
              ${s?.month_cost.toFixed(2) ?? "0.00"}
            </span>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-muted)" }}>
              {s?.percent_used.toFixed(0) ?? 0}%
            </span>
          </div>
        </div>

        {/* History chart */}
        <div style={{ background: "rgba(14, 16, 23, 0.55)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 500, marginBottom: 12, color: "var(--pn-text-secondary)" }}>30-Day History</h3>
          {store.history.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--pn-text-muted)", textAlign: "center", padding: 16 }}>No history data</div>
          ) : (
            <BarChart data={store.history} />
          )}
        </div>

        {/* Forecast */}
        {store.forecast && (
          <div style={{ background: "rgba(14, 16, 23, 0.55)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 500, marginBottom: 8, color: "var(--pn-text-secondary)" }}>Forecast</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--pn-text-tertiary)" }}>Daily avg: </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>${store.forecast.daily_avg.toFixed(2)}</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--pn-text-tertiary)" }}>Projected: </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>${store.forecast.projected_monthly.toFixed(2)}/mo</span>
              </div>
              <span style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                background: store.forecast.trend === "rising" ? "rgba(239,68,68,0.15)" : store.forecast.trend === "falling" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                color: store.forecast.trend === "rising" ? "#EF4444" : store.forecast.trend === "falling" ? "#22C55E" : "var(--pn-text-tertiary)",
              }}>
                {store.forecast.trend}
              </span>
            </div>
          </div>
        )}

        {/* Alerts */}
        {store.alerts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ fontSize: 11, fontWeight: 500, color: "var(--pn-text-secondary)", margin: 0 }}>Alerts ({store.alerts.length})</h3>
              <button onClick={store.clearAlerts} style={{ fontSize: 10, color: "var(--pn-text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear all</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {store.alerts.map((alert, i) => {
                const alertColor = alert.type === "cost_spike" || alert.type === "budget_exceeded" ? "#EF4444" : "#2dd4a8";
                return (
                  <div key={`${alert.type}-${i}`} style={{ borderRadius: 8, padding: "8px 12px", fontSize: 11, background: `${alertColor}10`, borderLeft: `2px solid ${alertColor}`, color: "var(--pn-text-secondary)" }}>
                    <div>{alert.message}</div>
                    <div style={{ fontSize: 10, marginTop: 2, color: "var(--pn-text-muted)" }}>{new Date(alert.timestamp).toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Breakdowns */}
        {s && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <BreakdownTable data={s.by_model} label="Model" />
            <BreakdownTable data={s.by_agent} label="Agent" />
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
