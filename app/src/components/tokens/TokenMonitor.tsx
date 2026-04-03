import { useEffect, useState } from "react";
import { useTokenStore } from "@/stores/token-store";

function DeltaArrow({ value }: { value: number }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span
      className="text-xs font-mono ml-1"
      style={{ color: up ? "#EF4444" : "#22C55E" }}
    >
      {up ? "\u25B2" : "\u25BC"} ${Math.abs(value).toFixed(2)}
    </span>
  );
}

function Sparkline({ data }: { data: readonly { total_cost: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.total_cost), 0.01);
  const barWidth = Math.max(4, Math.floor(280 / data.length) - 1);

  return (
    <div className="flex items-end gap-px" style={{ height: 60 }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.total_cost / max) * 56);
        return (
          <div
            key={i}
            className="rounded-t"
            style={{
              width: barWidth,
              height: h,
              background: `rgba(45, 212, 168, ${0.3 + (d.total_cost / max) * 0.7})`,
            }}
            title={`$${d.total_cost.toFixed(2)}`}
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
      <h3 className="text-xs font-medium mb-2" style={{ color: "var(--pn-text-secondary)" }}>
        By {label}
      </h3>
      <div className="flex flex-col gap-1">
        {data.map((row) => (
          <div key={row.key} className="flex items-center justify-between text-xs px-2 py-1.5 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
            <span className="font-mono truncate" style={{ color: "var(--pn-text-secondary)", maxWidth: 120 }}>
              {row.key || "unknown"}
            </span>
            <div className="flex items-center gap-4">
              <span style={{ color: "var(--pn-text-tertiary)" }}>
                {(row.total_input + row.total_output).toLocaleString()} tok
              </span>
              <span style={{ color: "var(--pn-text-secondary)" }}>
                {row.event_count} calls
              </span>
              <span className="font-mono" style={{ color: "rgba(255,255,255,0.87)" }}>
                ${row.total_cost.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TokenMonitor() {
  const { summary, history, forecast, loading, loadViaRest, connect, setBudget } = useTokenStore();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  useEffect(() => {
    loadViaRest();
    connect();
  }, [loadViaRest, connect]);

  if (loading && !summary) {
    return (
      <div className="flex flex-col gap-4 p-6 h-full">
        <div className="text-sm" style={{ color: "var(--pn-text-tertiary)" }}>Loading token data...</div>
      </div>
    );
  }

  const s = summary;
  const budgetOverThreshold = (s?.percent_used ?? 0) >= 80;
  const budgetExceeded = (s?.percent_used ?? 0) >= 100;

  function handleSaveBudget() {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount > 0) {
      setBudget(amount);
      setEditingBudget(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: "rgba(255,255,255,0.87)" }}>
          Token Monitor
        </h1>
        <span className="text-xs font-mono" style={{ color: "var(--pn-text-muted)" }}>
          {s?.as_of ? new Date(s.as_of).toLocaleTimeString() : ""}
        </span>
      </div>

      {/* Budget exceeded alert */}
      {budgetExceeded && (
        <div
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", borderLeft: "3px solid #EF4444" }}
        >
          Budget exceeded: ${s?.month_cost.toFixed(2)} of ${s?.monthly_budget} ({s?.percent_used.toFixed(0)}%)
        </div>
      )}
      {budgetOverThreshold && !budgetExceeded && (
        <div
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderLeft: "3px solid #f59e0b" }}
        >
          Budget warning: {s?.percent_used.toFixed(0)}% used ({s?.days_remaining} days remaining)
        </div>
      )}

      {/* Big numbers row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-surface rounded-lg p-4 text-center">
          <div className="text-xs mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Today</div>
          <div className="text-xl font-mono font-bold" style={{ color: "rgba(255,255,255,0.87)" }}>
            ${s?.today_cost.toFixed(2) ?? "0.00"}
          </div>
          <DeltaArrow value={s?.today_delta ?? 0} />
        </div>
        <div className="glass-surface rounded-lg p-4 text-center">
          <div className="text-xs mb-1" style={{ color: "var(--pn-text-tertiary)" }}>This Week</div>
          <div className="text-xl font-mono font-bold" style={{ color: "rgba(255,255,255,0.87)" }}>
            ${s?.week_cost.toFixed(2) ?? "0.00"}
          </div>
        </div>
        <div className="glass-surface rounded-lg p-4 text-center">
          <div className="text-xs mb-1" style={{ color: "var(--pn-text-tertiary)" }}>This Month</div>
          <div className="text-xl font-mono font-bold" style={{ color: "rgba(255,255,255,0.87)" }}>
            ${s?.month_cost.toFixed(2) ?? "0.00"}
          </div>
        </div>
      </div>

      {/* Budget progress */}
      <div className="glass-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: "var(--pn-text-secondary)" }}>
            Monthly Budget
          </span>
          {editingBudget ? (
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>$</span>
              <input
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveBudget()}
                className="bg-transparent border rounded px-2 py-0.5 text-xs w-20 outline-none"
                style={{ borderColor: "var(--pn-border-default)", color: "rgba(255,255,255,0.87)" }}
                autoFocus
              />
              <button onClick={handleSaveBudget} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(45,212,168,0.2)", color: "#2dd4a8" }}>
                Save
              </button>
              <button onClick={() => setEditingBudget(false)} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--pn-text-tertiary)" }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setBudgetInput(String(s?.monthly_budget ?? 100)); setEditingBudget(true); }}
              className="text-xs font-mono hover:underline"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              ${s?.monthly_budget ?? 100} / month
            </button>
          )}
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(s?.percent_used ?? 0, 100)}%`,
              background: budgetExceeded ? "#EF4444" : budgetOverThreshold ? "#f59e0b" : "#2dd4a8",
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs font-mono" style={{ color: "var(--pn-text-muted)" }}>
            ${s?.month_cost.toFixed(2) ?? "0.00"}
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--pn-text-muted)" }}>
            {s?.percent_used.toFixed(0) ?? 0}%
          </span>
        </div>
      </div>

      {/* 30-day sparkline */}
      <div className="glass-surface rounded-lg p-4">
        <h3 className="text-xs font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
          30-Day History
        </h3>
        <Sparkline data={history} />
      </div>

      {/* Forecast */}
      {forecast && (
        <div className="glass-surface rounded-lg p-4">
          <h3 className="text-xs font-medium mb-2" style={{ color: "var(--pn-text-secondary)" }}>
            Forecast
          </h3>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>Daily avg: </span>
              <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.87)" }}>
                ${forecast.daily_avg.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>Projected: </span>
              <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.87)" }}>
                ${forecast.projected_monthly.toFixed(2)}/mo
              </span>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background:
                  forecast.trend === "rising"
                    ? "rgba(239,68,68,0.15)"
                    : forecast.trend === "falling"
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(255,255,255,0.06)",
                color:
                  forecast.trend === "rising"
                    ? "#EF4444"
                    : forecast.trend === "falling"
                      ? "#22C55E"
                      : "var(--pn-text-tertiary)",
              }}
            >
              {forecast.trend}
            </span>
          </div>
        </div>
      )}

      {/* Breakdowns */}
      {s && <BreakdownTable data={s.by_model} label="Model" />}
      {s && <BreakdownTable data={s.by_agent} label="Agent" />}
    </div>
  );
}

export function TokenMonitorApp() {
  return <TokenMonitor />;
}
